// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Trace Analysis WebSocket function booting up!');

// Supabase client for invoking the other function
// NOTE: Use anon key here; function invocation permissions should be set appropriately
// or JWT should be passed/enforced.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// New environment variables for calling the Node.js server
const FLAMECHART_SERVER_BASE_URL = Deno.env.get('FLAMECHART_SERVER_URL');
const PROCESS_AI_TURN_SECRET = Deno.env.get('PROCESS_AI_TURN_SECRET');

serve(async (req: Request) => {
  // Basic check for Supabase client config
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      'Missing Supabase URL, Anon Key, or Service Role Key environment variables for function invocation.'
    );
    // Allow upgrade to proceed but log error. Invocation will fail later.
  }

  if (!FLAMECHART_SERVER_BASE_URL || !PROCESS_AI_TURN_SECRET) {
    console.error(
      'Missing FLAMECHART_SERVER_BASE_URL or PROCESS_AI_TURN_SECRET for AI processing call.'
    );
    // Allow upgrade, but calls will fail.
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Expecting websocket upgrade request
  if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return new Response("Request isn't trying to upgrade to websocket.", {
      status: 400,
      headers: corsHeaders, // CORS headers for non-WebSocket error response
    });
  }

  const { socket, response: upgradeResponse } = Deno.upgradeWebSocket(req, {
    // @ts-expect-error headers can be passed here
    headers: new Headers(corsHeaders), // Pass CORS headers directly
  });

  // Listen for websocket events (using the structure from the older working version, but with our enhanced logs)
  socket.onopen = () => {
    console.log('WebSocket connection opened! Waiting for messages.');
  };

  socket.onmessage = async (event) => {
    console.log('[trace-analysis-socket] WebSocket message received:', event.data);
    let parsedData;
    try {
      parsedData = JSON.parse(event.data);
    } catch (e) {
      console.error('Failed to parse message:', event.data);
      socket.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid JSON message received.',
        })
      );
      return;
    }

    try {
      if (parsedData.type === 'start_analysis') {
        const { userId, traceId, sessionId } = parsedData;
        if (!userId || !traceId || !sessionId) {
          const errorMsg = `Message type 'start_analysis' missing required fields (userId, traceId, sessionId).`;
          console.error(`[trace-analysis-socket] ${errorMsg}`);
          socket.send(JSON.stringify({ type: 'error', message: errorMsg }));
          socket.close(1008, 'Missing required fields');
          return;
        }
        console.log(
          `[trace-analysis-socket] Handling start_analysis for user: ${userId}, trace: ${traceId}, session: ${sessionId}`
        );
        socket.send(
          JSON.stringify({ type: 'connection_ack', message: 'Requesting initial analysis...' })
        );

        const aiServerPayload = {
          userId: userId,
          traceId: traceId,
          sessionId: sessionId,
          prompt: 'Analyze this trace and provide an initial summary.',
        };

        console.log(
          '[trace-analysis-socket] Calling Node.js AI server with payload:',
          aiServerPayload
        );

        if (!FLAMECHART_SERVER_BASE_URL || !PROCESS_AI_TURN_SECRET) {
          const errMsg = 'AI Server configuration missing in edge function.';
          console.error(`[trace-analysis-socket] ${errMsg}`);
          socket.send(
            JSON.stringify({ type: 'error', message: `Internal configuration error: ${errMsg}` })
          );
          return;
        }

        try {
          const nodeServerResponse = await fetch(
            `${FLAMECHART_SERVER_BASE_URL}/api/v1/ai/process-turn`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Auth-Token': PROCESS_AI_TURN_SECRET,
              },
              body: JSON.stringify(aiServerPayload),
            }
          );

          if (!nodeServerResponse.ok) {
            let errorDetail = 'Failed to call AI processing server.';
            try {
              const errorBody = await nodeServerResponse.json();
              errorDetail = errorBody.error || errorBody.message || errorDetail;
            } catch (e) {
              /* ignore if error body is not json or empty */
            }

            console.error(
              `[trace-analysis-socket] Error calling Node.js AI server: ${nodeServerResponse.status} - ${errorDetail}`
            );
            socket.send(
              JSON.stringify({
                type: 'error',
                message: `Failed to start AI processing: ${errorDetail} (status ${nodeServerResponse.status})`,
              })
            );
          } else {
            console.log(
              '[trace-analysis-socket] Node.js AI server accepted the start_analysis request.'
            );
            // Response is now streamed via Realtime from the Node.js server
          }
        } catch (fetchErr) {
          console.error(
            '[trace-analysis-socket] Network error during fetch to Node.js AI server:',
            fetchErr
          );
          socket.send(
            JSON.stringify({
              type: 'error',
              message: `Network error connecting to AI service: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`,
            })
          );
        }
      } else if (parsedData.type === 'user_prompt') {
        const { userId, traceId, prompt: userPrompt, sessionId } = parsedData;

        if (!userId || !traceId || !userPrompt || !sessionId) {
          const errorMsg = `Message type 'user_prompt' missing required fields (userId, traceId, prompt, sessionId).`;
          console.error(`[trace-analysis-socket] ${errorMsg}`);
          socket.send(JSON.stringify({ type: 'error', message: errorMsg }));
          return;
        }
        console.log(
          `[trace-analysis-socket] Handling user_prompt for user: ${userId}, trace: ${traceId}, session: ${sessionId}`
        );
        socket.send(
          JSON.stringify({ type: 'waiting_for_model', message: 'Processing request...' })
        );

        const aiServerPayload = {
          userId: userId,
          traceId: traceId,
          prompt: userPrompt,
          sessionId: sessionId,
        };

        console.log(
          '[trace-analysis-socket] Calling Node.js AI server with payload:',
          aiServerPayload
        );

        if (!FLAMECHART_SERVER_BASE_URL || !PROCESS_AI_TURN_SECRET) {
          const errMsg = 'AI Server configuration missing in edge function.';
          console.error(`[trace-analysis-socket] ${errMsg}`);
          socket.send(
            JSON.stringify({ type: 'error', message: `Internal configuration error: ${errMsg}` })
          );
          return;
        }

        try {
          const nodeServerResponse = await fetch(
            `${FLAMECHART_SERVER_BASE_URL}/api/v1/ai/process-turn`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Auth-Token': PROCESS_AI_TURN_SECRET,
              },
              body: JSON.stringify(aiServerPayload),
            }
          );

          if (!nodeServerResponse.ok) {
            let errorDetail = 'Failed to call AI processing server.';
            try {
              const errorBody = await nodeServerResponse.json();
              errorDetail = errorBody.error || errorBody.message || errorDetail;
            } catch (e) {
              /* ignore if error body is not json or empty */
            }

            console.error(
              `[trace-analysis-socket] Error calling Node.js AI server: ${nodeServerResponse.status} - ${errorDetail}`
            );
            socket.send(
              JSON.stringify({
                type: 'error',
                message: `Failed to start AI processing: ${errorDetail} (status ${nodeServerResponse.status})`,
              })
            );
          } else {
            console.log(
              '[trace-analysis-socket] Node.js AI server accepted the user_prompt request.'
            );
            // Response is now streamed via Realtime from the Node.js server
          }
        } catch (fetchErr) {
          console.error(
            '[trace-analysis-socket] Network error during fetch to Node.js AI server:',
            fetchErr
          );
          socket.send(
            JSON.stringify({
              type: 'error',
              message: `Network error connecting to AI service: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`,
            })
          );
        }
      } else {
        console.warn('Received unknown message type:', parsedData.type);
        socket.send(JSON.stringify({ type: 'echo_unknown', payload: parsedData }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      socket.send(
        JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'An internal error occurred.',
        })
      );
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.onclose = (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);
  };

  return upgradeResponse; // Return the response to finalize the upgrade
});
