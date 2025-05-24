// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Trace Analysis HTTP function booting up!');

// Environment variables for calling the Node.js server
const FLAMECHART_SERVER_BASE_URL = Deno.env.get('FLAMECHART_SERVER_URL');
const PROCESS_AI_TURN_SECRET = Deno.env.get('PROCESS_AI_TURN_SECRET');
const AI_ANALYSIS_MODEL = Deno.env.get('AI_ANALYSIS_MODEL');

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { ...corsHeaders, Allow: 'POST' },
    });
  }

  if (!FLAMECHART_SERVER_BASE_URL || !PROCESS_AI_TURN_SECRET) {
    console.error(
      '[trace-analysis] Missing FLAMECHART_SERVER_BASE_URL or PROCESS_AI_TURN_SECRET.'
    );
    return new Response(
      JSON.stringify({ error: 'Internal server configuration error.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  let parsedData;
  try {
    parsedData = await req.json();
    console.log(parsedData)
  } catch (e) {
    console.error('[trace-analysis] Failed to parse request JSON body:', e);
    return new Response(JSON.stringify({ error: 'Invalid JSON request body.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { type, userId, traceId, sessionId, prompt: userPromptInput } = parsedData;

  if (!type || !userId || !traceId || !sessionId) {
    const errorMsg =
      "Request body missing required fields. Expected 'type', 'userId', 'traceId', 'sessionId'.";
    console.error(`[trace-analysis] ${errorMsg} Received:`, parsedData);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let promptForAiServer: string;
  if (type === 'start_analysis') {
    console.log(
      `[trace-analysis] Handling start_analysis for user: ${userId}, trace: ${traceId}, session: ${sessionId}`
    );
    promptForAiServer = 'Analyze this trace and provide an initial summary.';
  } else if (type === 'user_prompt') {
    if (!userPromptInput) {
      const errorMsg = "Request body missing 'prompt' for type 'user_prompt'.";
      console.error(`[trace-analysis] ${errorMsg} Received:`, parsedData);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(
      `[trace-analysis] Handling user_prompt for user: ${userId}, trace: ${traceId}, session: ${sessionId}`
    );
    promptForAiServer = userPromptInput;
  } else {
    const errorMsg = `Unknown request type: '${type}'. Must be 'start_analysis' or 'user_prompt'.`;
    console.error(`[trace-analysis] ${errorMsg} Received:`, parsedData);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const aiServerPayload = {
    userId: userId,
    traceId: traceId,
    sessionId: sessionId,
    prompt: promptForAiServer,
    modelName: AI_ANALYSIS_MODEL,
  };

  console.log('[trace-analysis] Calling Node.js AI server with payload:', aiServerPayload);

  try {
    const nodeServerResponse = await fetch(
      `${FLAMECHART_SERVER_BASE_URL}/api/v1/ai/process-turn`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-auth-token': PROCESS_AI_TURN_SECRET as string,
        },
        body: JSON.stringify(aiServerPayload),
      }
    );

    // Relay the response from flamechart-server (status, body, headers)
    const responseBody = await nodeServerResponse.arrayBuffer(); // Get body as ArrayBuffer
    const responseHeaders = new Headers(nodeServerResponse.headers); // Clone headers
    // Ensure CORS headers are present on the relayed response
    for (const key in corsHeaders) {
      responseHeaders.set(key, corsHeaders[key as keyof typeof corsHeaders]);
    }

    // If flamechart-server sent application/json, ensure it's set for the client
    if (!responseHeaders.has('Content-Type') && nodeServerResponse.headers.get('content-type')?.includes('application/json')) {
      responseHeaders.set('Content-Type', 'application/json');
    }


    console.log(
      `[trace-analysis] Relaying response from Node.js AI server. Status: ${nodeServerResponse.status}`
    );
    return new Response(responseBody, {
      status: nodeServerResponse.status,
      headers: responseHeaders,
    });
  } catch (fetchErr) {
    console.error(
      '[trace-analysis] Network error during fetch to Node.js AI server:',
      fetchErr
    );
    return new Response(
      JSON.stringify({
        error: `Network error connecting to AI service: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`,
      }),
      {
        status: 503, // Service Unavailable
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
