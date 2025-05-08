// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Pin specific versions AND esm.sh build version (v135)
// import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "https://esm.sh/v135/@langchain/core@0.2.10/messages";
// import { ChatOpenAI } from "https://esm.sh/v135/@langchain/openai@0.2.1";
import * as pako from "https://esm.sh/pako@2.1.0"; // For potential decompression
// Use npm: specifier without version for reliability in Deno
import { JSON_parse } from "npm:uint8array-json-parser";
import Long from "npm:long"; // Use specific version matching api-upload-trace
// Import from shared-importer (adjust path if necessary)
import {
  formatPercent,
  type Frame,
  getDurationMsFromProfileGroup,
  type ImporterDependencies,
  importProfilesFromArrayBuffer,
  type Profile,
  type ProfileGroup,
} from "../../../packages/shared-importer/src/index.ts";
import {
  loadProfileData,
  type ProfileLoadResult,
} from "../_shared/profile-loader.ts"; // <-- Import shared loader
import {
  executeGetTopFunctions,
  getSnapshotToolSchema, // <-- Add import for snapshot schema
  getTopFunctionsToolSchema,
} from "./trace-tools.ts"; // <-- Import tool schema and executor
import OpenAI from "npm:openai@^4.0.0";
import {
  type ChatCompletionMessageParam,
  type ChatCompletionTool,
} from "npm:openai/resources/chat/completions"; // Import needed types

console.log(`Function process-ai-turn booting up!`);

// IMPORTANT: Set these environment variables in your Supabase project settings
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// --- Map history to OpenAI message format ---
function mapHistoryToOpenAIMessages(
  history: { sender: "user" | "model"; text: string }[],
) {
  console.log("[mapHistory] Input history:", history); // Log input
  const mapped = history.map((msg) => {
    let role: "user" | "assistant";
    let content = msg.text;
    if (msg.sender === "user") {
      role = "user";
    } else { // Model maps to assistant
      role = "assistant";
    }
    // Ensure content is never null/undefined here either
    if (content == null) {
      console.warn(
        "[mapHistory] Found null/undefined content in history message:",
        msg,
      );
      content = "";
    }
    return { role, content };
  });
  console.log("[mapHistory] Mapped messages:", mapped); // Log output
  return mapped;
}

// --- System Prompt ---
const SYSTEM_PROMPT =
  `You are an expert performance analysis assistant specializing in interpreting trace files in the Speedscope format. 
Analyze the provided trace data summary and answer user questions about performance bottlenecks, function timings, and call stacks. 

You have access to the following tools:
1. get_top_functions - Use this to request the top N functions by time (total or self time)
2. get_flamegraph_snapshot - Use this to generate a visual snapshot of the flamegraph in different views (time_ordered, left_heavy, sandwich_caller, sandwich_callee)

Use these tools to answer questions that require specific data not present in the summary. Be concise and focus on actionable insights.`;

const toolsForApi: ChatCompletionTool[] = [
  getTopFunctionsToolSchema,
  getSnapshotToolSchema,
];

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Check for required environment variables
  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing environment variables");
    return new Response(
      JSON.stringify({ error: "Internal configuration error." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }

  // Determine payload type early
  let payload;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("Failed to parse request body or missing fields:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Bad Request" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
  const requestType = payload.type; // e.g., 'start_analysis', 'user_prompt', 'continue_with_tool_result'

  // Common setup
  const supabaseAdmin = createClient(
    SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  let userId: string | undefined;
  let channel: any; // SupabaseRealtimeChannel type might not be easily importable

  try {
    if (requestType === "continue_with_tool_result") {
      // --- Handle Continuation ---
      console.log("[process-ai-turn] Handling continue_with_tool_result");
      const { continuationState, toolResult } = payload;
      userId = continuationState.userId; // Get userId for channel
      const originalHistory = continuationState.message_history;
      const originalToolCall = continuationState.tool_call;
      const traceId = continuationState.traceId; // Get traceId if needed for logging

      if (!userId) throw new Error("Missing userId in continuation state");
      channel = supabaseAdmin.channel(`private-chat-results-${userId}`);

      // 1. Reconstruct message history for next API call
      const messagesForAPI: ChatCompletionMessageParam[] = [
        ...originalHistory, // History *before* assistant tool request
        {
          role: "assistant",
          content: originalToolCall.content ?? "", // Use original assistant message content (should be "")
          tool_calls: [originalToolCall], // Re-add the tool call info
        },
      ];

      // Special handling for image data URL - convert to content array with image_url
      if (
        toolResult.status === "success" &&
        toolResult.content.startsWith("data:image/")
      ) {
        messagesForAPI.push({
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Here is the flamegraph snapshot you requested. Please analyze what you see in this image.",
            },
            {
              type: "image_url",
              image_url: {
                url: toolResult.content,
              },
            },
          ],
        });
      } else {
        // For error cases or non-image data
        messagesForAPI.push({
          role: "tool",
          tool_call_id: toolResult.toolCallId,
          content: toolResult.content, // Use error message
        });
      }

      // 2. Make the second API call (streaming final response)
      console.log(
        `[process-ai-turn] Sending final request to OpenAI after tool result... Messages: ${messagesForAPI.length}`,
      );
      const stream = await openai.chat.completions.create({
        model: "gpt-4o", // Use gpt-4o with vision capabilities
        messages: messagesForAPI,
        stream: true,
        max_tokens: 1000, // Limit response length
      });

      // 3. Stream response via Realtime
      let firstChunkSent = false;
      for await (const chunk of stream) {
        const contentChunk = chunk.choices[0]?.delta?.content || "";
        if (contentChunk) {
          const payloadType = firstChunkSent
            ? "model_chunk_append"
            : "model_chunk_start";
          await channel.send({
            type: "broadcast",
            event: "ai_response",
            payload: { type: payloadType, chunk: contentChunk },
          });
          firstChunkSent = true;
        }
      }
      // ---------------------------
    } else { // Handle initial analysis or user prompt
      // --- Standard Request Handling ---
      userId = payload.userId;
      const prompt = payload.prompt;
      const traceId = payload.traceId;
      const history = payload.history || [];
      const modelName = payload.modelName || "gpt-4o-mini";
      const modelProvider = payload.modelProvider || "openai";

      if (!userId || !prompt || !traceId) {
        throw new Error("Missing required fields: userId, prompt, traceId");
      }
      channel = supabaseAdmin.channel(`private-chat-results-${userId}`);

      // --- Load Profile Data ---
      const { data: traceRecord, error: dbError } = await supabaseAdmin.from(
        "traces",
      ).select("blob_path").eq("id", traceId).single();
      if (dbError || !traceRecord?.blob_path) { /* ... handle error ... */ }
      const blobPath = traceRecord.blob_path;
      const loadedData: ProfileLoadResult = await loadProfileData(
        supabaseAdmin,
        blobPath,
      );
      if (!loadedData?.profileGroup) {
        throw new Error(`Failed to load profile data for trace ${traceId}`);
      }
      const profileData = loadedData.profileGroup;
      const profileType = loadedData.profileType;
      const summary = JSON.stringify(
        {
          name: profileData.name ?? "N/A",
          profileType: profileType ?? "N/A", // Use profileType from result
          totalDurationMs: getDurationMsFromProfileGroup(profileData) ?? "N/A",
          frameCount: profileData.shared?.frames?.length ?? "N/A",
        },
        null,
        2,
      );
      // ---------------------------------

      // --- Initial Message Formatting ---
      const historyMessages = mapHistoryToOpenAIMessages(history);
      const initialMessages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\nTrace Summary:\n${summary}`,
        },
        ...historyMessages,
        { role: "user", content: prompt },
      ];

      console.log(
        `Sending initial request to OpenAI API for user ${userId}...`,
      );

      // --- First API Call (Check for tool use) ---
      const initialResponse = await openai.chat.completions.create({
        model: modelName || "gpt-4o-mini",
        messages: initialMessages,
        tools: toolsForApi, // <-- Pass tool schema
        tool_choice: "auto", // <-- Let model decide
        // stream: false, // Cannot stream when checking for tool calls first
      });

      const responseMessage = initialResponse.choices[0]?.message;

      // --- Check if Snapshot tool needs to be called ---
      const snapshotToolCall = responseMessage?.tool_calls?.find(
        (call) =>
          call.type === "function" &&
          call.function.name === getSnapshotToolSchema.function.name,
      );

      if (snapshotToolCall) {
        console.log(
          `[process-ai-turn] Snapshot tool call requested:`,
          snapshotToolCall,
        );

        // 1. Generate request ID (can use tool call ID or generate new)
        const requestId = snapshotToolCall.id; // Use tool_call_id as the request ID

        // 2. Store state needed for continuation in the database
        const stateToStore = {
          user_id: userId,
          trace_id: traceId,
          message_history: initialMessages, // History *before* assistant/tool messages
          tool_call: snapshotToolCall, // The specific tool call object
          tool_call_id: snapshotToolCall.id, // Add the tool_call_id for lookup
        };
        console.log(
          `[process-ai-turn] Storing continuation state for request ${requestId}...`,
        );
        const { error: insertError } = await supabaseAdmin
          .from("ai_chat_continuations")
          .insert(stateToStore);

        if (insertError) {
          console.error(
            "[process-ai-turn] Failed to store continuation state:",
            insertError,
          );
          throw new Error(
            `Failed to store continuation state: ${insertError.message}`,
          );
        }
        console.log(
          `[process-ai-turn] Continuation state stored successfully.`,
        );

        // 3. Send request to client via Realtime
        const snapshotArgs = JSON.parse(snapshotToolCall.function.arguments);
        await channel.send({
          type: "broadcast",
          event: "ai_response", // Reuse event type
          payload: {
            type: "request_snapshot",
            requestId: requestId,
            viewType: snapshotArgs.viewType,
            // frameKey: snapshotArgs.frameKey // Include if needed
          },
        });
        console.log(
          `[process-ai-turn] Snapshot request sent to client via Realtime.`,
        );

        // 4. End this execution - waiting for client response trigger
        return new Response(
          JSON.stringify({
            success: true,
            message: "Snapshot requested from client.",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200, // Indicate request accepted, processing deferred
          },
        );
      } else if (responseMessage?.tool_calls) {
        // --- Handle OTHER Tool Calls (like get_top_functions) ---
        console.log(
          `[process-ai-turn] Non-snapshot tool call requested:`,
          responseMessage.tool_calls,
        );
        const assistantMessageForHistory: ChatCompletionMessageParam = {
          ...responseMessage,
          content: responseMessage.content ?? "", // Use empty string if null
        };
        initialMessages.push(assistantMessageForHistory);
        for (const toolCall of responseMessage.tool_calls) {
          if (
            toolCall.function.name === getTopFunctionsToolSchema.function.name
          ) {
            // Send tool start event via Realtime
            await channel.send({
              type: "broadcast",
              event: "ai_response",
              payload: {
                type: "tool_start",
                toolName: toolCall.function.name,
                message: `Using tool: ${toolCall.function.name}...`,
              },
            });

            let toolResultContent: string;
            try {
              const toolArgs = JSON.parse(toolCall.function.arguments);
              toolResultContent = executeGetTopFunctions(profileData, toolArgs);
            } catch (e) {
              console.error(
                `[process-ai-turn] Error parsing tool args or executing tool:`,
                e,
              );
              toolResultContent =
                `Error: Failed to execute tool ${toolCall.function.name} - ${e.message}`;
            }

            // Send tool end event via Realtime (optional)
            // await channel.send({ type: 'broadcast', event: 'ai_response', payload: { type: 'tool_end', output: toolResultContent } });

            // *** Log tool result before adding ***
            console.log(
              `[process-ai-turn] Tool call ${toolCall.id} result content (type: ${typeof toolResultContent}):`,
              toolResultContent,
            );
            // *************************************

            // Append the tool result message for the next API call
            initialMessages.push({
              tool_call_id: toolCall.id,
              role: "tool",
              content: toolResultContent,
            });
          } else {
            console.warn(
              `[process-ai-turn] Model requested unknown tool: ${toolCall.function.name}`,
            );
            // Optionally append an error message back?
          }
        }
        // --- Second API Call (With Tool Results) & Stream ---
        console.log(
          "[process-ai-turn] Sending second request to OpenAI with tool results...",
        );
        // *** Log the exact messages being sent ***
        console.log(
          "[process-ai-turn] Messages for API call 2:",
          JSON.stringify(initialMessages, null, 2),
        );
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
            const payloadType = firstChunkSent
              ? "model_chunk_append"
              : "model_chunk_start";
            await channel.send({
              type: "broadcast",
              event: "ai_response",
              payload: { type: payloadType, chunk: contentChunk },
            });
            firstChunkSent = true;
          }
        }
        // ------------------------------------------
      } else {
        // --- No Tool Call: Stream Response from First Call ---
        console.log(
          `[process-ai-turn] No tool call requested. Streaming initial response.`,
        );
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
            const payloadType = firstChunkSent
              ? "model_chunk_append"
              : "model_chunk_start";
            await channel.send({
              type: "broadcast",
              event: "ai_response",
              payload: { type: payloadType, chunk: contentChunk },
            });
            firstChunkSent = true;
          }
        }
        // -------------------------------------------------------
      }

      // --- Send stream end signal / Return Success (only if not waiting for snapshot) ---
      if (!snapshotToolCall) { // Only send end/return if we didn't request a snapshot
        await channel.send({
          type: "broadcast",
          event: "ai_response",
          payload: { type: "model_response_end" },
        });
        console.log(`Finished streaming response for user ${userId}`);
        return new Response(
          JSON.stringify({ success: true, message: "AI response processed." }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }
    }

    // --- Common stream end signal ---
    if (channel) { // Ensure channel exists before sending end signal
      await channel.send({
        type: "broadcast",
        event: "ai_response",
        payload: { type: "model_response_end" },
      });
      console.log(`Finished processing request for user ${userId}`);
      return new Response(
        JSON.stringify({ success: true, message: "AI response processed." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }
  } catch (error) {
    console.error(
      `Error processing request for user ${
        userId || "unknown"
      }, type ${requestType}:`,
      error,
    );
    // Publish error to Realtime if possible
    if (channel) {
      try {
        await channel.send({
          type: "broadcast",
          event: "ai_response",
          payload: {
            type: "error",
            message: error instanceof Error
              ? error.message
              : "An internal error occurred during AI processing.",
          },
        });
      } catch (e) { /* ... */ }
    }
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
