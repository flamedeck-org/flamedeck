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
    *   `user_id` (uuid): Foreign key to `user_profiles.id` (or `auth.users.id`).
    *   `plan_id` (uuid): Foreign key to `subscription_plans.id`.
    *   `stripe_customer_id` (text): The Stripe Customer ID.
    *   `stripe_subscription_id` (text): The Stripe Subscription ID. This is the primary link to the subscription in Stripe.
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
*   **Input:** `planId` (your internal plan ID), user's JWT (for authentication).
*   **Logic Flow:**
    1.  Authenticates the user using their JWT.
    2.  Retrieves the `stripe_price_id` from the `subscription_plans` table based on the provided `planId`.
    3.  Retrieves the user's email from Supabase Auth.
    4.  Checks if the user already has a `stripe_customer_id` in `user_subscriptions`. 
        *   If yes, uses it.
        *   If no, creates a new Stripe Customer object using the user's email and stores the new `stripe_customer_id` (this can also be deferred to the webhook after successful checkout).
    5.  Creates a Stripe Checkout Session with:
        *   `customer`: The Stripe Customer ID.
        *   `mode`: 'subscription'.
        *   `line_items`: Containing the `stripe_price_id`.
        *   `success_url`: Redirect URL for successful payment (e.g., `YOUR_APP_URL/payment-success?session_id={CHECKOUT_SESSION_ID}`).
        *   `cancel_url`: Redirect URL for canceled payment (e.g., `YOUR_APP_URL/pricing`).
        *   `subscription_data.metadata`: Includes your internal `user_id` and `plan_id` to be available in webhook events.
    6.  Returns the Stripe Checkout Session ID and URL to the client.

### 3.2. `stripe-webhook-handler`

*   **Purpose:** Listens for and processes webhook events from Stripe to keep the local database (`user_subscriptions`) in sync with Stripe.
*   **Trigger:** HTTP POST requests from Stripe to a public endpoint (`YOUR_SUPABASE_URL/functions/v1/stripe-webhook-handler`).
*   **Security:** Verifies the `Stripe-Signature` header using your Stripe Webhook Signing Secret to ensure requests are genuinely from Stripe. Deployed with `--no-verify-jwt` as it's a public endpoint secured by signature.
*   **Logic Flow (handles various event types):**
    *   **`customer.subscription.created`**: (Primary handler for new subscriptions)
        *   Extracts `user_id` and `plan_id` from `subscription.metadata`.
        *   Extracts Stripe subscription ID, customer ID, status, period start/end.
        *   Upserts a record into `user_subscriptions` using `stripe_subscription_id` or `user_id` as the conflict target.
    *   **`checkout.session.completed`**: 
        *   If `payment_status` is `paid` and `mode` was `subscription`.
        *   Primarily a fallback or secondary confirmation. Relies on metadata `user_id` and `plan_id` from the session.
        *   The `customer.subscription.created` event is generally preferred for the initial insert due to more direct access to subscription metadata.
    *   **`invoice.payment_succeeded`**:
        *   If `billing_reason` is `subscription_create` or `subscription_cycle`.
        *   Retrieves the full subscription details from Stripe using the subscription ID from the invoice.
        *   Updates `status`, `current_period_start`, `current_period_end` in `user_subscriptions`.
        *   If `subscription_create`, it can also act as an upsert mechanism if `customer.subscription.created` was somehow missed, using metadata from the retrieved Stripe Subscription object.
    *   **`invoice.payment_failed`**:
        *   Retrieves the Stripe Subscription.
        *   Updates `status` (e.g., to `past_due`) in `user_subscriptions`.
        *   (TODO: Notify user).
    *   **`customer.subscription.updated`**:
        *   Handles changes like plan upgrades/downgrades, cancellations (`cancel_at_period_end` set to true), trial ending.
        *   Updates `plan_id` (if reliably derivable), `status`, `current_period_start`, `current_period_end`, `cancel_at_period_end` in `user_subscriptions`.
    *   **`customer.subscription.deleted`**:
        *   Subscription was fully canceled in Stripe.
        *   Updates `status` to `canceled` and sets `canceled_at` in `user_subscriptions`.
    *   Returns a `200 OK` to Stripe to acknowledge receipt.

## 4. Frontend Interaction

*   **Pricing Page (`PricingTable.tsx`):**
    *   "Get Started" button for Pro plan calls the `create-stripe-checkout-session` Edge Function.
    *   On receiving the session ID, redirects the user to Stripe Checkout using `@stripe/stripe-js`.
*   **Payment Outcome Pages:**
    *   `/payment-success`: Displays a success message.
    *   `/payment-cancel`: Displays a cancellation message.
*   **(TODO) Subscription Status Display:**
    *   Fetch user's subscription status from `user_subscriptions` (via an API endpoint or RPC call).
    *   Conditionally render UI elements (e.g., "Pro" badge, access to features, upgrade prompts) based on status.
*   **(TODO) Manage Subscription Button:**
    *   Button in user settings (e.g., "Manage Billing").
    *   Calls a (TODO) `manage-stripe-subscription` Edge Function to create a Stripe Customer Portal session.
    *   Redirects user to the Stripe Customer Portal.

## 5. Local Testing Guide

Testing Stripe integration locally requires the Stripe CLI and a way to forward webhook events to your local Supabase instance (or a deployed dev instance).

1.  **Install Stripe CLI:** Follow instructions at [https://stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli).
2.  **Login to Stripe CLI:** Run `stripe login` and follow the prompts.
3.  **Run Supabase Locally:** Start your local Supabase stack: `supabase start`.
4.  **Deploy Functions Locally (or to Dev):** Deploy your Edge Functions (`create-stripe-checkout-session`, `stripe-webhook-handler` with `--no-verify-jwt` for the webhook handler) to your local or a dev Supabase instance.
    ```bash
    yarn supabase functions deploy create-stripe-checkout-session
    yarn supabase functions deploy stripe-webhook-handler --no-verify-jwt
    ```
5.  **Set Environment Variables in Supabase:**
    *   For `create-stripe-checkout-session`: `STRIPE_SECRET_KEY` (your Stripe test secret key `sk_test_...`).
    *   For `stripe-webhook-handler`: 
        *   `STRIPE_SECRET_KEY`.
        *   `STRIPE_WEBHOOK_SIGNING_SECRET`: **For local testing with `stripe listen`, this will be a temporary `whsec_...` provided by the `stripe listen` command itself.**
        *   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (usually injected by Supabase environment).
6.  **Forward Webhooks with `stripe listen`:**
    *   In a terminal, run:
        ```bash
        stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook-handler --events checkout.session.completed,customer.subscription.created,invoice.payment_succeeded,invoice.payment_failed,customer.subscription.updated,customer.subscription.deleted
        ```
        (Replace `http://localhost:54321` with your deployed dev function URL if not testing against local Supabase stack).
    *   **Note the `whsec_...` signing secret printed by this command.** Use *this specific secret* for `STRIPE_WEBHOOK_SIGNING_SECRET` in your Supabase function environment variables for this testing session.
7.  **Trigger Stripe Events:**
    *   In another terminal, use `stripe trigger <event_name>`.
    *   Example for new subscription:
        ```bash
        stripe trigger customer.subscription.created --add 'subscription:items[0].price=your_stripe_test_price_id' --add subscription:metadata.user_id=your_test_user_id --add subscription:metadata.plan_id=your_db_plan_id
        ```
        (Replace placeholders with actual test data).
8.  **Observe:**
    *   `stripe listen` terminal for event forwarding status (should be `200 OK`).
    *   Supabase function logs (in local Supabase Studio or deployed dashboard) for processing details and errors.
    *   Your `user_subscriptions` table for data changes.

## 6. TODOs / Future Work

*   [ ] **Frontend:** Implement UI to display current subscription status and plan details.
*   [ ] **Frontend:** Implement UI for "Manage Billing" button to redirect to Stripe Customer Portal.
*   [ ] **Backend:** Create `manage-stripe-subscription` Edge Function to generate Stripe Customer Portal sessions.
*   [ ] **Webhooks:** Add handlers for more events if needed (e.g., `customer.subscription.trial_will_end`, disputes, refunds).
*   [ ] **Plans:** UI for users to select different plans if multiple paid tiers are offered.
*   [ ] **Error Handling:** More robust error handling and retry mechanisms for Stripe API calls and webhook processing.
*   [ ] **Security:** Full security review of the entire flow.
*   [ ] **RLS:** Update Supabase Row Level Security policies to gate application features based on data in `user_subscriptions`.
*   [ ] **Testing:** Write automated tests for Edge Functions.
*   [ ] **Production Setup:** Ensure live Stripe keys and webhook secret (from Stripe Dashboard) are used for production deployment. 