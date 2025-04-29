// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Pin specific versions AND esm.sh build version (v135) 
import { HumanMessage, AIMessage, BaseMessage } from "https://esm.sh/v135/@langchain/core@0.2.10/messages";
import { ChatOpenAI } from "https://esm.sh/v135/@langchain/openai@0.2.1";

console.log(`Function process-ai-turn booting up!`)

// IMPORTANT: Set these environment variables in your Supabase project settings
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Helper function to map client history to LangChain messages
function mapHistoryToMessages(history: { sender: 'user' | 'model', text: string }[]): BaseMessage[] {
    return history.map(msg => {
        if (msg.sender === 'user') {
            return new HumanMessage(msg.text);
        } else if (msg.sender === 'model') {
            return new AIMessage(msg.text);
        } else {
            // Should not happen based on client filter, but handle defensively
            console.warn("Unexpected message sender in history:", msg.sender);
            return new HumanMessage(""); // Or throw error?
        }
    }).filter(msg => msg.content !== ""); // Filter out any empty messages just in case
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Check for required environment variables
  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing environment variables");
      return new Response(JSON.stringify({ error: "Internal configuration error." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
      });
  }

  let userId, prompt, traceId, modelProvider, modelName, history
  try {
      const body = await req.json();
      userId = body.userId;
      prompt = body.prompt;
      traceId = body.traceId;
      modelProvider = body.modelProvider || 'openai';
      modelName = body.modelName || 'gpt-4o-mini';
      history = body.history || []; // Receive history array

      if (!userId || !prompt || !traceId) {
          throw new Error("Missing required fields: userId, prompt, traceId");
      }
  } catch (error) {
      console.error('Failed to parse request body or missing fields:', error)
      return new Response(JSON.stringify({ error: error.message || 'Bad Request' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
      })
  }

  console.log(`Processing prompt for user ${userId}, trace ${traceId} with history length ${history.length}`);

  // Initialize Supabase admin client
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false } // Prevent storing session for server-side client
  });

  // Define the Realtime channel for this user
  const channelName = `private-chat-results-${userId}`;
  const channel = supabaseAdmin.channel(channelName);

  try {
      // --- Model Selection (Set streaming: true) --- 
      let chatModel;
      if (modelProvider === 'openai') {
          chatModel = new ChatOpenAI({
              apiKey: OPENAI_API_KEY,
              modelName: modelName,
              temperature: 0.1, 
              streaming: true, // <-- Enable streaming
          });
      } 
      // else if (modelProvider === 'anthropic') { ... }
       else {
          throw new Error(`Unsupported model provider: ${modelProvider}`);
      }

      // --- Map history and stream model response --- 
      const historyMessages = mapHistoryToMessages(history);
      const fullPrompt = [...historyMessages, new HumanMessage(prompt)];
      
      console.log(`Streaming model response for user ${userId}...`);
      const stream = await chatModel.stream(fullPrompt); // <-- Use .stream()

      let finalContent = ""; // Keep track of the full response if needed
      let firstChunkSent = false;

      // --- Stream chunks to Realtime --- 
      for await (const chunk of stream) {
          if (chunk.content) {
              finalContent += chunk.content;
              const payloadType = firstChunkSent ? 'model_chunk_append' : 'model_chunk_start';
              // Send chunk immediately
              await channel.send({
                  type: 'broadcast',
                  event: 'ai_response', 
                  payload: { 
                      type: payloadType,
                      chunk: chunk.content 
                  },
              });
              firstChunkSent = true;
          }
      }

      // --- Send stream end signal --- 
      await channel.send({
        type: 'broadcast', 
        event: 'ai_response',
        payload: { type: 'model_response_end' }
      });

      console.log(`Finished streaming AI response for user ${userId}`);

      // Return success (response isn't directly used by caller)
      return new Response(JSON.stringify({ success: true, message: "AI response streamed and published." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
      });

  } catch (error) {
      console.error(`Error streaming/processing AI request for user ${userId}:`, error);
      // Publish error to Realtime
      try {
          await channel.send({
              type: 'broadcast', 
              event: 'ai_response', 
              payload: {
                  type: 'error',
                  message: error instanceof Error ? error.message : "An internal error occurred during AI processing."
              }
          });
      } catch (publishError) {
           console.error(`Failed to publish AI error to Realtime channel ${channelName}:`, publishError);
      }
      // Return error response
      return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
      });
  }
});
