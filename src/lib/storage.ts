
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

// Create a bucket for traces if it doesn't exist
export const ensureTracesBucketExists = async (): Promise<void> => {
  const { data: buckets } = await supabase.storage.listBuckets();
  const tracesBucketExists = buckets?.some(bucket => bucket.name === 'traces');
  
  if (!tracesBucketExists) {
    const { error } = await supabase.storage.createBucket('traces', {
      public: false,
      allowedMimeTypes: ['application/json'],
      fileSizeLimit: 100 * 1024 * 1024, // 100MB
    });
    
    if (error) {
      console.error("Error creating traces bucket:", error);
      throw new Error(`Failed to create traces bucket: ${error.message}`);
    }
  }
};

// Upload a trace file to Supabase storage
export const uploadTraceFile = async (file: File): Promise<{ path: string; size: number }> => {
  try {
    await ensureTracesBucketExists();
    
    // Create a unique filename for the trace
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
    const fileName = `${uuidv4()}.json`;
    const filePath = `${timestamp}/${fileName}`;
    
    // Upload the file to Supabase storage
    const { error: uploadError, data } = await supabase.storage
      .from('traces')
      .upload(filePath, file, {
        contentType: 'application/json',
        cacheControl: '3600',
      });
    
    if (uploadError) {
      console.error("Error uploading trace file:", uploadError);
      throw new Error(`Failed to upload trace file: ${uploadError.message}`);
    }
    
    return { 
      path: `traces/${filePath}`,
      size: file.size
    };
  } catch (error) {
    console.error("Error in uploadTraceFile:", error);
    throw error;
  }
};

// Get a trace file from Supabase storage
export const getTraceFile = async (path: string): Promise<any> => {
  try {
    // Extract bucket and file path from the full path
    const [bucket, ...pathParts] = path.split('/');
    const filePath = pathParts.join('/');
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);
    
    if (error) {
      console.error("Error downloading trace file:", error);
      throw new Error(`Failed to download trace file: ${error.message}`);
    }
    
    if (!data) {
      throw new Error("File not found");
    }
    
    // Parse and return the JSON data
    const text = await data.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error in getTraceFile:", error);
    throw error;
  }
};
