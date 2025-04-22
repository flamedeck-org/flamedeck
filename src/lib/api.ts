import { TraceMetadata, TraceUpload, ApiResponse, TraceComment } from "@/types";
import { Database } from "@/integrations/supabase/types";
import { uploadJson, listUserTraces } from "./storage";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

// Define the profile type using the generated table type
type UserProfileType = Database['public']['Tables']['user_profiles']['Row'];

// Define types for comment data
export interface TraceCommentWithAuthor extends TraceComment {
  author: Pick<UserProfileType, 'id' | 'username' | 'avatar_url' | 'first_name' | 'last_name'> | null;
}

export type NewTraceComment = Omit<TraceComment, 'id' | 'created_at' | 'user_id'>;

// Define a type for the paginated response structure
export interface PaginatedTracesResponse {
  traces: TraceMetadata[];
  totalCount: number;
}

// --- Helper Functions ---

/**
 * Attempts to delete an object from Supabase storage.
 * Logs errors but does not re-throw them by default.
 */
async function deleteStorageObject(bucket: string, path: string): Promise<void> {
    console.log(`Attempting to delete storage object: bucket=${bucket}, path=${path}`);
    try {
        const { error } = await supabase.storage
            .from(bucket)
            .remove([path]);
        if (error) {
            console.error(`Failed to delete storage object ${path} from bucket ${bucket}:`, error);
            // Decide if this should throw - for cleanup, maybe not?
        } else {
            console.log(`Successfully deleted storage object: bucket=${bucket}, path=${path}`);
        }
    } catch (cleanupError) {
        console.error(`Error during storage object deletion for ${path} in bucket ${bucket}:`, cleanupError);
    }
}

// --- Trace API --- 

export const traceApi = {
  // Get paginated list of traces
  getTraces: async (
    page: number = 0,
    limit: number = 20
  ): Promise<ApiResponse<PaginatedTracesResponse>> => {
    try {
      // Call the updated listUserTraces which now handles pagination and returns count
      const { data: traces, count } = await listUserTraces(page, limit);
      // Ensure count is a number, defaulting to 0 if null/undefined
      const totalCount = count ?? 0;
      return { data: { traces, totalCount }, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  },

  // Get a single trace by ID
  getTrace: async (id: string): Promise<ApiResponse<TraceMetadata>> => {
    try {
      const { data, error } = await supabase
        .from('traces')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      return { data: data as TraceMetadata, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  },

  // Upload a new trace
  uploadTrace: async (
    file: File,
    metadata: Omit<TraceUpload, "blob_path">
  ): Promise<ApiResponse<TraceMetadata>> => {
    const bucket = 'traces';
    let filePathInBucket: string | null = null; // Path used for storage upload

    try {
        // 1. Authenticate User
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error('Authentication required');
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
                user_id: user.id,
                commit_sha: metadata.commit_sha,
                branch: metadata.branch,
                scenario: metadata.scenario,
                device_model: metadata.device_model,
                duration_ms: Math.round(metadata.duration_ms),
                blob_path: storagePath,
                file_size_bytes: file.size, // Size of the *processed* (but uncompressed) file
                profile_type: metadata.profile_type,
                notes: metadata.notes,
                uploaded_at: new Date().toISOString()
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

        // Return error response
        return { data: null, error: (error as Error).message };
    }
  },

  // Delete a trace by ID
  deleteTrace: async (id: string): Promise<ApiResponse<void>> => {
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
        return { data: null, error: (error as Error).message };
    }
  },

  // Get comments for a specific trace
  getTraceComments: async (traceId: string): Promise<ApiResponse<TraceCommentWithAuthor[]>> => {
    try {
      const { data, error } = await supabase
        .from('trace_comments')
        .select<string, TraceCommentWithAuthor>(`
          *,
          author: user_profiles ( id, username, avatar_url, first_name, last_name )
        `)
        .eq('trace_id', traceId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const commentsWithAuthor = data as TraceCommentWithAuthor[]; 
      
      return { data: commentsWithAuthor, error: null };
    } catch (error) {
      console.error(`Error fetching comments for trace ${traceId}:`, error);
      return { data: null, error: (error as Error).message };
    }
  },

  // Create a new comment for a trace
  createTraceComment: async (commentData: NewTraceComment & { trace_id: string }): Promise<ApiResponse<TraceComment>> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required to comment.");

      const { data, error } = await supabase
        .from('trace_comments')
        .insert({
          ...commentData,
          user_id: user.id,
        })
        .select('*')
        .single();

      if (error) throw error;
      if (!data) throw new Error("Comment created but data not returned.");

      return { data: data as TraceComment, error: null };
    } catch (error) {
      console.error('Error creating trace comment:', error);
      return { data: null, error: (error as Error).message };
    }
  }
};