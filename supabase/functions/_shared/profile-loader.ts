import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as pako from "https://esm.sh/pako@2.1.0"; 
import { JSON_parse } from 'npm:uint8array-json-parser'; 
import Long from 'npm:long'; 
// Import from shared-importer (adjust path based on _shared location)
// Assuming _shared is one level up from where packages are relative to functions/process-ai-turn
import { 
    type ImporterDependencies, 
    importProfilesFromArrayBuffer,
    type ProfileGroup,
    type ProfileType
} from '../../../packages/shared-importer/src/index.ts'; 

// Define the expected return type
export type ProfileLoadResult = { 
    profileGroup: ProfileGroup; 
    profileType: ProfileType; 
} | null;

// Reusable function to load and parse profile data from storage
export async function loadProfileData(supabaseAdmin: SupabaseClient, blobPath: string): Promise<ProfileLoadResult> {
    const pathParts = blobPath.split('/');
    const bucketName = pathParts.shift(); 
    const filePath = pathParts.join('/'); 

    if (!bucketName || !filePath) {
        throw new Error(`Invalid blobPath format: ${blobPath}`);
    }

    console.log(`[Shared Loader] Fetching trace from storage bucket '${bucketName}': ${filePath}`);
    
    const { data: blob, error: downloadError } = await supabaseAdmin.storage
        .from(bucketName) 
        .download(filePath); 

    if (downloadError) { 
        console.error(`[Shared Loader] Download error object for ${filePath}:`, downloadError);
        throw new Error(`Failed to download trace (${filePath}) from bucket ${bucketName}: ${downloadError.message || JSON.stringify(downloadError)}`); 
    }
    if (!blob) { 
        throw new Error(`Trace file not found or empty (${filePath}) in bucket ${bucketName}.`); 
    }

    console.log("[Shared Loader] Trace downloaded, decompressing...");
    const arrayBuffer = await blob.arrayBuffer();
    const decompressed = pako.inflate(new Uint8Array(arrayBuffer));
    console.log("[Shared Loader] Trace decompressed.");

    const importerDeps: ImporterDependencies = {
      inflate: pako.inflate, 
      parseJsonUint8Array: JSON_parse,
      isLong: Long.isLong
    }; 

    console.log("[Shared Loader] Importing profile group...");
    const importResult = await importProfilesFromArrayBuffer(
        filePath.split('/').pop() || 'tracefile', // Use filename from path
        decompressed.buffer, 
        importerDeps
    );

    if (!importResult?.profileGroup) {
        throw new Error(`Failed to import profile group from trace data (Path: ${filePath}). Importer returned null/empty.`);
    }

    console.log("[Shared Loader] Profile group imported successfully.");
    return importResult; // Return the full importResult object
} 