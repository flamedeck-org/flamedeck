// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts' // Use a recent std version
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { authenticateRequest } from '../_shared/auth.ts'; // Import the helper
import * as pako from 'npm:pako'; // Import pako for Deno
import { JSON_parse } from 'npm:uint8array-json-parser'; // Import parser for Deno
import Long from 'npm:long'; // Import Long for Deno
// Import type from the package index file
import { type ImporterDependencies } from '../../../packages/shared-importer/src/index.ts'; 
import { z } from 'https://esm.sh/zod@3.23.8'; // Import Zod
// Adjust import to get the ProfileGroup type if needed, and exportProfileGroup
import {
  importProfilesFromArrayBuffer,
  exportProfileGroup,
  ProfileType, // Assuming ProfileType is exported
  getDurationMsFromProfileGroup // Import the new utility
} from '../../../packages/shared-importer/src/index.ts';

// --- Shared Importer ---
// NOTE: Ensure this relative path is correct from the perspective of the compiled function
// It might require adjustment based on the final build structure or if using import maps.
// Also ensure the shared importer is environment-agnostic (no browser/node APIs)

// --- Compression Utility ---
async function gzipCompressDeno(data: Uint8Array): Promise<ArrayBuffer> {
  const stream = new Response(data).body!
    .pipeThrough(new CompressionStream('gzip'));
  return await new Response(stream).arrayBuffer();
}

console.log("api-upload-trace function booting up...");

// Define Zod schema for query parameters
const queryParamsSchema = z.object({
  fileName: z.string().min(1, "fileName is required"),
  scenario: z.string().optional().default('API Upload'), // Optional with default
  commitSha: z.string().nullable().optional(),          // Optional, can be null
  branch: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  folderId: z.string().uuid("Invalid folder ID format").nullable().optional(), // Allow optional folderId
  public: z.boolean().optional().default(false), // Add public parameter
});

type QueryParams = z.infer<typeof queryParamsSchema>;

serve(async (req) => {
  // 1. Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Method Check
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Authentication & Authorization (using helper)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase environment variables");
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

    // Define required scope(s) for this function
    const requiredScopes = ['trace:upload'];

    // Call the authentication helper
    const authResult = await authenticateRequest(req, supabaseAdmin, requiredScopes);

    // Check if the helper returned a Response (indicating auth failure)
    if (authResult instanceof Response) {
      return authResult; // Immediately return the error response
    }

    // Auth succeeded, get the userId
    const userId = authResult.userId;
    console.log(`Authentication successful for user: ${userId}`);

    // 4. Input Extraction
    let fileBuffer: ArrayBuffer;
    try {
      fileBuffer = await req.arrayBuffer();
    } catch (bufferError) {
      console.error("Error reading request body:", bufferError);
      return new Response(JSON.stringify({ error: 'Failed to read trace file from request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!fileBuffer || fileBuffer.byteLength === 0) {
      return new Response(JSON.stringify({ error: 'Request body is empty or invalid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log(`Received file buffer, size: ${fileBuffer.byteLength} bytes`);

    // Extract and validate query parameters using Zod
    const url = new URL(req.url);
    const queryParamsToValidate = {
      fileName: url.searchParams.get('fileName'),
      scenario: url.searchParams.get('scenario'),
      commitSha: url.searchParams.get('commitSha'),
      branch: url.searchParams.get('branch'),
      notes: url.searchParams.get('notes'),
      folderId: url.searchParams.get('folderId'), // Extract folderId
      public: url.searchParams.get('public') ? url.searchParams.get('public') === 'true' : undefined, // Add public
    };

    const validationResult = queryParamsSchema.safeParse(queryParamsToValidate);

    if (!validationResult.success) {
      console.error("Query parameter validation failed:", validationResult.error.flatten());
      return new Response(JSON.stringify({
        error: "Invalid query parameters",
        issues: validationResult.error.flatten().fieldErrors // More detailed errors
      }), {
        status: 400, // Bad Request
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use validated and typed data from now on
    const { 
      fileName,
      scenario,
      commitSha,
      branch,
      notes,
      folderId, // Destructure folderId
      public: isPublic, // Destructure public (renamed to avoid conflict)
    } = validationResult.data;

    console.log(`Validated metadata - fileName: ${fileName}, scenario: ${scenario}, folderId: ${folderId ?? 'none'}, public: ${isPublic}`);

    // Create the dependencies object for the Deno environment
    const importerDeps: ImporterDependencies = {
      inflate: pako.inflate,
      parseJsonUint8Array: JSON_parse,
      isLong: Long.isLong
    };

    // 5. Import Processing
    let importResult: { profileGroup: ProfileGroup | null; profileType: ProfileType } | null = null;
    let durationMs = 0;
    let compressedBuffer: ArrayBuffer | undefined = undefined;
    let compressedSize = 0;
    let profileType: ProfileType = 'unknown';

    try {
      console.log(`Attempting to import profile using shared importer for file: ${fileName}`);
      // Pass the dependencies object
      importResult = await importProfilesFromArrayBuffer(
          fileName, // Pass filename first now
          fileBuffer,
          importerDeps
      );

      // Check if importResult or profileGroup inside it is null
      if (!importResult?.profileGroup) {
        // Importer returned null or failed to find a group
        console.warn(`Import failed (importer returned null/empty group) for file: ${fileName}`);
        return new Response(JSON.stringify({ error: 'Failed to parse trace file or unsupported format' }), {
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`Import successful for file: ${fileName}.`);

      // Extract info from the ProfileGroup object
      const profileGroup = importResult.profileGroup;
      profileType = importResult.profileType; // Assign to the outer scope variable

      // Use the shared utility function for duration calculation
      // The profileGroup object returned by the importer *must* conform
      // structurally to the MinimalProfileGroup interface used by the utility.
      durationMs = getDurationMsFromProfileGroup(profileGroup) ?? 0; // Use nullish coalescing for default

      console.log(`Extracted from profile - duration: ${durationMs}ms, type: ${profileType}`);

      // !!! CRITICAL FIX: Export to serializable format BEFORE stringify !!!
      console.log("Exporting profile group to serializable format...");
      const serializableProfile = exportProfileGroup(profileGroup);

      // Now stringify the serializable object
      const jsonString = JSON.stringify(serializableProfile);
      const uint8Array = new TextEncoder().encode(jsonString);
      console.log(`Serializable profile stringified, size: ${uint8Array.byteLength} bytes`);

      // Perform compression - assign to variables declared outside
      try {
          compressedBuffer = await gzipCompressDeno(uint8Array);
          compressedSize = compressedBuffer.byteLength;
          console.log(`Compression successful, compressed size: ${compressedSize} bytes`);
      } catch (compressError) {
        console.error(`Error during compression for ${fileName}:`, compressError);
        return new Response(JSON.stringify({ error: 'An error occurred while compressing the trace file' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

    } catch (importError) {
      console.error(`Error during import process for ${fileName}:`, importError);
      // Log the error but return a generic message
      return new Response(JSON.stringify({ error: 'An error occurred while processing the trace file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if compression succeeded before proceeding
    if (compressedBuffer === undefined) {
        console.error("Compression step failed or was skipped, cannot proceed with storage upload.");
        return new Response(JSON.stringify({ error: 'Internal error during file processing' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 6. Storage Upload
    const bucket = 'traces';
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
    // Sanitize filename slightly and ensure .gz suffix for clarity in bucket
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_'); // Basic sanitization
    const storageFileName = safeFileName.endsWith('.gz') ? `${crypto.randomUUID()}-${safeFileName}` : `${crypto.randomUUID()}-${safeFileName}.gz`;
    const filePathInBucket = `${timestamp}/${storageFileName}`;
    let storagePath = '';

    try {
      console.log(`Attempting to upload compressed data to ${bucket}/${filePathInBucket}`);
      const compressedBlob = new Blob([compressedBuffer], { type: 'application/json' });

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(bucket)
        .upload(filePathInBucket, compressedBlob, {
          contentType: 'application/json', // Underlying data type
          cacheControl: 'public,max-age=31536000', // Cache indefinitely
          upsert: false, // Don't overwrite, use UUID filename
          duplex: 'half', // Required for Deno stream uploads
          headers: { 'Content-Encoding': 'gzip' } // IMPORTANT!
        });

      if (uploadError) {
        console.error("Storage upload failed:", uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      storagePath = `${bucket}/${uploadData.path}`;
      console.log(`Storage upload successful: ${storagePath}`);

    } catch (uploadCatchError) {
      console.error(`Error during storage upload for ${fileName}:`, uploadCatchError);
      return new Response(JSON.stringify({ error: 'An error occurred while uploading the trace file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 8. Database Insert (Now RPC Call)
    let insertedTraceData: any | null = null; // Type will come from RPC result
    try {
      console.log(`Attempting to create trace record via RPC for user ${userId}, public: ${isPublic}`);
      const rpcParams = {
        p_user_id: userId,
        p_blob_path: storagePath,
        p_upload_source: 'api' as const, // Literal type for upload_source
        p_make_public: isPublic,
        p_commit_sha: commitSha,
        p_branch: branch,
        p_scenario: scenario,
        p_duration_ms: durationMs,
        p_file_size_bytes: compressedSize,
        p_profile_type: profileType, // Use the updated outer scope variable
        p_notes: notes,
        p_folder_id: folderId,
      };
      console.log("Calling create_trace RPC with params:", rpcParams)

      const { data: rpcData, error: rpcError } = await supabaseAdmin
        .rpc('create_trace', rpcParams);

      if (rpcError) {
        console.error("RPC call to create_trace failed:", rpcError);
        // IMPORTANT: Attempt to clean up the orphaned storage object
        console.warn(`RPC call failed. Attempting to delete orphaned storage object: ${storagePath}`);
        const [bucketName, ...objectPathParts] = storagePath.split('/');
        const objectPath = objectPathParts.join('/');
        if (bucketName && objectPath) {
           await supabaseAdmin.storage.from(bucketName).remove([objectPath]);
           console.log(`Cleanup attempt for ${storagePath} finished after RPC error.`);
        } else {
           console.error(`Could not parse bucket/path for cleanup after RPC error: ${storagePath}`);
        }
        // Throw an error to be caught by the main try/catch, or return a specific error response
        throw new Error(`Failed to create trace via RPC: ${rpcError.message}`);
      }

      insertedTraceData = rpcData;
      console.log(`RPC call to create_trace successful. Trace ID: ${insertedTraceData?.id}`);

    } catch (dbProcessingError) { // Catch errors from RPC call or subsequent logic
      console.error(`Error during database processing phase (RPC or aftermath) for ${fileName}:`, dbProcessingError);
      // Ensure cleanup is attempted if not already done by a more specific catch for rpcError
      // This catch block might be redundant if the rpcError catch re-throws, but good for safety.
      if (!(dbProcessingError.message.includes('Failed to create trace via RPC')) && storagePath) {
        console.warn(`Generic DB processing error. Attempting to delete orphaned storage object: ${storagePath}`);
        const [bucketName, ...objectPathParts] = storagePath.split('/');
        const objectPath = objectPathParts.join('/');
        if (bucketName && objectPath) {
           await supabaseAdmin.storage.from(bucketName).remove([objectPath]);
           console.log(`Cleanup attempt for ${storagePath} finished after generic DB error.`);
        } else {
           console.error(`Could not parse bucket/path for cleanup after generic DB error: ${storagePath}`);
        }
      }
      // Re-throw to ensure the main error handler sends a 500
      throw dbProcessingError;
    }

    // 9. Success Response
    return new Response(JSON.stringify(insertedTraceData), {
      status: 201, // Created
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
     console.error("Unhandled error in API trace upload:", error);
     // Generic error response from the main catch block
     return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
  }
})
