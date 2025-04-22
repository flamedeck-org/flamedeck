import { TraceMetadata, TraceUpload, ApiResponse, TraceComment } from "@/types";
import { Database } from "@/integrations/supabase/types";
import { uploadTraceFile, listUserTraces } from "./storage";
import { supabase } from "@/integrations/supabase/client";

// Define the profile type using the generated table type
type UserProfileType = Database['public']['Tables']['user_profiles']['Row'];

// Define types for comment data (assuming these are added to @/types)
export interface TraceCommentWithAuthor extends TraceComment {
  author: Pick<UserProfileType, 'id' | 'username' | 'avatar_url' | 'first_name' | 'last_name'> | null;
}

export type NewTraceComment = Omit<TraceComment, 'id' | 'created_at' | 'user_id'>;

// Utility for API calls
export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error("API call failed:", error);
    return { data: null, error: (error as Error).message };
  }
}

// Trace-related API functions
export const traceApi = {
  // Get paginated list of traces
  getTraces: async (
    page: number = 0,
    limit: number = 20
  ): Promise<ApiResponse<TraceMetadata[]>> => {
    try {
      const traces = await listUserTraces();
      return { data: traces, error: null };
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
    let blobPath: string | null = null; // Declare blobPath here to access in catch
    try {
      // Upload file to Supabase Storage
      const { path, size: fileSize } = await uploadTraceFile(file);
      blobPath = path; // Assign blobPath after successful upload

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Authentication required');
      }
      
      // Insert new trace record in the traces table
      const { data, error } = await supabase
        .from('traces')
        .insert({
          user_id: user.id,
          commit_sha: metadata.commit_sha,
          branch: metadata.branch,
          scenario: metadata.scenario,
          device_model: metadata.device_model,
          duration_ms: metadata.duration_ms,
          blob_path: blobPath,
          file_size_bytes: fileSize,
          notes: metadata.notes,
          uploaded_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error("Error creating trace record:", error);
        throw new Error(`Failed to create trace record: ${error.message}`);
      }
      
      return { data: data as TraceMetadata, error: null };
    } catch (error) {
      console.error("Upload trace error:", error);

      // Attempt to clean up the uploaded file if the database insert failed
      if (blobPath) {
        const pathWithinBucket = blobPath.startsWith('traces/') ? blobPath.substring('traces/'.length) : blobPath;
        console.log(`Attempting to delete orphaned storage object at path: ${pathWithinBucket}`);
        try {
          const { error: deleteError } = await supabase.storage
            .from('traces') // Bucket name
            .remove([pathWithinBucket]); // Use path without bucket prefix
          if (deleteError) {
            console.error(`Failed to delete orphaned storage object ${pathWithinBucket}:`, deleteError);
            // Don't re-throw, the original error is more important
          } else {
              console.log(`Successfully deleted orphaned storage object: ${pathWithinBucket}`);
          }
        } catch (cleanupError) {
          console.error(`Error during storage cleanup for ${pathWithinBucket}:`, cleanupError);
        }
      }

      return { data: null, error: (error as Error).message };
    }
  },

  // Delete a trace by ID
  deleteTrace: async (id: string): Promise<ApiResponse<void>> => {
    try {
      // 1. Get the trace record to find the blob path
      const { data: trace, error: fetchError } = await supabase
        .from('traces')
        .select('blob_path')
        .eq('id', id)
        .single();

      if (fetchError) {
        // Handle case where trace doesn't exist or other fetch errors
        if (fetchError.code === 'PGRST116') { 
          // PGRST116: Row not found
          console.warn(`Trace with ID ${id} not found for deletion.`);
          // Optionally return success if not finding it is okay
          return { data: null, error: null }; 
        }
        throw fetchError;
      }

      if (!trace?.blob_path) {
        console.warn(`Trace with ID ${id} has no blob_path. Skipping storage deletion.`);
      } else {
        // Ensure path doesn't include bucket name for remove operation
        const pathWithinBucket = trace.blob_path.startsWith('traces/')
          ? trace.blob_path.substring('traces/'.length)
          : trace.blob_path;

        // 2. Delete the file from storage
        console.log(`Attempting to delete storage object: ${pathWithinBucket}`); // Log the path being deleted
        const { error: storageError } = await supabase.storage
          .from('traces') // Bucket name
          .remove([pathWithinBucket]); // Use path without bucket prefix

        if (storageError) {
          // Log the error but attempt to delete the DB record anyway
          console.error(`Error deleting storage object ${pathWithinBucket}:`, storageError);
          // Depending on requirements, you might want to throw here
        } else {
            console.log(`Successfully deleted storage object: ${pathWithinBucket}`); // Add success log
        }
      }

      // 3. Delete the trace record from the database
      const { error: deleteError } = await supabase
        .from('traces')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      return { data: null, error: null }; // Indicate success
    } catch (error) {
      console.error(`Failed to delete trace ${id}:`, error);
      return { data: null, error: (error as Error).message };
    }
  },

  // Get comments for a specific trace
  getTraceComments: async (traceId: string): Promise<ApiResponse<TraceCommentWithAuthor[]>> => {
    try {
      // Explicitly type the select statement to help TS resolve the relationship
      const { data, error } = await supabase
        .from('trace_comments')
        .select<string, TraceCommentWithAuthor>(`
          *,
          author: user_profiles ( id, username, avatar_url, first_name, last_name )
        `)
        .eq('trace_id', traceId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Cast might still not be needed now, but keep for safety
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
          user_id: user.id, // Set the user_id from the authenticated user
        })
        .select('*') // Explicitly select all columns of the new row
        .single();

      if (error) throw error;
      if (!data) throw new Error("Comment created but data not returned.");

      // Cast might still be needed if types are stale
      return { data: data as TraceComment, error: null };
    } catch (error) {
      console.error('Error creating trace comment:', error);
      return { data: null, error: (error as Error).message };
    }
  }
};