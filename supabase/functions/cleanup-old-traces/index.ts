import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Check authentication (verify scheduler secret)
  const authHeader = req.headers.get("Authorization");

  if (
    !authHeader || authHeader !== `Bearer ${Deno.env.get("CLEANUP_SECRET")}`
  ) {
    console.error(
      "Unauthorized access attempt. Header vs Env:",
      authHeader,
      Deno.env.get("CLEANUP_SECRET"),
    );
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      // Create client with Auth context of the user that called the function.
      // This way your row-level-security (RLS) policies are applied.
      // { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      // Using SERVICE_ROLE_KEY for cleanup, bypassing RLS as we need to delete across users.
    );

    // Calculate the cutoff date based on NOW()
    const nowTimestamp = new Date().toISOString();

    console.log(`Looking for traces where expires_at <= ${nowTimestamp}`);

    // 1. Fetch expired traces based on expires_at column
    const { data: expiredTraces, error: fetchError } = await supabaseClient
      .from("traces")
      .select("id, blob_path")
      .lte("expires_at", nowTimestamp); // Find traces where expires_at is in the past or now

    if (fetchError) {
      console.error("Error fetching expired traces:", fetchError);
      throw fetchError;
    }

    if (!expiredTraces || expiredTraces.length === 0) {
      console.log("No expired traces found to delete.");
      return new Response(
        JSON.stringify({ message: "No expired traces found." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    console.log(`Found ${expiredTraces.length} expired traces to delete.`);

    const traceIdsToDelete = expiredTraces.map((trace: { id: string }) =>
      trace.id
    );
    const blobPathsToDelete = expiredTraces
      .map((trace: { blob_path: string | null }) => trace.blob_path)
      .filter((path: string | null): path is string =>
        path !== null && path !== ""
      );

    // 2. Delete associated storage objects
    if (blobPathsToDelete.length > 0) {
      console.log("Deleting storage objects:", blobPathsToDelete);
      const { data: storageData, error: storageError } = await supabaseClient
        .storage
        .from("traces") // Assuming your bucket is named 'traces'
        .remove(blobPathsToDelete);

      if (storageError) {
        console.error("Error deleting storage objects:", storageError);
        // Decide if you want to proceed deleting DB entries even if storage deletion fails
        // For now, we'll log the error and continue
      } else {
        console.log("Storage objects deleted successfully:", storageData);
      }
    }

    // 3. Delete trace records from the database (cascade should handle comments/permissions)
    console.log("Deleting trace records from database:", traceIdsToDelete);
    const { error: deleteError } = await supabaseClient
      .from("traces")
      .delete()
      .in("id", traceIdsToDelete);

    if (deleteError) {
      console.error("Error deleting trace records:", deleteError);
      throw deleteError;
    }

    console.log(
      `Successfully deleted ${traceIdsToDelete.length} trace records.`,
    );

    return new Response(
      JSON.stringify({
        message: `Successfully deleted ${traceIdsToDelete.length} traces.`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Unhandled error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
