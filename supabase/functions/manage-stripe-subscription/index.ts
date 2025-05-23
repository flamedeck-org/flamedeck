// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const FLAMEDECK_URL = Deno.env.get('FLAMEDECK_URL') || 'http://localhost:8080'; // Use env var or fallback to localhost for dev

if (!STRIPE_SECRET_KEY) {
  console.error('Stripe secret key not set in environment variables.');
}

const stripe = new Stripe(STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil', // Use your desired Stripe API version
  httpClient: Stripe.createFetchHttpClient(), // Recommended for Deno
});

console.log("Manage Stripe Subscription function initialized.");

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables for URL or Service Role Key');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const clientOptions = {
      global: { headers: { Authorization: authHeader } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    };

    const supabaseClient: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, clientOptions);

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('User not authenticated:', userError?.message);
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // 1. Retrieve the user's stripe_customer_id from your user_subscriptions table
    const { data: subscriptionData, error: subscriptionError } = await supabaseClient
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }) // In case of multiple, take the latest
      .limit(1)
      .maybeSingle(); // User might not have a subscription or customer ID

    if (subscriptionError) {
      console.error('Error fetching user subscription:', subscriptionError.message);
      return new Response(JSON.stringify({ error: 'Failed to retrieve subscription details.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!subscriptionData || !subscriptionData.stripe_customer_id) {
      console.log(`User ${user.id} does not have a Stripe customer ID or active subscription.`);
      return new Response(JSON.stringify({ error: 'No active subscription found or Stripe customer ID missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404, // Not Found or 400 Bad Request might be appropriate
      });
    }

    const stripeCustomerId = subscriptionData.stripe_customer_id;

    // 2. Create a Stripe Billing Portal session
    // The return_url is where the user will be redirected after managing their billing
    // It should be a page in your application.
    const returnUrl = `${FLAMEDECK_URL}/settings/billing`; // Example return URL

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    if (!portalSession || !portalSession.url) {
      console.error('Failed to create Stripe Billing Portal session for customer:', stripeCustomerId);
      return new Response(JSON.stringify({ error: 'Could not create billing portal session.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // 3. Return the session URL to the client
    return new Response(JSON.stringify({ portalUrl: portalSession.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in manage-stripe-subscription function:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});