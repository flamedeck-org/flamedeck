import { TraceMetadata, TraceUpload, ApiResponse } from "@/types";
import { uploadTraceFile, listUserTraces } from "./storage";
import { supabase } from "@/integrations/supabase/client";

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
    metadata: Omit<TraceUpload, "blob_path" | "duration_ms">
  ): Promise<ApiResponse<TraceMetadata>> => {
    try {
      // First, parse the file to extract duration
      const durationMs = await extractTraceDuration(file);
      
      // Upload file to Supabase Storage
      const { path: blobPath, size: fileSize } = await uploadTraceFile(file);
      
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
          duration_ms: durationMs,
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
        // 2. Delete the file from storage
        const { error: storageError } = await supabase.storage
          .from('traces') // Make sure this matches your bucket name
          .remove([trace.blob_path]);

        if (storageError) {
          // Log the error but attempt to delete the DB record anyway
          console.error(`Error deleting storage object ${trace.blob_path}:`, storageError);
          // Depending on requirements, you might want to throw here
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
  }
};

// Function to extract duration from trace file
async function extractTraceDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        // This is a simplification - the actual parsing logic would depend on the trace format
        const duration = content.profile?.endValue - content.profile?.startValue || 0;
        resolve(duration);
      } catch (error) {
        console.error("Error parsing trace file:", error);
        resolve(0); // Default to 0 if we can't parse
      }
    };
    
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
