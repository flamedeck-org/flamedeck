// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import { corsHeaders } from "../_shared/cors.ts"

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
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      }
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
      }
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
        }
      );
    }

    // Get the authenticated user's ID
    const userId = user.id;
    console.log(`Deleting user ${userId} and their storage objects`);

    // Step 1: Delete all user's storage objects
    try {
      // Fetch all traces owned by the user from the database
      const { data: traces, error: tracesError } = await supabaseAdmin
        .from('traces')
        .select('id, blob_path')
        .eq('user_id', userId);

      if (tracesError) {
        throw new Error(`Error fetching user traces: ${tracesError.message}`);
      }

      console.log(`Found ${traces?.length || 0} traces for user ${userId}`);

      // Efficiently process trace deletions in parallel batches
      if (traces && traces.length > 0) {
        const BUCKET_NAME = 'traces'; // All traces are in the 'traces' bucket
        const BATCH_SIZE = 100; // Process in batches of 100 files
        
        // Get all file paths (removing the 'traces/' prefix if needed)
        const filePaths = traces.map(trace => {
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
            console.log(`Deleting batch ${index + 1}/${batches.length} (${batch.length} files)`);
            
            const { error: deleteError } = await supabaseAdmin
              .storage
              .from(BUCKET_NAME)
              .remove(batch);
              
            if (deleteError) {
              console.error(`Error deleting batch ${index + 1}: ${deleteError.message}`);
              return { success: false, error: deleteError.message };
            }
            
            return { success: true, count: batch.length };
          })
        );
        
        // Log results
        const successfulBatches = deleteResults.filter(r => r.success).length;
        console.log(`Successfully processed ${successfulBatches}/${batches.length} batches`);
      } else {
        console.log(`No traces found for user ${userId}`);
      }
    } catch (error) {
      console.error("Error deleting storage objects:", error);
      return new Response(
        JSON.stringify({ 
          error: "Failed to delete storage objects", 
          details: error.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Delete the user
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to delete user", 
          details: deleteUserError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Server error", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});