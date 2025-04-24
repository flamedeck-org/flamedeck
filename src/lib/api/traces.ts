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

  // Upload a new trace
  export async function uploadTrace(
    file: File,
    metadata: Omit<TraceUpload, "blob_path">,
    userId: string,
    folderId: string | null = null
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

      // 6. Insert Trace Metadata into Database
      const { data: dbData, error: dbError } = await supabase
          .from('traces')
          .insert({
              user_id: userId,
              commit_sha: metadata.commit_sha,
              branch: metadata.branch,
              scenario: metadata.scenario,
              device_model: metadata.device_model,
              duration_ms: Math.round(metadata.duration_ms),
              blob_path: storagePath,
              file_size_bytes: file.size, // Size of the *processed* (but uncompressed) file
              profile_type: metadata.profile_type,
              notes: metadata.notes,
              uploaded_at: new Date().toISOString(),
              folder_id: folderId
          })
          .select()
          .single();

      // Handle DB insert failure - Requires cleanup of the uploaded storage object
      if (dbError) {
          console.error("Database insert failed after successful storage upload:", dbError);
          // Throw a new error to be caught by the outer catch block for cleanup
          throw new Error(`Database insert failed: ${dbError.message}`);
      }

      // Success!
      return { data: dbData as TraceMetadata, error: null };

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