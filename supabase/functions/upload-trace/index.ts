// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { serve } from 'std/http/server.ts';
import { createClient, SupabaseClient } from 'supabase-js';
import { corsHeaders } from 'shared/cors.ts';
import { authenticateRequest } from 'shared/auth.ts';
import { generateFlamegraphImages } from 'shared/image-generator.ts';
import * as pako from 'pako';
import { JSON_parse } from 'uint8array-json-parser';
import Long from 'long';
import { z } from 'zod';
import {
  exportProfileGroup,
  getDurationMsFromProfileGroup,
  importProfilesFromArrayBuffer,
  ProfileType,
  type ImporterDependencies,
} from '../../../packages/speedscope-import/src/index.ts';

// --- Compression Utility ---
async function gzipCompressDeno(data: Uint8Array): Promise<ArrayBuffer> {
  const stream = new Response(data).body!.pipeThrough(new CompressionStream('gzip'));
  return await new Response(stream).arrayBuffer();
}

// --- Input Validation Schemas ---
const apiQueryParamsSchema = z.object({
  fileName: z.string().min(1, 'fileName is required'),
  scenario: z.string().optional().default('API Upload'),
  commitSha: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  folderId: z.string().uuid('Invalid folder ID format').nullable().optional(),
  public: z.boolean().optional().default(false),
});

const webFormDataSchema = z.object({
  scenario: z.string().min(1, 'scenario is required'),
  commitSha: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  folderId: z.string().uuid('Invalid folder ID format').nullable().optional(),
  public: z.boolean().optional().default(false),
});

// --- Authentication Types ---
type AuthResult = {
  userId: string;
  uploadSource: 'web' | 'api';
};

// --- Authentication Helper ---
async function authenticateUnifiedRequest(
  req: Request,
  supabaseClient: SupabaseClient,
  supabaseAdmin: SupabaseClient
): Promise<AuthResult | Response> {
  // Check for session-based authentication first (web client)
  const authHeader = req.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Try session-based auth first
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser(token);
      if (user && !error) {
        console.log(`Session authentication successful for user: ${user.id}`);
        return { userId: user.id, uploadSource: 'web' };
      }
    } catch (sessionError) {
      console.warn('Session auth failed, trying API key auth:', sessionError);
    }

    // If session auth failed, try API key authentication
    const authResult = await authenticateRequest(req, supabaseAdmin, ['trace:upload']);
    if (authResult instanceof Response) {
      return authResult; // Return error response
    }

    console.log(`API key authentication successful for user: ${authResult.userId}`);
    return { userId: authResult.userId, uploadSource: 'api' };
  }

  // Check for x-api-key header
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) {
    const authResult = await authenticateRequest(req, supabaseAdmin, ['trace:upload']);
    if (authResult instanceof Response) {
      return authResult;
    }
    return { userId: authResult.userId, uploadSource: 'api' };
  }

  // No valid authentication found
  return new Response(JSON.stringify({ error: 'Authentication required' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// --- File Processing Helper ---
async function processTraceFile(
  fileName: string,
  fileBuffer: ArrayBuffer,
  importerDeps: ImporterDependencies
): Promise<{
  compressedBuffer: ArrayBuffer;
  compressedSize: number;
  durationMs: number;
  profileType: ProfileType;
  profileJsonString: string;
}> {
  console.log(`Processing trace file: ${fileName}, size: ${fileBuffer.byteLength} bytes`);

  // Import and process the profile
  const importResult = await importProfilesFromArrayBuffer(fileName, fileBuffer, importerDeps);

  if (!importResult?.profileGroup) {
    throw new Error('Failed to parse trace file or unsupported format');
  }

  const { profileGroup, profileType } = importResult;

  // Calculate duration
  const durationMs = getDurationMsFromProfileGroup(profileGroup) ?? 0;

  console.log(`Profile processed - duration: ${durationMs}ms, type: ${profileType}`);

  // Export to serializable format
  const serializableProfile = exportProfileGroup(profileGroup);
  const jsonString = JSON.stringify(serializableProfile);
  const uint8Array = new TextEncoder().encode(jsonString);

  // Keep JSON string for image generation
  const profileJsonString = jsonString;

  // Compress the data for storage
  const compressedBuffer = await gzipCompressDeno(uint8Array);
  const compressedSize = compressedBuffer.byteLength;

  console.log(`Compression complete - original: ${uint8Array.byteLength}, compressed: ${compressedSize}`);

  return { compressedBuffer, compressedSize, durationMs, profileType, profileJsonString };
}

// --- Storage Upload Helper ---
async function uploadToStorage(
  supabaseAdmin: SupabaseClient,
  fileName: string,
  compressedBuffer: ArrayBuffer
): Promise<string> {
  const bucket = 'traces';
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const storageFileName = safeFileName.endsWith('.gz')
    ? `${crypto.randomUUID()}-${safeFileName}`
    : `${crypto.randomUUID()}-${safeFileName}.gz`;
  const filePathInBucket = `${timestamp}/${storageFileName}`;

  console.log(`Uploading to storage: ${bucket}/${filePathInBucket}`);

  const compressedBlob = new Blob([compressedBuffer], { type: 'application/json' });

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePathInBucket, compressedBlob, {
      contentType: 'application/json',
      cacheControl: 'public,max-age=31536000',
      upsert: false,
      duplex: 'half',
      headers: { 'Content-Encoding': 'gzip' },
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const storagePath = `${bucket}/${uploadData.path}`;
  console.log(`Storage upload successful: ${storagePath}`);
  return storagePath;
}

console.log('unified upload-trace function booting up...');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error('Missing Supabase environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, anonKey);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate the request
    const authResult = await authenticateUnifiedRequest(req, supabaseClient, supabaseAdmin);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { userId, uploadSource } = authResult;

    // Parse input based on content type
    let fileName: string;
    let fileBuffer: ArrayBuffer;
    let metadata: any;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Web client upload with FormData
      const formData = await req.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return new Response(JSON.stringify({ error: 'No file provided in form data' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      fileName = file.name;
      fileBuffer = await file.arrayBuffer();

      // Extract and validate form metadata
      const formMetadata = {
        scenario: formData.get('scenario'),
        commitSha: formData.get('commitSha') || null,
        branch: formData.get('branch') || null,
        notes: formData.get('notes') || null,
        folderId: formData.get('folderId') || null,
        public: formData.get('public') === 'true',
      };

      const validationResult = webFormDataSchema.safeParse(formMetadata);
      if (!validationResult.success) {
        return new Response(JSON.stringify({
          error: 'Invalid form data',
          issues: validationResult.error.flatten().fieldErrors,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      metadata = validationResult.data;
    } else {
      // API upload with binary data and query params
      fileBuffer = await req.arrayBuffer();

      if (!fileBuffer || fileBuffer.byteLength === 0) {
        return new Response(JSON.stringify({ error: 'Request body is empty or invalid' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Extract and validate query parameters
      const url = new URL(req.url);
      const queryParams = {
        fileName: url.searchParams.get('fileName'),
        scenario: url.searchParams.get('scenario'),
        commitSha: url.searchParams.get('commitSha'),
        branch: url.searchParams.get('branch'),
        notes: url.searchParams.get('notes'),
        folderId: url.searchParams.get('folderId'),
        public: url.searchParams.get('public') === 'true',
      };

      const validationResult = apiQueryParamsSchema.safeParse(queryParams);
      if (!validationResult.success) {
        return new Response(JSON.stringify({
          error: 'Invalid query parameters',
          issues: validationResult.error.flatten().fieldErrors,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      fileName = validationResult.data.fileName;
      metadata = validationResult.data;
    }

    console.log(`Processing ${uploadSource} upload: ${fileName} for user ${userId}`);

    // Create importer dependencies
    const importerDeps: ImporterDependencies = {
      inflate: pako.inflate,
      parseJsonUint8Array: JSON_parse,
      LongType: Long,
    };

    // Process the trace file
    let processedData;
    try {
      processedData = await processTraceFile(fileName, fileBuffer, importerDeps);
    } catch (processingError) {
      console.error(`Error processing file ${fileName}:`, processingError);
      return new Response(JSON.stringify({
        error: 'Failed to process trace file. The format might be unsupported or the file corrupted.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { compressedBuffer, compressedSize, durationMs, profileType, profileJsonString } = processedData;

    // Upload to storage
    let storagePath: string;
    try {
      storagePath = await uploadToStorage(supabaseAdmin, fileName, compressedBuffer);
    } catch (uploadError) {
      console.error(`Error uploading to storage:`, uploadError);
      return new Response(JSON.stringify({
        error: 'Failed to upload trace file to storage',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create database record
    try {
      const rpcParams = {
        p_user_id: userId,
        p_blob_path: storagePath,
        p_upload_source: uploadSource,
        p_make_public: metadata.public || false,
        p_commit_sha: metadata.commitSha,
        p_branch: metadata.branch,
        p_scenario: metadata.scenario,
        p_duration_ms: durationMs,
        p_file_size_bytes: compressedSize,
        p_profile_type: profileType,
        p_notes: metadata.notes,
        p_folder_id: metadata.folderId,
        p_light_image_path: null, // Will be updated by background image generation
        p_dark_image_path: null,  // Will be updated by background image generation
      };

      console.log('Creating trace record via RPC:', rpcParams);

      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('create_trace', rpcParams);

      if (rpcError) {
        console.error('RPC call to create_trace failed:', rpcError);

        // Cleanup storage object
        const [bucketName, ...objectPathParts] = storagePath.split('/');
        const objectPath = objectPathParts.join('/');
        if (bucketName && objectPath) {
          await supabaseAdmin.storage.from(bucketName).remove([objectPath]);
          console.log(`Cleaned up orphaned storage object: ${storagePath}`);
        }

        // Return proper error response with RPC error details instead of throwing
        return new Response(JSON.stringify({
          error: rpcError.message || 'Failed to create trace record',
          code: rpcError.code,
          details: rpcError.details,
          hint: rpcError.hint,
        }), {
          status: rpcError.code === 'P0002' ? 429 : 500, // 429 for rate limit, 500 for other errors
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const traceId = rpcData?.id;
      console.log(`Trace upload successful. ID: ${traceId}`);

      // Run image generation as a background task (non-blocking)
      if (traceId) {
        EdgeRuntime.waitUntil(
          generateBackgroundImages(traceId, profileJsonString, supabaseAdmin)
        );
      }

      return new Response(JSON.stringify(rpcData), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (dbError) {
      console.error(`Database error:`, dbError);
      return new Response(JSON.stringify({
        error: 'Failed to create trace record',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Unhandled error in unified upload-trace:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Background task function for image generation
async function generateBackgroundImages(
  traceId: string,
  profileJsonString: string,
  supabaseAdmin: SupabaseClient
): Promise<void> {
  try {
    console.log(`Starting background image generation for trace: ${traceId}`);

    const imageResults = await generateFlamegraphImages(
      traceId,
      profileJsonString,
      supabaseAdmin
    );

    // Update trace record with image paths if generation was successful
    if (imageResults.lightImagePath || imageResults.darkImagePath) {
      const { error: updateError } = await supabaseAdmin
        .from('traces')
        .update({
          light_image_path: imageResults.lightImagePath,
          dark_image_path: imageResults.darkImagePath,
        })
        .eq('id', traceId);

      if (updateError) {
        console.error(`Failed to update trace ${traceId} with image paths:`, updateError);
      } else {
        console.log(`Successfully updated trace ${traceId} with image paths - light: ${!!imageResults.lightImagePath}, dark: ${!!imageResults.darkImagePath}`);
      }
    }
  } catch (error) {
    console.warn(`Background image generation failed for trace ${traceId}:`, error);
    // Don't throw - this is a background task
  }
}
