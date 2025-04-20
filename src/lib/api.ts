
import { TraceMetadata, TraceUpload, ApiResponse } from "@/types";

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
    // First, parse the file to extract duration
    const durationMs = await extractTraceDuration(file);
    
    // Upload file to Supabase Storage (this would be handled by backend in production)
    // Mocking the response for now
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
    const fileName = `${crypto.randomUUID()}.json`;
    const blobPath = `traces/${timestamp}/${fileName}`;
    
    // For now we're simulating the upload - in a real implementation this would use 
    // the Supabase client to upload the file and then make an API call with the metadata
    return fetchApi<TraceMetadata>("/api/traces/new", {
      method: "POST",
      body: JSON.stringify({
        ...metadata,
        duration_ms: durationMs,
        blob_path: blobPath,
      }),
    });
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
