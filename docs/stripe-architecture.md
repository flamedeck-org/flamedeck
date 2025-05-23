# Stripe Subscription Architecture

## 1. Overview

This document outlines the architecture for integrating Stripe to handle recurring subscriptions for FlameDeck's Pro features. The goal is to allow users to subscribe to a paid plan, manage their subscription, and for the application to accurately reflect their current subscription status to control access to features.

## 2. Database Schema

The following tables in the Supabase database are central to managing subscriptions. Type definitions are in `packages/supabase-integration/src/index.ts`.

*   **`public.subscription_plans`**
    *   Stores details about available subscription plans (e.g., Free, Pro).
    *   `id` (uuid): Primary key, your internal plan identifier.
    *   `name` (text): User-facing plan name (e.g., "Pro").
    *   `price_monthly` (numeric): The price.
    *   `stripe_price_id` (text): The ID of the corresponding Price object in Stripe. Crucial for creating Checkout Sessions.
    *   Other plan-specific feature limit columns (e.g., `retention_days`, `monthly_upload_limit`).

*   **`public.user_subscriptions`**
    *   Stores the state of each user's subscription.
    *   `id` (uuid): Primary key.
    *   `user_id` (uuid): Foreign key to `user_profiles.id` (or `auth.users.id`). Has a UNIQUE constraint (`user_subscriptions_user_id_key`) assuming one primary subscription per user.
    *   `plan_id` (uuid): Foreign key to `subscription_plans.id`.
    *   `stripe_customer_id` (text): The Stripe Customer ID.
    *   `stripe_subscription_id` (text): The Stripe Subscription ID. This is the primary link to the subscription in Stripe. Has a UNIQUE constraint (`user_subscriptions_stripe_subscription_id_key`).
    *   `status` (text): Mirrors the Stripe subscription status (e.g., `active`, `trialing`, `past_due`, `canceled`).
    *   `current_period_start` (timestamp with time zone): Start of the current billing period.
    *   `current_period_end` (timestamp with time zone): End of the current billing period.
    *   `cancel_at_period_end` (boolean): True if the subscription is set to cancel at the end of the current period.
    *   `canceled_at` (timestamp with time zone): When the subscription was actually canceled.
    *   `created_at`, `updated_at`.

## 3. Backend (Supabase Edge Functions)

### 3.1. `create-stripe-checkout-session`

*   **Purpose:** Creates a Stripe Checkout session to allow a user to subscribe to a plan.
*   **Trigger:** Called by the frontend when a user clicks an "Upgrade" or "Subscribe" button.
*   **Input:** `planId` (your internal plan ID), `returnPath` (optional, for dynamic cancel URL), user's JWT (for authentication).
*   **Logic Flow:**
    1.  Authenticates the user using their JWT.
    2.  Retrieves the `stripe_price_id` from the `subscription_plans` table based on the provided `planId`.
    3.  Retrieves the user's email from Supabase Auth.
    4.  Checks if the user already has a `stripe_customer_id`.
    5.  Creates a Stripe Checkout Session with:
        *   `customer`: The Stripe Customer ID.
        *   `mode`: 'subscription'.
        *   `line_items`: Containing the `stripe_price_id`.
        *   `success_url`: Redirect URL for successful payment (e.g., `YOUR_APP_URL/payment-success?session_id={CHECKOUT_SESSION_ID}`).
        *   `cancel_url`: Dynamically constructed using `returnPath` from client, defaults to `/pricing` or similar.
        *   `subscription_data.metadata`: Includes your internal `user_id` and `plan_id` to be available in webhook events.
    6.  Returns the Stripe Checkout Session ID and URL to the client.

### 3.2. `stripe-webhook-handler`

*   **Purpose:** Listens for and processes webhook events from Stripe to keep the local database (`user_subscriptions`) in sync with Stripe.
*   **Trigger:** HTTP POST requests from Stripe to a public endpoint (`YOUR_SUPABASE_URL/functions/v1/stripe-webhook-handler`).
*   **Security:** Verifies the `Stripe-Signature` header using your Stripe Webhook Signing Secret. Deployed with `--no-verify-jwt`.
*   **Logic Flow (handles various event types):**
    *   **`customer.subscription.created`**: (Primary handler for new subscriptions)
        *   Extracts `user_id` and `plan_id` from `subscription.metadata`.
        *   Upserts a record into `user_subscriptions` using `onConflict: 'user_id'` (assuming one subscription per user).
    *   **`checkout.session.completed`**: 
        *   If `payment_status` is `paid` and `mode` was `subscription`.
        *   Considered a fallback. `customer.subscription.created` is preferred for initial insert.
    *   **`invoice.payment_succeeded`**:
        *   If `billing_reason` is `subscription_create` or `subscription_cycle`.
        *   Retrieves the full subscription details from Stripe using the subscription ID from the invoice.
        *   If `subscription_create`, attempts to upsert into `user_subscriptions` using `onConflict: 'user_id'`, using metadata from the *retrieved Stripe Subscription object* as the source for `user_id` and `plan_id` if available. This ensures the record (ideally created by `customer.subscription.created`) is up-to-date.
        *   If `subscription_cycle`, updates existing record based on `stripe_subscription_id`.
        *   Updates `status`, `current_period_start`, `current_period_end`.
    *   **`invoice.payment_failed`**: Updates `status` in `user_subscriptions`.
    *   **`customer.subscription.updated`**: Handles plan changes, cancellations, etc. Updates relevant fields in `user_subscriptions`.
    *   **`customer.subscription.deleted`**: 
        *   When a paid subscription is deleted, this handler now attempts to revert the user to a "Free" plan.
        *   It dynamically fetches the "Free" plan ID from the `subscription_plans` table.
        *   It then `upserts` the user's record in `user_subscriptions` (based on `user_id`) to this "Free" plan, setting the status to `'free'`, nullifying Stripe-specific IDs, resetting usage, and setting `current_period_start` to the current time and `current_period_end` to 30 days after the start to satisfy database constraints.
        *   If `user_id` is missing from metadata or the "Free" plan cannot be found, it logs an error and attempts a fallback to simply mark the subscription as `'canceled'`.
    *   Returns a `200 OK` to Stripe.

### 3.3. `manage-stripe-subscription`

*   **Purpose:** Generates a secure link to the Stripe Customer Portal, allowing users to manage their payment methods, view invoices, or cancel their subscriptions.
*   **Trigger:** Called by the frontend, typically when a user clicks a "Manage Billing" or "Manage Subscription" button in their account settings.
*   **Input:** User's JWT (for authentication).
*   **Logic Flow:**
    1.  Authenticates the user using their JWT.
    2.  Retrieves the `user_id` from the authenticated user.
    3.  Fetches the `stripe_customer_id` from the `user_subscriptions` table for the given `user_id`.
    4.  If a `stripe_customer_id` is found, it calls the Stripe API (`stripe.billingPortal.sessions.create`) to create a new Billing Portal session for that customer.
        *   Specifies a `return_url` which is a page within the FlameDeck application (e.g., `/settings/billing`) where the user will be redirected after they are done with the Stripe portal.
    5.  Returns the `url` from the created Stripe Billing Portal session to the client.
    6.  The client then redirects the user to this Stripe-hosted URL.
*   **Error Handling:**
    *   Returns a 401 error if the user is not authenticated.
    *   Returns a 404 error if no `stripe_customer_id` is found for the user (e.g., they don't have an active or past paid subscription).
    *   Returns a 500 error for other server-side issues or problems creating the Stripe session.

## 4. Frontend Interaction

*   **Pricing Page (`PricingTable.tsx`) & Upgrade Modal (`UpgradeModal.tsx`):**
    *   "Upgrade to Pro" / "Get Started" buttons on the `PricingTable.tsx`:
        *   The "Pro" tier's "Get Started" button is now active.
        *   When clicked, it stores `flamedeck_selected_plan: 'pro'` in `sessionStorage` to indicate the user's intent.
        *   It then redirects the user to the login page (or sign-up flow).
    *   The `UpgradeModal.tsx` is used for in-app upgrades when the user is already logged in and browsing the application.
    *   Both initiate a call to the `create-stripe-checkout-session` Edge Function, passing the Pro plan's ID and the current path as `returnPath` (for the modal) or a default path (for the new onboarding flow) for the cancel/success URL construction.
    *   On receiving the session ID/URL, redirects the user to Stripe Checkout using `@stripe/stripe-js`.
*   **Payment Outcome Pages (`PaymentSuccessPage.tsx`, `PaymentCancelPage.tsx`):**
    *   Routed in `App.tsx` and wrapped in `Layout` and `AuthGuard`.
    *   Display appropriate messages to the user after Stripe redirect.
*   **Sidebar (`Sidebar.tsx` & `SidebarActionButtons.tsx`):**
    *   (In Progress) Uses `useUserSubscription` hook to fetch user's subscription status.
    *   (In Progress) `SidebarActionButtons.tsx` conditionally renders "Upload Trace" or "Upgrade to Pro" button based on subscription status (`isProUser`).
*   **(TODO) Manage Subscription Button:**
    *   Button in user settings (e.g., "Manage Billing").
    *   Calls a (TODO) `manage-stripe-subscription` Edge Function.
    *   Redirects user to the Stripe Customer Portal.

### 4.3. Onboarding Upgrade Step (`OnboardingUpgradeStep.tsx`)

*   **Purpose:** Provides a dedicated page during the onboarding flow for users who selected the "Pro" plan before signing up/logging in.
*   **Trigger:** After a user signs up and completes the username selection step, `ProtectedRoute.tsx` checks for `sessionStorage.getItem('flamedeck_selected_plan') === 'pro'`.
    *   If the flag is set and the user is not currently a Pro member (checked via `useUserSubscription`), they are redirected to `/onboarding/upgrade`.
    *   If the flag is set but the user *is* already a Pro member (e.g., they paid, then logged back in, or upgraded through another means), `ProtectedRoute.tsx` clears the `sessionStorage` flag to prevent repeated redirects.
*   **Logic Flow:**
    1.  The `OnboardingUpgradeStep.tsx` page mounts and re-verifies the `sessionStorage` flag and the user's current subscription status. If the flag is not 'pro', or if the user is already a Pro member, it clears the flag and navigates the user to the main application (e.g., `/traces`).
    2.  If the conditions to show the upgrade prompt are met, it renders a UI similar to `UpgradeModal.tsx`, presenting the Pro plan features and price.
    3.  **"Upgrade to Pro" action:**
        *   Clears the `flamedeck_selected_plan` from `sessionStorage`.
        *   Calls the `create-stripe-checkout-session` Edge Function (similar to `UpgradeModal.tsx`).
        *   Redirects the user to Stripe Checkout. The success URL will typically lead them into the main application.
    4.  **"Maybe Later" action:**
        *   Clears the `flamedeck_selected_plan` from `sessionStorage`.
        *   Navigates the user to the main application (e.g., `/traces`).
*   **State Management:** The `flamedeck_selected_plan` item in `sessionStorage` is the key to this flow, ensuring the user's initial intent is captured and acted upon post-authentication and initial profile setup. It is cleared once the upgrade is initiated, skipped, or if the user is already subscribed.

## 5. Local Testing Guide

Testing Stripe integration locally requires the Stripe CLI and a way to forward webhook events.

1.  **Install/Login Stripe CLI.**
2.  **Run Supabase Locally/Deploy Functions:** (`create-stripe-checkout-session`, `stripe-webhook-handler --no-verify-jwt`).
3.  **Set Environment Variables:** `STRIPE_SECRET_KEY` for both functions. For `stripe-webhook-handler` also `STRIPE_WEBHOOK_SIGNING_SECRET` (use the one from `stripe listen` for local tests).
4.  **Forward Webhooks with `stripe listen`:**
    ```bash
    stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook-handler --events customer.subscription.created,invoice.payment_succeeded,invoice.payment_failed,customer.subscription.updated,customer.subscription.deleted,checkout.session.completed
    ```
    *   Note the `whsec_...` signing secret from `stripe listen` for your function's env var.
5.  **Trigger Stripe Events:**
    *   New subscription: 
        ```bash
        stripe trigger customer.subscription.created --add 'subscription:items[0].price=your_stripe_test_price_id' --add subscription:metadata.user_id=your_test_user_id --add subscription:metadata.plan_id=your_db_plan_id
        ```
6.  **Observe:** `stripe listen` output (for `200 OK`), Supabase function logs, and `user_subscriptions` table.

## 6. TODOs / Future Work

*   [X] **Backend:** `create-stripe-checkout-session` Edge Function created.
*   [X] **Backend:** `stripe-webhook-handler` Edge Function created (handles key creation/update events).
*   [X] **Database:** Schema updated for `subscription_plans` and `user_subscriptions` (including unique constraints).
*   [X] **Frontend:** `UpgradeModal.tsx` initiates Stripe Checkout with dynamic `cancel_url`.
*   [X] **Frontend:** Basic `PaymentSuccessPage.tsx` and `PaymentCancelPage.tsx` created and routed.
*   [X] **Frontend:** Implement `useUserSubscription` hook for fetching current subscription status.
*   [X] **Frontend:** Implement `SidebarActionButtons.tsx` for conditional UI in `Sidebar.tsx` based on subscription.
*   [X] **Frontend:** Implement UI for "Manage Billing" button to redirect to Stripe Customer Portal. (Implemented in `apps/client/src/pages/settings/BillingPage.tsx`)
*   [X] **Backend:** Create `manage-stripe-subscription` Edge Function to generate Stripe Customer Portal sessions. (Implemented in `supabase/functions/manage-stripe-subscription/index.ts`)
*   [X] **Webhooks:** Test and refine handlers for `customer.subscription.updated` (cancellations, upgrades/downgrades) and `customer.subscription.deleted`. (Initial refinement for `customer.subscription.deleted` to revert to Free plan implemented in `stripe-webhook-handler`)
*   [X] **Onboarding:** Implemented an onboarding upgrade flow:
    *   Pricing table allows selecting "Pro" before login, storing intent in `sessionStorage`.
    *   New `/onboarding/upgrade` page (`OnboardingUpgradeStep.tsx`) prompts for upgrade post-username setup if intent was stored and user is not Pro.
    *   `ProtectedRoute.tsx` handles redirection to this new onboarding step.
*   [ ] **Webhooks:** Add handlers for more events if needed (e.g., `customer.subscription.trial_will_end`, disputes, refunds).
*   [ ] **Plans:** UI for users to select different plans if multiple paid tiers are offered (if applicable beyond Pro).
*   [ ] **Error Handling:** More robust error handling and user feedback across all Stripe-related interactions.
*   [ ] **Security:** Full security review of the entire flow.
*   [ ] **RLS:** Update Supabase Row Level Security policies to gate application features based on data in `user_subscriptions`.
*   [ ] **Testing:** Write automated tests for Edge Functions and critical frontend flows.
*   [ ] **Production Setup:** Ensure live Stripe keys and webhook secret (from Stripe Dashboard) are used for production deployment.
*   [ ] **Refine `delete-user` function:** Ensure the logic for identifying a "non-free" plan in the subscription check is robust and matches your plan setup precisely.