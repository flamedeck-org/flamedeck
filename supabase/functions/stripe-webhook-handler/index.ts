// TEMPORARY DEBUGGING - DO NOT USE IN PRODUCTION
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'stripe'; // Deno should resolve this via npm specifier or import map

// Get environment variables
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SIGNING_SECRET = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SIGNING_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing one or more required environment variables for Stripe webhook handler.');
  // In a real scenario, you might not want to start the server or handle this more gracefully.
}

const stripe = new Stripe(STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text(); // Read body as text for signature verification

  let event: Stripe.Event;

  try {
    if (!signature) {
      throw new Error('Stripe-Signature header is missing');
    }
    if (!STRIPE_WEBHOOK_SIGNING_SECRET) {
      throw new Error('Webhook signing secret is not configured.');
    }
    event = await stripe.webhooks.constructEventAsync(
      body, // Pass the raw request body (text)
      signature,
      STRIPE_WEBHOOK_SIGNING_SECRET
    );
  } catch (err) {
    console.error(`? Webhook signature verification failed: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log('? Stripe Webhook event received:', event.type, event.id);

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Handling checkout.session.completed for session ID:', session.id);

      // Metadata should contain user_id and plan_id you set during checkout creation
      const userId = session.metadata?.user_id;
      const planId = session.metadata?.plan_id;
      const stripeSubscriptionId = session.subscription;
      const stripeCustomerId = session.customer;
      const paymentStatus = session.payment_status;

      if (paymentStatus === 'paid') {
        if (!userId || !planId || !stripeSubscriptionId || !stripeCustomerId) {
          console.error(
            'Missing critical metadata (user_id, plan_id) or IDs (subscription, customer) in checkout.session.completed event.',
            session.metadata,
            session.subscription,
            session.customer
          );
          return new Response('Webhook Error: Missing critical data in event payload.', { status: 400 });
        }

        try {
          // Retrieve the subscription details to get period start/end
          const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId as string);

          const { error: upsertError } = await supabaseAdmin
            .from('user_subscriptions')
            .upsert(
              {
                user_id: userId,
                plan_id: planId,
                stripe_subscription_id: stripeSubscriptionId as string,
                stripe_customer_id: stripeCustomerId as string,
                status: subscription.status, // Use status from the subscription object (e.g., 'active', 'trialing')
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                cancel_at_period_end: subscription.cancel_at_period_end,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'user_id',
              }
            );

          if (upsertError) {
            console.error('Supabase upsert error for user_subscriptions (checkout.session.completed):', upsertError);
            return new Response(`Webhook Database Error: ${upsertError.message}`, { status: 500 });
          }
          console.log(`Successfully processed checkout.session.completed for user ${userId}, subscription ${stripeSubscriptionId}`);
        } catch (processingError) {
          console.error('Error processing checkout.session.completed and updating database:', processingError);
          return new Response(`Webhook Processing Error: ${processingError.message}`, { status: 500 });
        }
      } else {
        console.log(`Checkout session ${session.id} payment_status is ${paymentStatus}, not processing subscription.`);
      }
      break;
    }

    case 'customer.subscription.created': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log('Handling customer.subscription.created for subscription ID:', subscription.id);
      const userId = subscription.metadata?.user_id;
      const planId = subscription.metadata?.plan_id;

      if (!userId || !planId) {
        console.error('Missing user_id or plan_id in customer.subscription.created metadata.', subscription.metadata);
        return new Response('Webhook Error: Missing critical metadata in subscription.', { status: 400 });
      }

      const { error: upsertError } = await supabaseAdmin
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          plan_id: planId,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string,
          status: subscription.status,
          current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : new Date().toISOString(),
          current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id', // Assumes one active subscription per user. Consider stripe_subscription_id if multiple allowed.
        });

      if (upsertError) {
        console.error('Supabase upsert error for user_subscriptions (customer.subscription.created):', upsertError);
        return new Response(`Webhook Database Error: ${upsertError.message}`, { status: 500 });
      }
      console.log(`Successfully processed customer.subscription.created for user ${userId}, subscription ${subscription.id}`);
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log('Handling invoice.payment_succeeded for invoice ID:', invoice.id);

      let stripeSubscriptionId: string | null | undefined = invoice.subscription as string | null;
      if (!stripeSubscriptionId && invoice.lines && invoice.lines.data.length > 0) {
        const firstLineItem = invoice.lines.data[0];
        if (firstLineItem.parent?.type === 'subscription_item_details') {
          stripeSubscriptionId = firstLineItem.parent.subscription_item_details?.subscription;
        } else if (firstLineItem.subscription) {
          stripeSubscriptionId = firstLineItem.subscription;
        }
      }
      if (!stripeSubscriptionId && invoice.parent?.type === 'subscription_details') {
        stripeSubscriptionId = invoice.parent.subscription_details?.subscription;
      }

      if (stripeSubscriptionId && (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_create')) {
        const stripeCustomerId = invoice.customer as string; // Customer ID should be on the invoice

        console.log(`DEBUG: invoice.payment_succeeded: stripeSubscriptionId found: ${stripeSubscriptionId}`);

        const subscriptionFromStripe = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        console.log('DEBUG: Retrieved subscription object (from stripe.subscriptions.retrieve):', JSON.stringify(subscriptionFromStripe, null, 2));

        const updateData: any = {
          status: subscriptionFromStripe.status,
          current_period_start: subscriptionFromStripe.current_period_start ? new Date(subscriptionFromStripe.current_period_start * 1000).toISOString() : new Date().toISOString(),
          current_period_end: subscriptionFromStripe.current_period_end ? new Date(subscriptionFromStripe.current_period_end * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancel_at_period_end: subscriptionFromStripe.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        };

        if (invoice.billing_reason === 'subscription_create') {
          // For subscription_create, we primarily rely on customer.subscription.created to insert the full record with user_id and plan_id.
          // This handler will ensure the status and period dates are up-to-date.
          // We will attempt an upsert, but critical fields like user_id/plan_id come from the subscription metadata ideally.
          // If they are missing here, it implies they should have been set by customer.subscription.created handler.

          // Attempt to get user_id and plan_id from the retrieved subscription's metadata as a fallback for the upsert.
          const userIdFromSub = subscriptionFromStripe.metadata?.user_id;
          const planIdFromSub = subscriptionFromStripe.metadata?.plan_id;

          if (!userIdFromSub || !planIdFromSub) {
            console.warn(`WARN: invoice.payment_succeeded (subscription_create): user_id or plan_id missing from retrieved subscription metadata. Sub ID: ${stripeSubscriptionId}. This might indicate an issue if customer.subscription.created didn't run or also missed metadata.`);
            // Not returning a hard error here, as customer.subscription.created is the primary creator.
          }

          const { error } = await supabaseAdmin
            .from('user_subscriptions')
            .upsert({
              user_id: userIdFromSub, // Best effort from retrieved subscription
              plan_id: planIdFromSub, // Best effort from retrieved subscription
              stripe_subscription_id: stripeSubscriptionId,
              stripe_customer_id: stripeCustomerId,
              ...updateData
            }, {
              onConflict: 'user_id' // Align with customer.subscription.created if user_id is the unique key
            });
          if (error) {
            console.error('Supabase upsert error for invoice.payment_succeeded (subscription_create):', error);
            return new Response(`Webhook Database Error: ${error.message}`, { status: 500 });
          }
          console.log(`Successfully upserted/updated subscription ${stripeSubscriptionId} from invoice (subscription_create).`);
        } else { // subscription_cycle
          const { error } = await supabaseAdmin
            .from('user_subscriptions')
            .update(updateData)
            .eq('stripe_subscription_id', stripeSubscriptionId);
          if (error) {
            console.error('Supabase update error for invoice.payment_succeeded (subscription_cycle):', error);
            return new Response(`Webhook Database Error: ${error.message}`, { status: 500 });
          }
          console.log(`Successfully updated subscription ${stripeSubscriptionId} from invoice (subscription_cycle).`);
        }
      } else {
        console.log('invoice.payment_succeeded was not for a subscription cycle or creation, or no subscription ID found. Invoice:', invoice.id, 'Billing Reason:', invoice.billing_reason);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log('Handling invoice.payment_failed for invoice ID:', invoice.id);
      if (invoice.subscription) {
        const stripeSubscriptionId = invoice.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

        const { error } = await supabaseAdmin
          .from('user_subscriptions')
          .update({
            status: subscription.status,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', stripeSubscriptionId);

        if (error) {
          console.error('Supabase update error for invoice.payment_failed:', error);
          return new Response(`Webhook Database Error: ${error.message}`, { status: 500 });
        }
        console.log(`Subscription ${stripeSubscriptionId} status updated due to payment failure.`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log('Handling customer.subscription.updated for subscription ID:', subscription.id);
      const userId = subscription.metadata?.user_id;
      const planId = subscription.metadata?.plan_id;

      // It's possible that on plan changes, user_id/plan_id metadata might not be on the subscription object itself,
      // but on the price or product. For simplicity, we assume it's on the subscription metadata here.
      // If not, you might need to fetch the subscription items and their prices to get your internal planId.
      if (!userId || !planId) {
        console.warn(`customer.subscription.updated event for ${subscription.id} is missing user_id or plan_id in metadata. Update will only use Stripe IDs.`);
      }

      const { error } = await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: subscription.status,
          current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : new Date().toISOString(),
          current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id);
      if (error) {
        console.error('Supabase update error for customer.subscription.updated:', error);
        return new Response(`Webhook Database Error: ${error.message}`, { status: 500 });
      }
      console.log(`Successfully updated subscription ${subscription.id} via customer.subscription.updated event.`);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id; // Get user_id from metadata
      const stripeCustomerId = subscription.customer as string;

      console.log(`Handling customer.subscription.deleted for subscription ID: ${subscription.id}, User ID: ${userId}`);

      if (!userId) {
        console.error('Missing user_id in customer.subscription.deleted metadata. Cannot revert to free plan.', subscription.metadata);
        // Fallback: Mark as canceled without reverting, or handle as an error needing investigation
        const { error: updateError } = await supabaseAdmin
          .from('user_subscriptions')
          .update({
            status: 'canceled', // Explicitly set to canceled
            updated_at: new Date().toISOString(),
            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
        if (updateError) {
          console.error('Supabase update error (fallback) for customer.subscription.deleted:', updateError);
          return new Response(`Webhook Database Error: ${updateError.message}`, { status: 500 });
        }
        console.warn(`Subscription ${subscription.id} marked as canceled but could not revert to free plan due to missing user_id.`);
        return new Response(JSON.stringify({ received: true, warning: "Could not revert to free plan due to missing user_id" }), { status: 200 });
      }

      // 1. Fetch the Free Plan ID from subscription_plans table
      const { data: freePlanData, error: freePlanError } = await supabaseAdmin
        .from('subscription_plans')
        .select('id')
        .eq('name', 'free')
        .single();

      if (freePlanError || !freePlanData) {
        console.error('Error fetching Free plan details or Free plan not found:', freePlanError?.message);
        // Critical error: Free plan isn't defined in the database.
        // You might want to return 500 here to Stripe so it retries, or handle as per your alerting policies.
        return new Response('Webhook Configuration Error: Free plan not found in database.', { status: 500 });
      }

      const freePlanId = freePlanData.id;

      // 2. Upsert the user's subscription to the Free plan
      // This will update the existing row (matched by user_id) or insert if somehow no row exists for the user.
      const newPeriodStart = new Date();
      const newPeriodEnd = new Date(newPeriodStart);
      newPeriodEnd.setDate(newPeriodStart.getDate() + 30);

      const { error: upsertError } = await supabaseAdmin
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          plan_id: freePlanId,
          stripe_customer_id: stripeCustomerId, // Keep customer ID for potential re-subscription
          stripe_subscription_id: null, // This Stripe subscription is deleted
          status: 'free', // Set status to 'free'
          current_period_start: newPeriodStart.toISOString(), // Set to current time
          current_period_end: newPeriodEnd.toISOString(), // Set to 30 days after start
          cancel_at_period_end: false,
          canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : new Date().toISOString(),
          monthly_uploads_used: 0, // Reset usage for the new (free) period
          // Note: total_trace_limit is on the plan, monthly_upload_limit also on the plan. No need to set here if your usage RPC gets them from plan.
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id', // This is key: it finds the row by user_id and updates it
        });

      if (upsertError) {
        console.error('Supabase upsert error (reverting to free) for customer.subscription.deleted:', upsertError);
        return new Response(`Webhook Database Error: ${upsertError.message}`, { status: 500 });
      }
      console.log(`User ${userId} reverted to Free plan (ID: ${freePlanId}) after subscription ${subscription.id} was deleted.`);
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
