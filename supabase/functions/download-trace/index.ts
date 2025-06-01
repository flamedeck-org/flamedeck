// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { serve } from 'std/http/server.ts';
import { createClient, SupabaseClient } from 'supabase-js';
import { corsHeaders } from 'shared/cors.ts';
import { authenticateRequest } from 'shared/auth.ts';
import { z } from 'zod';

// --- Input Validation Schema ---
const queryParamsSchema = z.object({
  traceId: z.string().uuid('Invalid trace ID format'),
  format: z.enum(['json', 'original']).optional().default('json'),
});

// --- Authentication Types ---
type AuthResult = {
  userId: string;
  source: 'web' | 'api';
};

// --- Authentication Helper ---
async function authenticateDownloadRequest(
  req: Request,
  supabaseClient: SupabaseClient,
  supabaseAdmin: SupabaseClient
): Promise<AuthResult | Response> {
  const authHeader = req.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Try session-based auth first (web client)
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser(token);
      if (user && !error) {
        console.log(`Session authentication successful for user: ${user.id}`);
        return { userId: user.id, source: 'web' };
      }
    } catch (sessionError) {
      console.warn('Session auth failed, trying API key auth:', sessionError);
    }

    // If session auth failed, try API key authentication
    const authResult = await authenticateRequest(req, supabaseAdmin, ['trace:download']);
    if (authResult instanceof Response) {
      return authResult; // Return error response
    }

    console.log(`API key authentication successful for user: ${authResult.userId}`);
    return { userId: authResult.userId, source: 'api' };
  }

  // Check for x-api-key header
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) {
    const authResult = await authenticateRequest(req, supabaseAdmin, ['trace:download']);
    if (authResult instanceof Response) {
      return authResult;
    }
    return { userId: authResult.userId, source: 'api' };
  }

  // No valid authentication found
  return new Response(JSON.stringify({ error: 'Authentication required' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// --- Check Trace Access ---
async function checkTraceAccess(
  traceId: string,
  userId: string,
  supabaseAdmin: SupabaseClient
): Promise<{ blob_path: string; user_id: string } | null> {
  try {
    // Get trace info and check basic access
    const { data: trace, error: traceError } = await supabaseAdmin
      .from('traces')
      .select('id, user_id, blob_path')
      .eq('id', traceId)
      .single();

    if (traceError || !trace) {
      console.log(`Trace ${traceId} not found`);
      return null;
    }

    // Check if user owns the trace
    if (trace.user_id === userId) {
      return { blob_path: trace.blob_path, user_id: trace.user_id };
    }

    // Check if user has permission via trace_permissions (including public access)
    const { data: hasPermission, error: permissionError } = await supabaseAdmin
      .rpc('check_trace_permission', {
        p_trace_id: traceId,
        p_user_id: userId,
        min_role: 'viewer'
      });

    if (permissionError) {
      console.error('Error checking trace permission:', permissionError);
      return null;
    }

    if (hasPermission) {
      return { blob_path: trace.blob_path, user_id: trace.user_id };
    }

    // Check for public access (when user_id is null in trace_permissions)
    const { data: publicPermission, error: publicError } = await supabaseAdmin
      .from('trace_permissions')
      .select('role')
      .eq('trace_id', traceId)
      .is('user_id', null)
      .single();

    if (!publicError && publicPermission) {
      return { blob_path: trace.blob_path, user_id: trace.user_id };
    }

    return null;
  } catch (error) {
    console.error('Error in checkTraceAccess:', error);
    return null;
  }
}

console.log('download-trace function booting up...');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
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
    const authResult = await authenticateDownloadRequest(req, supabaseClient, supabaseAdmin);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { userId, source } = authResult;

    // Parse and validate query parameters
    const url = new URL(req.url);
    const queryParams = {
      traceId: url.searchParams.get('traceId'),
      format: url.searchParams.get('format') || 'json',
    };

    const validationResult = queryParamsSchema.safeParse(queryParams);
    if (!validationResult.success) {
      return new Response(JSON.stringify({
        error: 'Invalid query parameters',
        issues: validationResult.error.flatten().fieldErrors,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { traceId, format } = validationResult.data;

    console.log(`Processing ${source} download request for trace ${traceId} by user ${userId}`);

    // Check trace access
    const traceAccess = await checkTraceAccess(traceId, userId, supabaseAdmin);
    if (!traceAccess) {
      return new Response(JSON.stringify({
        error: 'Trace not found or access denied',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { blob_path } = traceAccess;

    // Parse storage path
    const pathParts = blob_path.split('/');
    if (pathParts.length < 2) {
      return new Response(JSON.stringify({
        error: 'Invalid trace storage path',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bucket = pathParts[0];
    const objectPath = pathParts.slice(1).join('/');

    console.log(`Downloading from storage: ${bucket}/${objectPath}`);

    // Download from storage
    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from(bucket)
      .download(objectPath);

    if (storageError || !storageData) {
      console.error('Storage download error:', storageError);
      return new Response(JSON.stringify({
        error: 'Failed to download trace data',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle different response formats
    if (format === 'original') {
      // Return the gzipped blob directly
      return new Response(storageData, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'Content-Disposition': `attachment; filename="trace-${traceId}.json.gz"`,
        },
      });
    } else {
      // Default: decompress and return JSON
      const decompressedStream = storageData.stream().pipeThrough(new DecompressionStream('gzip'));
      const decompressedData = await new Response(decompressedStream).text();

      return new Response(decompressedData, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="trace-${traceId}.json"`,
        },
      });
    }

  } catch (error) {
    console.error('Unhandled error in download-trace:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
