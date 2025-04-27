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

// --- Shared Importer ---
// NOTE: Ensure this relative path is correct from the perspective of the compiled function
// It might require adjustment based on the final build structure or if using import maps.
// Also ensure the shared importer is environment-agnostic (no browser/node APIs)
import { importProfilesFromArrayBuffer } from '../../../packages/shared-importer/src/index.ts';

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
  deviceModel: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  // folderId: z.string().uuid().optional(), // Example if you add folderId later
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
      deviceModel: url.searchParams.get('deviceModel'),
      notes: url.searchParams.get('notes'),
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
      deviceModel,
      notes
    } = validationResult.data;

    console.log(`Validated metadata - fileName: ${fileName}, scenario: ${scenario}`);

    // Create the dependencies object for the Deno environment
    const importerDeps: ImporterDependencies = {
      inflate: pako.inflate,
      parseJsonUint8Array: JSON_parse,
      isLong: Long.isLong
    };

    // 5. Import Processing
    let speedscopeProfile: object | null = null;
    let durationMs = 0;
    let profileType = 'unknown';
    try {
      console.log(`Attempting to import profile using shared importer for file: ${fileName}`);
      // Pass the dependencies object
      speedscopeProfile = await importProfilesFromArrayBuffer(
          fileName,
          fileBuffer,
          importerDeps
      );

      if (!speedscopeProfile) {
        // Importer returned null, indicating format not recognized or parse error
        console.warn(`Import failed (importer returned null) for file: ${fileName}`);
        return new Response(JSON.stringify({ error: 'Failed to parse trace file or unsupported format' }), {
          status: 400, // Bad Request or 422 Unprocessable Entity could also fit
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`Import successful for file: ${fileName}.`);

      // Attempt to extract basic info (adjust keys based on actual Speedscope format)
      // Use type assertion carefully or add proper type guards
      const profileData = speedscopeProfile as any; // Use with caution!
      durationMs = Math.round(profileData?.profiles?.[0]?.endValue ?? profileData?.maxValue ?? 0);
      profileType = profileData?.exporter ?? 'unknown';

      console.log(`Extracted from profile - duration: ${durationMs}ms, type: ${profileType}`);

    } catch (importError) {
      console.error(`Error during import process for ${fileName}:`, importError);
      // Log the error but return a generic message
      return new Response(JSON.stringify({ error: 'An error occurred while processing the trace file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 6. Compression
    let compressedBuffer: ArrayBuffer;
    let compressedSize = 0;
    try {
      const jsonString = JSON.stringify(speedscopeProfile);
      const uint8Array = new TextEncoder().encode(jsonString);
      console.log(`Speedscope profile stringified, size: ${uint8Array.byteLength} bytes`);
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

    // 7. Storage Upload
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

    // 8. Database Insert
    let insertedTraceData: object | null = null;
    try {
      console.log(`Attempting to insert trace record into database for user ${userId}`);
      const { data: dbData, error: dbError } = await supabaseAdmin
        .from('traces')
        .insert({
            user_id: userId,
            commit_sha: commitSha,
            branch: branch,
            scenario: scenario,
            device_model: deviceModel,
            duration_ms: durationMs,
            blob_path: storagePath,
            file_size_bytes: compressedSize, // Store compressed size
            profile_type: profileType,
            notes: notes,
            uploaded_at: new Date().toISOString(),
            // folder_id: folderId // Add if supporting folders via API
        })
        .select() // Select the newly created record
        .single();

      if (dbError) {
        console.error("Database insert failed:", dbError);
        // IMPORTANT: Attempt to clean up the orphaned storage object
        console.warn(`Database insert failed. Attempting to delete orphaned storage object: ${storagePath}`);
        const [bucketName, ...objectPathParts] = storagePath.split('/');
        const objectPath = objectPathParts.join('/');
        if (bucketName && objectPath) {
           await supabaseAdmin.storage.from(bucketName).remove([objectPath]);
           console.log(`Cleanup attempt for ${storagePath} finished.`);
        } else {
           console.error(`Could not parse bucket/path for cleanup: ${storagePath}`);
        }
        // Throw an error to be caught by the main try/catch
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      insertedTraceData = dbData;
      console.log(`Database insert successful. Trace ID: ${insertedTraceData?.id}`);

    } catch (dbInsertCatchError) {
      console.error(`Error during database insert phase for ${fileName}:`, dbInsertCatchError);
      // Don't need specific response here, main catch block handles it
      // Re-throw to ensure the main error handler sends a 500
      throw dbInsertCatchError;
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
