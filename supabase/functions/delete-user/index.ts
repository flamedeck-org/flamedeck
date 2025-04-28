// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import { corsHeaders } from "../_shared/cors.ts"

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
      // List all buckets (we'll need to clean up objects in all buckets)
      const { data: buckets, error: bucketsError } = await supabaseAdmin
        .storage
        .listBuckets();

      if (bucketsError) {
        throw new Error(`Error listing buckets: ${bucketsError.message}`);
      }

      // Process all buckets in parallel
      await Promise.all((buckets || []).map(async (bucket) => {
        console.log(`Checking bucket ${bucket.name} for user files`);
        
        // List all objects in the bucket owned by the user
        const { data: objects, error: objectsError } = await supabaseAdmin
          .storage
          .from(bucket.name)
          .list("", {
            limit: 1000, // Adjust as needed, might need pagination for many files
            search: userId, // This is a simple approach - you might need a more complex query
          });

        if (objectsError) {
          console.error(`Error listing objects in bucket ${bucket.name}: ${objectsError.message}`);
          return; // Skip this bucket and continue with others
        }

        // Collect paths of objects to delete
        const objectsToDelete = (objects || [])
          .filter(object => object.metadata?.owner === userId || object.name.includes(userId))
          .map(object => object.name);
        
        if (objectsToDelete.length > 0) {
          console.log(`Deleting ${objectsToDelete.length} objects from bucket ${bucket.name}`);
          
          const { error: deleteError } = await supabaseAdmin
            .storage
            .from(bucket.name)
            .remove(objectsToDelete);

          if (deleteError) {
            console.error(`Error deleting objects from ${bucket.name}: ${deleteError.message}`);
          }
        } else {
          console.log(`No objects to delete in bucket ${bucket.name}`);
        }
      }));
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