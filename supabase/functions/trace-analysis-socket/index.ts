// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log('Trace Analysis WebSocket function booting up!');

// Supabase client for invoking the other function
// NOTE: Use anon key here; function invocation permissions should be set appropriately
// or JWT should be passed/enforced.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req: Request) => {
  // Basic check for Supabase client config
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      'Missing Supabase URL, Anon Key, or Service Role Key environment variables for function invocation.'
    );
    // Allow upgrade to proceed but log error. Invocation will fail later.
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

  // Upgrade connection
  const { socket, response: upgradeResponse } = Deno.upgradeWebSocket(req);

  // Add CORS headers to the WebSocket upgrade response
  for (const [key, value] of Object.entries(corsHeaders)) {
    upgradeResponse.headers.set(key, value);
  }

  // Listen for websocket events
  socket.onopen = () => {
    console.log('WebSocket connection opened! Waiting for start_analysis.');
  };

  socket.onmessage = async (event) => {
    console.log('WebSocket message received:', event.data);
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

    const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false }, // Important for server-side
    });

    try {
      if (parsedData.type === 'start_analysis') {
        // **SECURITY NOTE:** In production, get userId from JWT during upgrade or first message!
        const { userId, traceId } = parsedData;
        if (!userId) {
          socket.send(
            JSON.stringify({
              type: 'error',
              message: "'start_analysis' requires a 'userId' field.",
            })
          );
          socket.close(1008, 'Missing userId'); // Close connection if auth fails
          return;
        }
        console.log(
          `[trace-analysis-socket] Handling start_analysis for user: ${userId}, trace: ${traceId}`
        );
        socket.send(
          JSON.stringify({
            type: 'connection_ack',
            message: 'Requesting initial analysis...',
          })
        );

        const initialPayload = {
          userId: userId,
          traceId: traceId,
          modelProvider: 'openai',
          modelName: 'gpt-4o-mini',
          isInitialAnalysis: true,
          prompt: 'Analyze this trace and provide an initial summary.',
          history: [],
        };

        // --- Add detailed logging and try/catch around invocation ---
        console.log(
          '[trace-analysis-socket] Preparing to invoke process-ai-turn with payload:',
          initialPayload
        );
        try {
          const { data: invokeData, error: initialInvokeError } =
            await supabaseClient.functions.invoke('process-ai-turn', { body: initialPayload });

          // Log result regardless of error status for debugging
          console.log(
            '[trace-analysis-socket] Invocation result - Data:',
            invokeData,
            'Error:',
            initialInvokeError
          );

          if (initialInvokeError) {
            console.error(
              '[trace-analysis-socket] Error invoking process-ai-turn for initial analysis:',
              initialInvokeError
            );
            socket.send(
              JSON.stringify({
                type: 'error',
                message: `Failed to start initial analysis: ${initialInvokeError.message}`,
              })
            );
          }
          // Response will come via Realtime if invocation succeeded
        } catch (invokeCatchError) {
          console.error(
            '[trace-analysis-socket] Caught exception during function invocation:',
            invokeCatchError
          );
          socket.send(
            JSON.stringify({
              type: 'error',
              // Check if invokeCatchError is an instance of Error
              message: `Internal error invoking analysis function: ${invokeCatchError instanceof Error ? invokeCatchError.message : String(invokeCatchError)}`,
            })
          );
        }
        // -----------------------------------------------------------
      } else if (parsedData.type === 'user_prompt') {
        // --- Get context DIRECTLY from payload ---
        const { userId, traceId, prompt: userPrompt, history } = parsedData;
        console.log(
          `[trace-analysis-socket] User prompt received. User: ${userId}, Trace: ${traceId}`
        );

        // Validate required fields from payload
        if (!userId || !traceId || !userPrompt) {
          console.error(
            '[trace-analysis-socket] user_prompt message missing required fields (userId, traceId, prompt).'
          );
          socket.send(
            JSON.stringify({
              type: 'error',
              message: 'Internal error: Missing required context in prompt message.',
            })
          );
          return;
        }

        const payload = {
          userId: userId,
          prompt: userPrompt,
          traceId: traceId,
          history: history || [],
          modelProvider: 'openai',
          modelName: 'gpt-4o-mini',
          isInitialAnalysis: false,
        };

        console.log(`Invoking process-ai-turn for user prompt, user ${payload.userId}`);
        socket.send(
          JSON.stringify({
            type: 'waiting_for_model',
            message: 'Processing request...',
          })
        );

        const { error: invokeError } = await supabaseClient.functions.invoke('process-ai-turn', {
          body: payload,
        });

        if (invokeError) {
          console.error('Error invoking process-ai-turn function:', invokeError);
          socket.send(
            JSON.stringify({
              type: 'error',
              message: `Failed to start AI processing: ${invokeError.message}`,
            })
          );
        }
        // Success means the function was invoked; result comes via Realtime
      } else {
        console.warn('Received unknown message type:', parsedData.type);
        socket.send(JSON.stringify({ type: 'echo_unknown', payload: parsedData }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      socket.send(
        JSON.stringify({
          type: 'error',
          // Check if error is an instance of Error
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

  return upgradeResponse; // Return the response (now with CORS headers) to finalize the upgrade
});
