// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Trace Analysis WebSocket function booting up!")

// Store active user IDs per connection (simple in-memory store)
// NOTE: This is basic; a more robust solution might be needed for scaling.
// We store userId to know who to invoke the processor function for.
const activeConnections = new Map<WebSocket, { userId: string }>();

// Supabase client for invoking the other function
// NOTE: Use anon key here; function invocation permissions should be set appropriately
// or JWT should be passed/enforced.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

serve(async (req: Request) => {
  // Basic check for Supabase client config
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing Supabase URL or Anon Key environment variables for function invocation.");
    // Allow upgrade to proceed but log error. Invocation will fail later.
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Expecting websocket upgrade request
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Request isn't trying to upgrade to websocket.", { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  // Upgrade connection, passing CORS headers directly
  const { socket, response } = Deno.upgradeWebSocket(req, {
    // Pass headers required for the WebSocket handshake response, including CORS
    headers: new Headers(corsHeaders), 
  });

  // Listen for websocket events
  socket.onopen = () => {
    console.log("WebSocket connection opened! Waiting for start_analysis with userId.");
    // Don't send ack until we have userId
    // socket.send(JSON.stringify({ type: "connection_ack", message: "Connected. Send analysis request." }));
  };

  socket.onmessage = async (event) => {
    console.log("WebSocket message received:", event.data);
    let parsedData;
    try {
      parsedData = JSON.parse(event.data);
    } catch (e) {
      console.error("Failed to parse message:", event.data);
      socket.send(JSON.stringify({ type: "error", message: "Invalid JSON message received." }));
      return;
    }

    const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!,{
         auth: { persistSession: false } // Important for server-side
    });

    try {
      if (parsedData.type === 'start_analysis') {
        // **SECURITY NOTE:** In production, get userId from JWT, not payload!
        const { userId, modelProvider, modelName, traceId } = parsedData;
        if (!userId) {
            socket.send(JSON.stringify({ type: "error", message: "'start_analysis' requires a 'userId' field." }));
            socket.close(1008, "Missing userId"); // Close connection if auth fails
            return;
        }
        console.log(`Received start_analysis for user: ${userId}`);
        activeConnections.set(socket, { userId });
        socket.send(JSON.stringify({ type: "connection_ack", message: "Analysis service ready." }));

        // Maybe invoke processor immediately with a default prompt?
        // Or wait for first user_prompt.

      } else if (parsedData.type === 'user_prompt') {
        const connectionInfo = activeConnections.get(socket);
        if (!connectionInfo) {
          socket.send(JSON.stringify({ type: "error", message: "Connection not initialized. Send 'start_analysis' first." }));
          return;
        }

        const userPrompt = parsedData.prompt;
        if (!userPrompt) {
          socket.send(JSON.stringify({ type: "error", message: "'user_prompt' message requires a 'prompt' field." }));
          return;
        }

        // Prepare payload for the other function, including history
        const payload = {
            userId: connectionInfo.userId,
            prompt: userPrompt,
            traceId: parsedData.traceId, 
            modelProvider: parsedData.modelProvider, 
            modelName: parsedData.modelName,
            history: parsedData.history || [] // Include history from client payload
        };

        console.log(`Invoking process-ai-turn for user ${payload.userId} with history length ${payload.history.length}`);
        socket.send(JSON.stringify({ type: "waiting_for_model", message: "Processing request..." }));

        // Invoke the other function asynchronously
        const { error: invokeError } = await supabaseClient.functions.invoke(
            'process-ai-turn', 
            { body: payload } 
        );

        if (invokeError) {
            console.error("Error invoking process-ai-turn function:", invokeError);
            socket.send(JSON.stringify({ type: "error", message: `Failed to start AI processing: ${invokeError.message}` }));
        }
         // Success means the function was invoked; result comes via Realtime

      } else {
        console.warn("Received unknown message type:", parsedData.type);
        socket.send(JSON.stringify({ type: "echo_unknown", payload: parsedData }));
      }
    } catch (error) {
      console.error("Error processing message:", error);
      socket.send(JSON.stringify({ type: "error", message: error.message || "An internal error occurred." }));
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    activeConnections.delete(socket);
  };

  socket.onclose = (event) => {
    console.log("WebSocket connection closed:", event.code, event.reason);
    activeConnections.delete(socket);
  };

  return response; // Return the response to finalize the upgrade
});
