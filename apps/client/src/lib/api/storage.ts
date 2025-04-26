import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import type { TraceMetadata, UserProfile } from "@/types";
import { gzipCompress, gzipDecompress } from "../util/compress"; // Import compression utilities
import { PostgrestError } from '@supabase/supabase-js'; // Import PostgrestError

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

// List paginated traces for the current user, excluding those only accessible via public link
export const listUserTraces = async (
    page: number,
    limit: number,
    searchQuery?: string | null, // Add optional searchQuery parameter
    folderId?: string | null // NEW: Add optional folderId parameter
): Promise<{ data: TraceMetadata[]; count: number | null }> => {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            console.error("Session error in listUserTraces:", sessionError);
            throw new Error('Authentication required to list traces');
        }
        const userId = session.user.id;

        const from = page * limit;
        const to = from + limit - 1;

        // Base query: Fetch traces with owner info
        // NOTE: The original query using select().or() with join hint is removed
        // as we rely solely on the RPC function now.

        // ---- Use RPC functions that accept folderId ----
        // IMPORTANT: Assumes RPC functions `get_user_accessible_traces` and
        // `get_user_accessible_traces_count` have been updated in Supabase SQL
        // to accept `p_folder_id UUID` and filter accordingly.
        // Example SQL change (add to WHERE clause in both functions):
        // AND (
        //    (p_folder_id IS NULL AND t.folder_id IS NULL) OR
        //    (p_folder_id IS NOT NULL AND t.folder_id = p_folder_id)
        // )

        console.log(`Calling RPCs for user ${userId}, page ${page}, limit ${limit}, search: '${searchQuery || ''}', folder: '${folderId || 'root'}'`);

        // Call the RPC function for data
        const rpcParamsData = {
            p_user_id: userId,
            p_offset: from,
            p_limit: limit,
            p_search_query: searchQuery || '',
            p_folder_id: folderId // <-- Pass folderId
        };
        console.log("RPC params (data):", rpcParamsData);
        const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_user_accessible_traces', rpcParamsData);

        // Call the RPC function for count
        const rpcParamsCount = {
            p_user_id: userId,
            p_search_query: searchQuery || '',
            p_folder_id: folderId // <-- Pass folderId
        };
         console.log("RPC params (count):", rpcParamsCount);
        const { data: countData, error: countError } = await supabase
            .rpc('get_user_accessible_traces_count', rpcParamsCount)
            .single(); // Expect a single number

        if (rpcError) {
            console.error("Error calling get_user_accessible_traces RPC:", rpcError);
            throw new Error(`Failed to list traces via RPC: ${rpcError.message}`);
        }
        if (countError) {
            console.error("Error calling get_user_accessible_traces_count RPC:", countError);
            // Proceed without count if necessary, or throw
            throw new Error(`Failed to get trace count via RPC: ${countError.message}`);
        }

        // Process results - RPC might return owner as JSON string or object
        // Define an expected structure for items returned by the RPC
        type RpcTraceItem = Omit<TraceMetadata, 'owner'> & { owner: string | UserProfile | null };

        const traces = (rpcData as RpcTraceItem[] || []).map((item) => {
            const processedItem = { ...item }; // Use const as it's not reassigned directly
            // Ensure owner is parsed if returned as JSON string and is not null
            if (processedItem.owner && typeof processedItem.owner === 'string') {
                try {
                    // Use UserProfile to match the imported type
                    const parsedOwner = JSON.parse(processedItem.owner) as UserProfile;
                    // Assign properties to the const object (this is allowed)
                    processedItem.owner = parsedOwner;
                } catch (e) {
                    console.error("Failed to parse owner JSON from RPC for trace:", processedItem.id, e);
                    // Assign null to the property on the const object
                    processedItem.owner = null;
                }
            } else if (processedItem.owner && typeof processedItem.owner !== 'object') {
                 // Handle cases where owner might be something unexpected after the join/CASE
                 console.warn("Unexpected owner type from RPC for trace:", processedItem.id, typeof processedItem.owner);
                 // Assign null to the property on the const object
                 processedItem.owner = null;
            }
            // Ensure owner is UserProfile | null after processing
            return processedItem as TraceMetadata;
        });

        // Ensure count is a number, default to 0 if null/undefined or invalid
        const totalCount = (typeof countData === 'number' && !isNaN(countData)) ? countData : 0;

        console.log(`RPC returned ${traces.length} traces, total count: ${totalCount}`);

        return { data: traces, count: totalCount };
    } catch (error) {
        console.error("Error in listUserTraces:", error);
        // Ensure we throw an actual Error object
        const err = error instanceof Error ? error : new Error(String(error));
        // Optionally check for specific PostgrestError details if needed
        if ((error as PostgrestError)?.message?.includes('function get_user_accessible_traces(p_user_id => uuid, p_offset => integer, p_limit => integer, p_search_query => text) does not exist')) {
            console.error("RPC function signature mismatch or function not found. Ensure 'get_user_accessible_traces' and 'get_user_accessible_traces_count' accept 'p_folder_id uuid' in Supabase.");
        }
        throw err;
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
