import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import type { TraceMetadata } from "@/types";
import { gzipCompress, gzipDecompress } from "./util/compress"; // Import compression utilities

// Upload a trace file to Supabase storage
export const uploadTraceFile = async (file: File): Promise<{ path: string; size: number }> => {
    try {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
            throw new Error('Authentication required to upload files');
        }

        // Create a unique filename for the trace
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
        const fileName = `${uuidv4()}.speedscope.json`;
        const filePath = `${timestamp}/${fileName}`;
        
        console.log(`Attempting to upload file to path: ${filePath}`);
        
        // Upload the file to Supabase storage
        const { error: uploadError, data } = await supabase.storage
            .from('traces')
            .upload(filePath, file, {
                contentType: 'application/json',
                cacheControl: '3600',
                upsert: false
            });
        
        if (uploadError) {
            console.error("Error uploading trace file:", uploadError);
            throw new Error(`Failed to upload trace file: ${uploadError.message}`);
        }
        
        console.log("File uploaded successfully:", data);
        
        return { 
            path: `traces/${filePath}`,
            size: file.size
        };
    } catch (error) {
        console.error("Error in uploadTraceFile:", error);
        throw error;
    }
};

// Get a trace file from Supabase storage and parse as JSON
// Changed return type from any to unknown for better type safety
export const getTraceFile = async (path: string): Promise<unknown> => {
    try {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
            throw new Error('Authentication required to download files');
        }

        // Extract bucket and file path from the full path
        const [bucket, ...pathParts] = path.split('/');
        const filePath = pathParts.join('/');
        
        console.log(`Attempting to download file from bucket: ${bucket}, path: ${filePath}`);
        
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

// Get raw trace data blob from Supabase storage
export const getTraceBlob = async (path: string): Promise<{ data: ArrayBuffer; fileName: string }> => {
    try {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
            throw new Error('Authentication required to download files');
        }

        // Extract bucket and file path from the full path
        // Assumes path format like "bucket_name/folder/subfolder/file.ext"
        const pathParts = path.split('/');
        if (pathParts.length < 2) {
          throw new Error('Invalid blob path format. Expected bucket_name/path/to/file');
        }
        const bucket = pathParts[0];
        const filePath = pathParts.slice(1).join('/');
        const fileName = pathParts[pathParts.length - 1]; // Extract filename from path
        
        console.log(`[storage] Attempting download: bucket=${bucket}, path=${filePath}`);
        
        const { data, error } = await supabase.storage
            .from(bucket)
            .download(filePath);
        
        if (error) {
            console.error("[storage] Error downloading trace blob:", error);
            throw new Error(`Failed to download trace blob: ${error.message}`);
        }
        
        if (!data) {
            throw new Error("Trace blob not found in storage");
        }
        
        // Supabase download returns a Blob, convert to ArrayBuffer
        const arrayBuffer = await data.arrayBuffer();
        console.log(`[storage] Download successful, size: ${arrayBuffer.byteLength} bytes`);

        return { data: arrayBuffer, fileName };
    } catch (error) {
        console.error("Error in getTraceBlob:", error);
        throw error; // Re-throw the error for React Query to handle
    }
};

// List all traces for the current user
export const listUserTraces = async (): Promise<TraceMetadata[]> => {
    try {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
            throw new Error('Authentication required to list traces');
        }
        
        const { data, error } = await supabase
            .from('traces')
            .select('*')
            .order('uploaded_at', { ascending: false });
        
        if (error) {
            console.error("Error listing traces:", error);
            throw new Error(`Failed to list traces: ${error.message}`);
        }
        
        return data as TraceMetadata[];
    } catch (error) {
        console.error("Error in listUserTraces:", error);
        throw error;
    }
};

/**
 * Serializes, compresses (gzip), and uploads a JSON object to Supabase Storage.
 * Uses native CompressionStream if available, falls back to pako.
 *
 * @param bucket The Supabase Storage bucket name.
 * @param path The path within the bucket to store the file.
 * @param obj The JavaScript object to upload.
 * @returns A promise that resolves when the upload is complete, or rejects on error.
 */
export async function uploadJson(
    bucket: string,
    path: string,
    obj: unknown
): Promise<{ path: string } | { error: Error }> {
    try {
        // 1. Serialize to JSON string
        const jsonString = JSON.stringify(obj);

        // 2. Encode string to Uint8Array
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(jsonString);

        // 3. Compress the data
        const compressedBuffer = await gzipCompress(uint8Array.buffer);

        // 4. Create a Blob from the compressed data, matching the contentType option
        const blob = new Blob([compressedBuffer], { type: "application/json" });

        // 5. Upload the Blob
        const { data, error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(path, blob, {
                contentType: "application/json", // Blob type implies gzip, but content type is underlying data
                cacheControl: "public,max-age=31536000", // Cache immutable data
                upsert: true, // Overwrite if exists
                // Pass custom headers like Content-Encoding here
                headers: {
                    'Content-Encoding': 'gzip' // Use standard HTTP header format
                }
            });

        if (uploadError) {
            console.error("Error uploading compressed JSON:", uploadError);
            throw new Error(
                `Failed to upload compressed JSON: ${uploadError.message}`
            );
        }

        console.log("Compressed JSON uploaded successfully:", data);
        return { path: data.path };
    } catch (error) {
        console.error("Error in uploadJson:", error);
        return { error: error instanceof Error ? error : new Error(String(error)) };
    }
}

/**
 * Downloads a gzipped JSON file from Supabase Storage, decompresses it, and parses it.
 * Uses native DecompressionStream if available, falls back to pako.
 *
 * @param bucket The Supabase Storage bucket name.
 * @param path The path within the bucket to the gzipped file.
 * @returns A promise that resolves with the parsed JavaScript object, or rejects on error.
 */
export async function downloadJson<T = unknown>(
    bucket: string,
    path: string
): Promise<{ data: T | null; error: Error | null }> {
    try {
        // 1. Download the file blob
        const { data: blob, error: downloadError } = await supabase.storage
            .from(bucket)
            .download(path);

        if (downloadError) {
            console.error("Error downloading gzipped JSON:", downloadError);
            throw new Error(
                `Failed to download gzipped JSON: ${downloadError.message}`
            );
        }

        if (!blob) {
            throw new Error("Downloaded file blob is null.");
        }

        // 2. Get ArrayBuffer from Blob
        const compressedBuffer = await blob.arrayBuffer();

        // 3. Decompress the data
        const decompressedBuffer = await gzipDecompress(compressedBuffer);

        // 4. Decode Uint8Array back to string
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(new Uint8Array(decompressedBuffer));

        // 5. Parse JSON string
        const data = JSON.parse(jsonString) as T;

        return { data, error: null };
    } catch (error) {
        console.error("Error in downloadJson:", error);
        return {
            data: null,
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
}
