// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'; // Import createClient directly
import Stripe from 'stripe'; // Ensure this matches your import_map.json or Deno setup

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const FLAMEDECK_URL = Deno.env.get('FLAMEDECK_URL') || 'http://localhost:8080'; // Use env var or fallback to localhost for dev

if (!STRIPE_SECRET_KEY) {
  console.error('Stripe secret key not set in environment variables.');
}

const stripe = new Stripe(STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil',
  httpClient: Stripe.createFetchHttpClient(), // Recommended for Deno
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase URL and Service Role Key from environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables for URL or Service Role Key');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Extract Authorization header to pass to Supabase client for user context
    const authHeader = req.headers.get('Authorization');

    const clientOptions = {
      global: { headers: {} as Record<string, string> },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false, // Recommended for server-side
      },
    };

    if (authHeader) {
      clientOptions.global.headers['Authorization'] = authHeader;
    }

    // Create Supabase client directly
    const supabaseClient: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, clientOptions);

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('User not authenticated:', userError?.message);
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { planId, returnPath } // Expect returnPath from the client
      = await req.json();

    if (!planId) {
      return new Response(JSON.stringify({ error: 'planId is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 1. Fetch the stripe_price_id from your subscription_plans table
    const { data: planData, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('stripe_price_id, name')
      .eq('id', planId) // Assuming your planId is the primary key 'id'
      .single();

    if (planError || !planData || !planData.stripe_price_id) {
      console.error('Plan not found or stripe_price_id missing:', planError?.message, planData);
      return new Response(JSON.stringify({ error: 'Plan not found or misconfigured.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const stripePriceId = planData.stripe_price_id;

    // 2. Get or create Stripe Customer
    // Check if user already has a stripe_customer_id in user_subscriptions
    let { data: existingSubscription, error: subscriptionError } = await supabaseClient
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle(); // Use maybeSingle as user might not have a subscription record yet

    if (subscriptionError && subscriptionError.code !== 'PGRST116') { // PGRST116: no rows found, which is fine here
      console.error('Error fetching existing subscription:', subscriptionError.message);
      throw subscriptionError;
    }

    let stripeCustomerId = existingSubscription?.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email, // Supabase user email
        metadata: {
          user_id: user.id,
        },
      });

      stripeCustomerId = customer.id;

      // Optionally: Store the new stripeCustomerId in your user_profiles or user_subscriptions table immediately.
      // For now, we'll let the webhook handle the full subscription record creation.
      // However, it can be useful to store it right away if the user abandons checkout
      // and you want to link them later.
      // Example:
      // const { error: updateError } = await supabaseClient
      //   .from('user_profiles') // Or user_subscriptions
      //   .update({ stripe_customer_id: stripeCustomerId })
      //   .eq('id', user.id);
      // if (updateError) console.error('Error updating user with stripe_customer_id:', updateError);
    }

    // Determine the cancel_url
    const defaultCancelUrl = FLAMEDECK_URL; // Or your app's dashboard like /traces
    const cancelUrl = returnPath ? `${FLAMEDECK_URL}${returnPath.startsWith('/') ? returnPath : '/' + returnPath}` : defaultCancelUrl;

    // 3. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${FLAMEDECK_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl, // Use the dynamic cancelUrl
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: planId, // Your internal plan ID
          plan_name: planData.name, // For easier debugging in Stripe dashboard
        },
      },
      // You can also enable promotions if you have coupon codes
      // allow_promotion_codes: true,
    });

    if (!session.url) {
      console.error('Stripe session URL not found');
      return new Response(JSON.stringify({ error: 'Could not create checkout session.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ sessionId: session.id, checkoutUrl: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error creating Stripe checkout session:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});