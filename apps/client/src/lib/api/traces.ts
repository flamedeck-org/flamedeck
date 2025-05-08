import { ApiError } from "@/types";

import { supabase } from "@/integrations/supabase/client";
import { TraceMetadata, TraceUpload } from "@/types";
import { ApiResponse } from "@/types";
import { PostgrestError } from "@supabase/supabase-js";
import { deleteStorageObject } from "./utils";
import { uploadJson } from "./storage";

 // Get a single trace by ID
 export async function getTrace(id: string): Promise<ApiResponse<TraceMetadata>> {
    try {
      const { data, error } = await supabase
        .from('traces')
        // Select all trace fields and join user_profiles (renamed to owner) via the user_id foreign key
        .select(`
          *,
          owner: user_profiles!user_id ( id, username, avatar_url, first_name, last_name )
        `)
        .eq('id', id)
        .single(); // Use single() as we expect only one trace

      if (error) {
        // Don't automatically throw if owner profile is missing (PGRST116 on join)
        // Let the main catch block handle it, but log the warning
        if (error.code === 'PGRST116' && error.details?.includes('user_profiles')) {
           console.warn(`Owner profile not found for trace ${id}, proceeding without owner info.`);
           // If owner profile is missing, the main query might still succeed but return owner: null
           // If the *main* query fails with PGRST116, the catch block will handle it.
        } else {
           // For other errors from the query, throw them to be caught below
           throw error; 
        } 
      }

      // If data is null *without* an error being thrown above (e.g., owner profile missing but trace exists)
      // or if data exists, return it.
      // The explicit type cast might still be needed depending on how Supabase handles the null owner join
      return { data: data as TraceMetadata | null, error: null };

    } catch (error) {
        console.error(`Error fetching trace details for ${id}:`, error);
        // Check if it's a PostgrestError to extract details
        const apiError: ApiError = {
            message: error instanceof Error ? error.message : "Failed to fetch trace details",
            code: (error as PostgrestError)?.code,
            details: (error as PostgrestError)?.details,
            hint: (error as PostgrestError)?.hint,
        };
        return { data: null, error: apiError };
    }
  }

  // --- NEW: Get Public Trace by ID (using RPC) ---
  export async function getPublicTrace(id: string): Promise<ApiResponse<{ id: string; blob_path: string }>> {
    try {
      // Call the RPC function which enforces RLS for the 'anon' role
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_public_trace_details', { trace_uuid: id });

      if (rpcError) {
        console.error(`RPC error fetching public trace details for ${id}:`, rpcError);
        // Handle potential errors, like function not found, etc.
        throw rpcError;
      }

      // rpcData is an array. If it's empty or null, the trace wasn't found or wasn't public (due to RLS)
      if (!rpcData || rpcData.length === 0) {
        return { data: null, error: { message: "Trace not found or is not public", code: "404" } };
      }

      // The RPC function returns an array, we expect at most one result
      const traceDetails = rpcData[0];

      // Explicitly check if blob_path is present, as it's crucial
      if (!traceDetails.blob_path) {
          console.error(`Public trace details for ${id} received null blob_path from RPC.`);
          return { data: null, error: { message: "Public trace data is incomplete (missing blob path)", code: "500" } };
      }

      // Return only the id and blob_path provided by the RPC
      return { data: { id: traceDetails.id, blob_path: traceDetails.blob_path }, error: null };

    } catch (error) {
      console.error(`Error fetching public trace details for ${id}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to fetch public trace details",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  }

  // Upload a new trace
  export async function uploadTrace(
    file: File,
    metadata: Omit<TraceUpload, "blob_path">,
    userId: string,
    folderId: string | null = null,
    makePublic?: boolean
  ): Promise<ApiResponse<TraceMetadata>> {
    const bucket = 'traces';
    let filePathInBucket: string | null = null;
    try {
      // Check if userId is provided (basic sanity check, RLS is the main guard)
      if (!userId) {
          throw new Error('User ID is required');
      }

      // 2. Generate unique storage path
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
      const fileName = file.name.endsWith('.gz') ? file.name : `${file.name}.gz`; // Ensure .gz
      filePathInBucket = `${timestamp}/${fileName}`;

      // 3. Read and Parse File Content
      let jsonObjectToUpload: unknown;
      try {
          const fileContent = await file.text();
          jsonObjectToUpload = JSON.parse(fileContent);
      } catch (parseError) {
          console.error("Error reading or parsing processed file for uploadJson:", parseError);
          throw new Error("Invalid JSON content in processed file.");
      }

      // 4. Upload Compressed JSON via uploadJson
      console.log(`Attempting compressed upload to bucket: ${bucket}, path: ${filePathInBucket}`);
      const uploadResult = await uploadJson(bucket, filePathInBucket, jsonObjectToUpload);

      // Handle upload failure - does not require cleanup as nothing was stored yet
      if ('error' in uploadResult) {
          throw uploadResult.error;
      }
      console.log(`Compressed upload successful. Path: ${uploadResult.path}`); // path is relative to bucket

      // ---- Upload successful, proceed to DB insert ----

      // 5. Construct full storage path for DB record
      const storagePath = `${bucket}/${uploadResult.path}`; 

      // 6. Insert Trace Metadata into Database (Now RPC Call)
      console.log(`Calling create_trace RPC for user ${userId}, public: ${makePublic ?? false}`);
      const { data: rpcData, error: rpcError } = await supabase
          .rpc('create_trace', {
              p_user_id: userId,
              p_blob_path: storagePath,
              p_upload_source: 'web' as const,
              p_make_public: makePublic ?? false,
              p_commit_sha: metadata.commit_sha,
              p_branch: metadata.branch,
              p_scenario: metadata.scenario,
              p_duration_ms: Math.round(metadata.duration_ms),
              p_file_size_bytes: file.size, // Size of the *original* file or processed file if different; RPC expects bigint
              p_profile_type: metadata.profile_type,
              p_notes: metadata.notes,
              p_folder_id: folderId,
          });

      // Handle DB insert failure - Requires cleanup of the uploaded storage object
      if (rpcError) {
        console.error("RPC call to create_trace failed after successful storage upload:", rpcError);
        // Throw a new error to be caught by the outer catch block for cleanup
        throw new Error(`RPC call to create_trace failed: ${rpcError.message}`);
      }

      // Success!
      return { data: rpcData as TraceMetadata, error: null };

    } catch (error) {
        console.error("Upload trace failed:", error);

        // Cleanup: Attempt to delete the storage object if upload might have succeeded
        // Check if filePathInBucket was determined (meaning we got past step 2)
        if (filePathInBucket) {
            console.warn("Upload process failed, attempting to clean up potentially orphaned storage object...");
            // Use the helper function for deletion
            await deleteStorageObject(bucket, filePathInBucket);
        } else {
            console.log("Upload failed early, no storage object cleanup needed.");
        }

        // Return structured error
        const apiError: ApiError = {
            message: error instanceof Error ? error.message : "Failed to upload trace",
            code: (error as PostgrestError)?.code,
            details: (error as PostgrestError)?.details,
            hint: (error as PostgrestError)?.hint,
        };

        // --- Check for specific limit exceeded errors from trigger --- 
        if (error instanceof Error && error.message.includes('limit')) { // General check for limit errors
          const pgErrorCode = (error as any)?.code; // Attempt to get Postgres error code
          if (pgErrorCode === 'P0002') { // Monthly Limit
            apiError.message = "Monthly upload limit reached. Please upgrade or wait until next cycle.";
            // Optionally add: apiError.code = 'MONTHLY_LIMIT_EXCEEDED'; 
          } else if (pgErrorCode === 'P0003') { // Total Limit
            apiError.message = "Total trace storage limit reached. Please delete older traces or upgrade your plan.";
            // Optionally add: apiError.code = 'TOTAL_LIMIT_EXCEEDED';
          } 
          // Keep original DB message if code doesn't match known ones
        }
        // --- End Limit Check Error Handling --- 

        return { data: null, error: apiError };
    }
  }

  // --- NEW: Rename Trace ---
  export async function renameTrace(
    traceId: string,
    newScenario: string,
    userId: string
  ): Promise<ApiResponse<TraceMetadata>> {
    try {
      // Basic validation
      if (!newScenario || newScenario.trim().length === 0 || newScenario.length > 255) {
        throw new Error("Invalid new scenario name.");
      }
      if (!traceId) {
         throw new Error("Trace ID is required for renaming.");
      }
       if (!userId) {
          throw new Error("User ID is required for renaming.");
       }

      const trimmedScenario = newScenario.trim();

      // Update the scenario field ONLY. RLS should handle ownership check.
      const { data, error } = await supabase
        .from('traces')
        // Remove updated_at from the update payload
        .update({ scenario: trimmedScenario })
        .eq('id', traceId)
        .eq('user_id', userId) // Explicit ownership check for safety
        // Fetch owner details along with the updated trace
        .select(`*, owner:user_profiles!user_id ( id, username, avatar_url, first_name, last_name )`)
        .single();

      if (error) {
        console.error(`Database error renaming trace ${traceId}:`, error);
        throw error;
      }

       if (!data) {
          // This could mean trace not found OR user doesn't own it
          throw new Error(`Trace not found (${traceId}) or user (${userId}) does not have permission to rename.`);
       }

      // We need to potentially re-process the owner field similar to listUserTraces
      const traceData = data as TraceMetadata;

      return { data: traceData, error: null };

    } catch (error) {
      console.error(`Error renaming trace ${traceId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to rename trace",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  }

  // Delete a trace by ID
  export async function deleteTrace(id: string): Promise<ApiResponse<void>> {
    try {
        // 1. Fetch trace metadata including blob_path
        const { data: trace, error: fetchError } = await supabase
            .from('traces')
            .select('blob_path')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') { // Row not found
                console.warn(`Trace with ID ${id} not found for deletion.`);
                return { data: null, error: null }; // Treat as success
            }
            throw fetchError; // Rethrow other fetch errors
        }

        // 2. Attempt to delete storage object (if path exists)
        if (trace?.blob_path) {
            const pathParts = trace.blob_path.split('/');
            if (pathParts.length >= 2) {
                const bucket = pathParts[0];
                const pathWithinBucket = pathParts.slice(1).join('/');
                // Use the helper function (logs errors internally)
                await deleteStorageObject(bucket, pathWithinBucket);
            } else {
                console.warn(`Invalid blob_path format found for trace ${id}: ${trace.blob_path}. Skipping storage deletion.`);
            }
        } else {
            console.warn(`Trace with ID ${id} has no blob_path. Skipping storage deletion.`);
        }

        // 3. Delete the trace record from the database
        const { error: deleteError } = await supabase
            .from('traces')
            .delete()
            .eq('id', id);

        if (deleteError) {
            // If DB delete fails after storage delete, it's less critical but still an issue
            console.error(`Failed to delete trace record ${id} from database:`, deleteError);
            throw deleteError;
        }

        console.log(`Successfully deleted trace ${id} record from database.`);
        return { data: null, error: null }; // Indicate overall success

    } catch (error) {
        console.error(`Failed to complete deletion for trace ${id}:`, error);
        // Return structured error
        const apiError: ApiError = {
            message: error instanceof Error ? error.message : "Failed to delete trace",
            code: (error as PostgrestError)?.code,
            details: (error as PostgrestError)?.details,
            hint: (error as PostgrestError)?.hint,
        };
        return { data: null, error: apiError };
    }
  }