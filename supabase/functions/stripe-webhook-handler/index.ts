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
              onConflict: 'stripe_subscription_id' // More robust: ensure this subscription is uniquely represented
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
      console.log('Handling customer.subscription.deleted for subscription ID:', subscription.id);
      const { error } = await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: subscription.status, // Should be 'canceled'
          updated_at: new Date().toISOString(),
          canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : new Date().toISOString(), // Fallback to now if canceled_at is null
        })
        .eq('stripe_subscription_id', subscription.id);

      if (error) {
        console.error('Supabase update error for customer.subscription.deleted:', error);
        return new Response(`Webhook Database Error: ${error.message}`, { status: 500 });
      }
      console.log(`Subscription ${subscription.id} marked as deleted.`);
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
