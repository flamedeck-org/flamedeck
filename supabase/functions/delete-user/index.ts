// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders } from "../_shared/cors.ts";

interface TraceData {
  id: string;
  blob_path: string;
}

Deno.serve(async (req) => {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    // Handle POST request
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a Supabase client with the Auth context of the logged in user
    const authorizationHeader = req.headers.get("Authorization");
    if (!authorizationHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create a Supabase client with Supabase service role key (for admin operations)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Create a Supabase client with the user's JWT
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: authorizationHeader,
          },
        },
      },
    );

    // Verify the user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: userError }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userId = user.id;

    // #### START SUBSCRIPTION CHECK ####
    console.log(`Checking active subscriptions for user ${userId} before deletion.`);
    const {
      data: activeSubscription,
      error: subscriptionError,
    } = await supabaseAdmin
      .from('user_subscriptions')
      .select(`
        status,
        subscription_plans (name)
      `)
      .eq('user_id', userId)
      // We are interested in any subscription that is 'active' or 'trialing' and not a known free plan.
      // If your free plan has a specific name like 'free' or 'Free Tier' in subscription_plans table, use that.
      // This example assumes the free plan is identified by its name not being one of the paid ones, 
      // or more directly, checking if plan_id corresponds to a non-zero price plan.
      // For simplicity, let's assume a paid plan has a name NOT LIKE 'Free%'. 
      // A more robust check would be on subscription_plans.price_monthly > 0 or a specific is_free_plan boolean.
      .in('status', ['active', 'trialing']) // Check for active or trialing states
      .maybeSingle(); // A user might have one or zero relevant subscriptions

    if (subscriptionError) {
      console.error("Error checking user subscription:", subscriptionError);
      return new Response(
        JSON.stringify({
          error: "Failed to check user subscription status",
          details: subscriptionError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (activeSubscription) {
      // Access the plan name via the joined table data
      const planName = activeSubscription.subscription_plans?.name;
      // Define what constitutes a "non-free" plan. This might be checking if planName is not 'Free',
      // or if you had a price on subscription_plans, checking if price > 0.
      // For this example, we'll assume any plan that is not explicitly named 'Free' (case-insensitive) is paid.
      const isPaidPlan = planName && planName.toLowerCase() !== 'free';

      if (isPaidPlan) {
        console.log(
          `User ${userId} has an active non-free subscription (${planName}). Deletion aborted.`,
        );
        return new Response(
          JSON.stringify({
            error:
              "It looks like you have an active subscription. Please cancel the subscription before deleting the account.",
          }),
          {
            status: 403, // Forbidden
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }
    console.log(`No active non-free subscriptions found for user ${userId}. Proceeding with deletion.`);
    // #### END SUBSCRIPTION CHECK ####

    console.log(`Deleting user ${userId} and their storage objects`);

    // Step 1: Delete all user's storage objects
    try {
      // Fetch all traces owned by the user from the database
      const { data: traces, error: tracesError } = await supabaseAdmin
        .from("traces")
        .select("id, blob_path")
        .eq("user_id", userId);

      if (tracesError) {
        throw new Error(`Error fetching user traces: ${tracesError.message}`);
      }

      console.log(`Found ${traces?.length || 0} traces for user ${userId}`);

      // Efficiently process trace deletions in parallel batches
      if (traces && traces.length > 0) {
        const BUCKET_NAME = "traces"; // All traces are in the 'traces' bucket
        const BATCH_SIZE = 100; // Process in batches of 100 files

        // Get all file paths (removing the 'traces/' prefix if needed)
        const filePaths = traces.map((trace) => {
          // Ensure we're using the correct path format for the storage API
          // If blob_path already contains 'traces/', we want just the path part after the bucket name
          return trace.blob_path.startsWith(`${BUCKET_NAME}/`)
            ? trace.blob_path.substring(BUCKET_NAME.length + 1) // +1 for the slash
            : trace.blob_path;
        });

        // Split into batches
        const batches: string[][] = [];
        for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
          batches.push(filePaths.slice(i, i + BATCH_SIZE));
        }

        console.log(`Processing ${batches.length} batches in parallel`);

        // Process all batches in parallel
        const deleteResults = await Promise.all(
          batches.map(async (batch, index) => {
            console.log(
              `Deleting batch ${index + 1
              }/${batches.length} (${batch.length} files)`,
            );

            const { error: deleteError } = await supabaseAdmin
              .storage
              .from(BUCKET_NAME)
              .remove(batch);

            if (deleteError) {
              console.error(
                `Error deleting batch ${index + 1}: ${deleteError.message}`,
              );
              return { success: false, error: deleteError.message };
            }

            return { success: true, count: batch.length };
          }),
        );

        // Log results
        const successfulBatches = deleteResults.filter((r) => r.success).length;
        console.log(
          `Successfully processed ${successfulBatches}/${batches.length} batches`,
        );
      } else {
        console.log(`No traces found for user ${userId}`);
      }
    } catch (error) {
      console.error("Error deleting storage objects:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to delete storage objects",
          details: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Step 2: Delete the user
    const { error: deleteUserError } = await supabaseAdmin.auth.admin
      .deleteUser(userId);

    if (deleteUserError) {
      return new Response(
        JSON.stringify({
          error: "Failed to delete user",
          details: deleteUserError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "User and all associated data deleted successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Server error", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
