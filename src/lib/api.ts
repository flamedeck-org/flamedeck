
import { TraceMetadata, TraceUpload, ApiResponse } from "@/types";
import { uploadTraceFile } from "./storage";
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
    return fetchApi<TraceMetadata[]>(`/api/traces?page=${page}&limit=${limit}`);
  },

  // Get a single trace by ID
  getTrace: async (id: string): Promise<ApiResponse<TraceMetadata>> => {
    return fetchApi<TraceMetadata>(`/api/traces/${id}`);
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
      
      // Now update the user's profile with the trace information
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          trace_blob_path: blobPath,
          trace_size_bytes: fileSize,
          updated_at: new Date().toISOString()
        })
        .eq('id', (await supabase.auth.getUser()).data.user?.id);
      
      if (updateError) {
        console.error("Error updating profile:", updateError);
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }
      
      // Create a response object with the upload information
      const responseData: TraceMetadata = {
        id: crypto.randomUUID(),
        uploaded_at: new Date().toISOString(),
        commit_sha: metadata.commit_sha,
        branch: metadata.branch,
        scenario: metadata.scenario,
        device_model: metadata.device_model,
        duration_ms: durationMs,
        blob_path: blobPath,
        notes: metadata.notes
      };
      
      return { data: responseData, error: null };
    } catch (error) {
      console.error("Upload trace error:", error);
      return { data: null, error: (error as Error).message };
    }
  },
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
