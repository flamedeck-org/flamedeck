
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

// Create a bucket for traces if it doesn't exist
export const ensureTracesBucketExists = async (): Promise<void> => {
    try {
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
            console.error("Error listing buckets:", listError);
            throw new Error(`Failed to list buckets: ${listError.message}`);
        }
        
        const tracesBucketExists = buckets?.some((bucket) => bucket.name === 'traces');
        
        if (!tracesBucketExists) {
            // Create bucket without the fileSizeLimit option as it might be causing issues
            const { error } = await supabase.storage.createBucket('traces', {
                public: false,
                allowedMimeTypes: ['application/json']
                // Removed the fileSizeLimit option that caused the error
            });
            
            if (error) {
                console.error("Error creating traces bucket:", error);
                throw new Error(`Failed to create traces bucket: ${error.message}`);
            }
            
            console.log("Traces bucket created successfully");
        } else {
            console.log("Traces bucket already exists");
        }
    } catch (error) {
        console.error("Error in ensureTracesBucketExists:", error);
        throw error;
    }
};

// Upload a trace file to Supabase storage
export const uploadTraceFile = async (file: File): Promise<{ path: string; size: number }> => {
    try {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
            throw new Error('Authentication required to upload files');
        }

        await ensureTracesBucketExists();
        
        // Create a unique filename for the trace
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
        const fileName = `${uuidv4()}.json`;
        const filePath = `${timestamp}/${fileName}`;
        
        console.log(`Attempting to upload file to path: ${filePath}`);
        
        // Upload the file to Supabase storage
        const { error: uploadError, data } = await supabase.storage
            .from('traces')
            .upload(filePath, file, {
                contentType: 'application/json',
                cacheControl: '3600',
                upsert: false // Ensure we don't overwrite existing files
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

// Get a trace file from Supabase storage
export const getTraceFile = async (path: string): Promise<any> => {
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
