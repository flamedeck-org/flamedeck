// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Pin specific versions AND esm.sh build version (v135) 
// import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "https://esm.sh/v135/@langchain/core@0.2.10/messages";
// import { ChatOpenAI } from "https://esm.sh/v135/@langchain/openai@0.2.1";
import * as pako from "https://esm.sh/pako@2.1.0"; // For potential decompression
// Use npm: specifier without version for reliability in Deno
import { JSON_parse } from 'npm:uint8array-json-parser'; 
import Long from 'npm:long'; // Use specific version matching api-upload-trace
// Import from shared-importer (adjust path if necessary)
import { 
    type ImporterDependencies, 
    importProfilesFromArrayBuffer,
    getDurationMsFromProfileGroup,
    type ProfileGroup,
    type Profile,
    type Frame,
    formatPercent
} from '../../../packages/shared-importer/src/index.ts'; 
// import { z } from "https://esm.sh/zod@3.23.8";
// import { DynamicTool } from "https://esm.sh/v135/@langchain/core@0.2.10/tools";
// import { 
//     createOpenAIToolsAgent, 
//     AgentExecutor 
// } from "https://esm.sh/v135/langchain@0.2.10/agents";
// import { 
//     ChatPromptTemplate, 
//     MessagesPlaceholder 
// } from "https://esm.sh/v135/@langchain/core@0.2.10/prompts";
import { loadProfileData, type ProfileLoadResult } from "../_shared/profile-loader.ts"; // <-- Import shared loader
import { 
    getTopFunctionsToolSchema, 
    executeGetTopFunctions 
} from "./trace-tools.ts"; // <-- Import tool schema and executor
import OpenAI from "npm:openai@^4.0.0";
import { type ChatCompletionMessageParam, type ChatCompletionTool } from "npm:openai/resources/chat/completions"; // Import needed types

console.log(`Function process-ai-turn booting up!`)

// IMPORTANT: Set these environment variables in your Supabase project settings
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// --- Map history to OpenAI message format --- 
function mapHistoryToOpenAIMessages(history: { sender: 'user' | 'model', text: string }[]) {
    console.log("[mapHistory] Input history:", history); // Log input
    const mapped = history.map(msg => {
        let role: "user" | "assistant";
        let content = msg.text;
        if (msg.sender === 'user') {
            role = "user";
        } else { // Model maps to assistant
            role = "assistant";
        }
        // Ensure content is never null/undefined here either
        if (content == null) {
            console.warn("[mapHistory] Found null/undefined content in history message:", msg);
            content = ""; 
        }
        return { role, content };
    });
    console.log("[mapHistory] Mapped messages:", mapped); // Log output
    return mapped;
}

// --- System Prompt --- 
const SYSTEM_PROMPT = `You are an expert performance analysis assistant specializing in interpreting trace files in the Speedscope format. 
Analyze the provided trace data summary and answer user questions about performance bottlenecks, function timings, and call stacks. 
**Use the available tools to answer questions that require specific data not present in the summary, such as requesting the top N functions by time.** Be concise and focus on actionable insights.`;

const toolsForApi: ChatCompletionTool[] = [getTopFunctionsToolSchema];

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

  let userId, prompt, traceId, history, isInitialAnalysis, modelName, modelProvider;
  try {
      const body = await req.json();
      userId = body.userId;
      prompt = body.prompt;
      traceId = body.traceId;
      history = body.history || [];
      isInitialAnalysis = body.isInitialAnalysis || false; // Get the flag
      modelName = body.modelName || 'gpt-4o-mini';
      modelProvider = body.modelProvider || 'openai';

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

  console.log(`Processing request for user ${userId}, trace ${traceId}. Initial: ${isInitialAnalysis}`);

  const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const channelName = `private-chat-results-${userId}`;
  const channel = supabaseAdmin.channel(channelName);
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    // --- Load Profile Data ONCE --- 
    const { data: traceRecord, error: dbError } = await supabaseAdmin.from('traces').select('blob_path').eq('id', traceId).single();
    if (dbError || !traceRecord?.blob_path) { /* ... handle error ... */ }
    const blobPath = traceRecord.blob_path;
    const loadedData: ProfileLoadResult = await loadProfileData(supabaseAdmin, blobPath);
    if (!loadedData?.profileGroup) { throw new Error(`Failed to load profile data for trace ${traceId}`); }
    const profileData = loadedData.profileGroup;
    const profileType = loadedData.profileType;
    const summary = JSON.stringify({
        name: profileData.name ?? 'N/A',
        profileType: profileType ?? 'N/A', // Use profileType from result
        totalDurationMs: getDurationMsFromProfileGroup(profileData) ?? 'N/A',
        frameCount: profileData.shared?.frames?.length ?? 'N/A',
    }, null, 2);
    // ---------------------------------

    // --- Initial Message Formatting ---
    const historyMessages = mapHistoryToOpenAIMessages(history);
    const initialMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\nTrace Summary:\n${summary}` },
      ...historyMessages,
      { role: "user", content: prompt }
    ];

    console.log(`Sending initial request to OpenAI API for user ${userId}...`);
    
    // --- First API Call (Check for tool use) --- 
    const initialResponse = await openai.chat.completions.create({
      model: modelName || "gpt-4o-mini",
      messages: initialMessages,
      tools: toolsForApi, // <-- Pass tool schema
      tool_choice: "auto", // <-- Let model decide
      // stream: false, // Cannot stream when checking for tool calls first
    });

    const responseMessage = initialResponse.choices[0]?.message;

    // --- Check if a tool needs to be called --- 
    if (responseMessage?.tool_calls) {
        console.log(`[process-ai-turn] Tool call requested by model:`, responseMessage.tool_calls);
        
        // Ensure content is not null before pushing to history
        const assistantMessageForHistory: ChatCompletionMessageParam = {
            ...responseMessage,
            content: responseMessage.content ?? "", // Use empty string if null
        };
        initialMessages.push(assistantMessageForHistory);

        // --- Execute Tools and Collect Results ---
        for (const toolCall of responseMessage.tool_calls) {
            if (toolCall.function.name === getTopFunctionsToolSchema.function.name) {
                // Send tool start event via Realtime
                await channel.send({ type: 'broadcast', event: 'ai_response', payload: { type: 'tool_start', toolName: toolCall.function.name, message: `Using tool: ${toolCall.function.name}...` } });
                
                let toolResultContent: string;
                try {
                    const toolArgs = JSON.parse(toolCall.function.arguments);
                    toolResultContent = executeGetTopFunctions(profileData, toolArgs);
                } catch (e) {
                    console.error(`[process-ai-turn] Error parsing tool args or executing tool:`, e);
                    toolResultContent = `Error: Failed to execute tool ${toolCall.function.name} - ${e.message}`;
                }
                
                // Send tool end event via Realtime (optional)
                // await channel.send({ type: 'broadcast', event: 'ai_response', payload: { type: 'tool_end', output: toolResultContent } });
                
                // *** Log tool result before adding ***
                console.log(`[process-ai-turn] Tool call ${toolCall.id} result content (type: ${typeof toolResultContent}):`, toolResultContent);
                // *************************************
                
                // Append the tool result message for the next API call
                initialMessages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    content: toolResultContent,
                });
            } else {
                 console.warn(`[process-ai-turn] Model requested unknown tool: ${toolCall.function.name}`);
                 // Optionally append an error message back?
            }
        }
        // ------------------------------------------

        // --- Second API Call (With Tool Results) ---
        console.log("[process-ai-turn] Sending second request to OpenAI with tool results...");
        // *** Log the exact messages being sent *** 
        console.log("[process-ai-turn] Messages for API call 2:", JSON.stringify(initialMessages, null, 2));
        // ****************************************
        const secondStream = await openai.chat.completions.create({
            model: modelName || "gpt-4o-mini",
            messages: initialMessages, // Send history + assistant msg + tool results
            stream: true, // Stream the final response
        });

        // Stream the response from the SECOND call
        let firstChunkSent = false;
        for await (const chunk of secondStream) {
             const contentChunk = chunk.choices[0]?.delta?.content || "";
             if (contentChunk) {
                // ... (publish model_chunk_start/append via Realtime) ...
                 const payloadType = firstChunkSent ? 'model_chunk_append' : 'model_chunk_start';
                 await channel.send({ type: 'broadcast', event: 'ai_response', payload: { type: payloadType, chunk: contentChunk } });
                 firstChunkSent = true;
             }
        }
        // ------------------------------------------

    } else {
        // --- No Tool Call: Stream Response from First Call --- 
        console.log(`[process-ai-turn] No tool call requested. Streaming initial response.`);
        // If the initial response wasn't streamed, we need to send its content.
        // For simplicity now, let's re-request with streaming if no tool call.
        // TODO: Optimize this - potentially check initial response content first.
        const stream = await openai.chat.completions.create({
            model: modelName || "gpt-4o-mini",
            messages: initialMessages,
            stream: true,
        });
        let firstChunkSent = false;
        for await (const chunk of stream) {
            const contentChunk = chunk.choices[0]?.delta?.content || "";
            if (contentChunk) {
               // ... (publish model_chunk_start/append via Realtime) ...
               const payloadType = firstChunkSent ? 'model_chunk_append' : 'model_chunk_start';
               await channel.send({ type: 'broadcast', event: 'ai_response', payload: { type: payloadType, chunk: contentChunk } });
               firstChunkSent = true;
            }
        }
        // -------------------------------------------------------
    }

    // --- Send stream end signal (common to both paths) --- 
    await channel.send({ type: 'broadcast', event: 'ai_response', payload: { type: 'model_response_end' } });
    console.log(`Finished streaming response for user ${userId}`);

    return new Response(JSON.stringify({ success: true, message: "AI response processed." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
    });

  } catch (error) {
      console.error(`Error processing OpenAI request for user ${userId}, traceId ${traceId}:`, error);
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
