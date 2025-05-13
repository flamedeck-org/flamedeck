// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

import { getDurationMsFromProfileGroup } from '../../../packages/speedscope-import/src/index.ts';
import { loadProfileData, type ProfileLoadResult } from '../_shared/profile-loader.ts'; // <-- Import shared loader
import {
  executeGetTopFunctions,
  getSnapshotToolSchema,
  getTopFunctionsToolSchema,
} from './trace-tools.ts';
import OpenAI from 'npm:openai@^4.0.0';
import {
  type ChatCompletionMessageParam,
  type ChatCompletionTool,
} from 'npm:openai/resources/chat/completions';

console.log(`Function process-ai-turn booting up!`);

// IMPORTANT: Set these environment variables in your Supabase project settings
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const FLAMECHART_SERVER_URL = Deno.env.get('FLAMECHART_SERVER_URL');

// --- Map history to OpenAI message format ---
function mapHistoryToOpenAIMessages(history: { sender: 'user' | 'model'; text: string }[]) {
  console.log('[mapHistory] Input history:', history); // Log input
  const mapped = history.map((msg) => {
    let role: 'user' | 'assistant';
    let content = msg.text;
    if (msg.sender === 'user') {
      role = 'user';
    } else {
      // Model maps to assistant
      role = 'assistant';
    }
    // Ensure content is never null/undefined here either
    if (content == null) {
      console.warn('[mapHistory] Found null/undefined content in history message:', msg);
      content = '';
    }
    return { role, content };
  });
  console.log('[mapHistory] Mapped messages:', mapped); // Log output
  return mapped;
}

// --- System Prompt ---
const SYSTEM_PROMPT = `You are an expert performance analysis assistant specializing in interpreting trace files in the Speedscope format. 
Analyze the provided trace data summary and answer user questions about performance bottlenecks, function timings, and call stacks. 

You have access to the following tools:
1. get_top_functions - Use this to request the top N functions by time (total or self time)
2. get_flamegraph_snapshot - Use this to generate a visual snapshot of the flamegraph in different views (time_ordered, left_heavy, sandwich_caller, sandwich_callee)

Use these tools to answer questions that require specific data not present in the summary. Be concise and focus on actionable insights.`;

const toolsForApi: ChatCompletionTool[] = [getTopFunctionsToolSchema, getSnapshotToolSchema];

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Check for required environment variables
  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FLAMECHART_SERVER_URL) {
    console.error(
      'Missing environment variables (OpenAI Key, Supabase URL/Key, Flamechart Server URL)'
    );
    return new Response(JSON.stringify({ error: 'Internal configuration error.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  // Determine payload type early
  let payload;
  try {
    payload = await req.json();
  } catch (error) {
    console.error('Failed to parse request body or missing fields:', error);
    // Check if error is an instance of Error before accessing .message
    const errorMessage = error instanceof Error ? error.message : 'Bad Request';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Common setup
  const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  let userId: string | undefined;
  let channel: any; // SupabaseRealtimeChannel type might not be easily importable

  try {
    userId = payload.userId;
    const prompt = payload.prompt;
    const traceId = payload.traceId;
    const history = payload.history || [];
    const modelName = payload.modelName || 'gpt-4o-mini';

    if (!userId || !prompt || !traceId) {
      throw new Error('Missing required fields: userId, prompt, traceId');
    }
    channel = supabaseAdmin.channel(`private-chat-results-${userId}`);

    // --- Load Profile Data ---
    const { data: traceRecord, error: dbError } = await supabaseAdmin
      .from('traces')
      .select('blob_path')
      .eq('id', traceId)
      .single();

    if (dbError || !traceRecord?.blob_path) {
      console.error(`Failed to get trace record for ID ${traceId}:`, dbError);
      await channel.send({
        type: 'broadcast',
        event: 'ai_response',
        payload: { type: 'error', message: `Could not find trace data for ID ${traceId}.` },
      });
      throw new Error(`Trace record not found for ID ${traceId}`);
    }
    const blobPath = traceRecord.blob_path;

    // --- Download raw profile text for potential snapshot use ---
    console.log(`[process-ai-turn] Downloading profile blob: ${blobPath}`);
    const { data: blobData, error: blobError } = await supabaseAdmin.storage
      .from('traces') // Assuming 'traces' is the bucket name
      .download(blobPath);

    if (blobError || !blobData) {
      console.error(`[process-ai-turn] Failed to download blob ${blobPath}:`, blobError);
      await channel.send({
        type: 'broadcast',
        event: 'ai_response',
        payload: { type: 'error', message: 'Failed to load profile data from storage.' },
      });
      throw new Error(`Failed to download profile data blob: ${blobError?.message}`);
    }
    const profileText = await blobData.text(); // Get raw text
    console.log(`[process-ai-turn] Profile text downloaded, length: ${profileText.length}`);
    // ---------------------------------------------------------

    // --- Parse profile for summary & other tools (use the downloaded text) ---
    console.log(`[process-ai-turn] Parsing profile for summary...`);
    const loadedData: ProfileLoadResult = await loadProfileData(supabaseAdmin, blobPath);
    if (!loadedData?.profileGroup) {
      throw new Error(`Failed to load profile data for trace ${traceId}`);
    }
    const profileData = loadedData.profileGroup;
    const profileType = loadedData.profileType;
    const summary = JSON.stringify(
      {
        name: profileData.name ?? 'N/A',
        profileType: profileType ?? 'N/A',
        totalDurationMs: getDurationMsFromProfileGroup(profileData) ?? 'N/A',
      },
      null,
      2
    );
    // ---------------------------------

    // --- Initial Message Formatting ---
    const historyMessages = mapHistoryToOpenAIMessages(history);
    const initialMessages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\nTrace Summary:\n${summary}`,
      },
      ...historyMessages,
      { role: 'user', content: prompt },
    ];

    console.log(`Sending initial request to OpenAI API for user ${userId}...`);

    // --- First API Call (Check for tool use) ---
    const initialResponse = await openai.chat.completions.create({
      model: modelName || 'gpt-4o-mini',
      messages: initialMessages,
      tools: toolsForApi, // <-- Pass tool schema
      tool_choice: 'auto', // <-- Let model decide
    });

    const responseMessage = initialResponse.choices[0]?.message;

    // --- Check if ANY Tool needs to be called ---
    if (responseMessage?.tool_calls) {
      console.log(`[process-ai-turn] Tool call(s) requested:`, responseMessage.tool_calls);
      const assistantMessageForHistory: ChatCompletionMessageParam = {
        ...responseMessage,
        content: responseMessage.content ?? '', // Use empty string if null
      };
      initialMessages.push(assistantMessageForHistory); // Add assistant's turn to history

      // Process each tool call requested by the model
      let wasSnapshotCalled = false; // Flag to track if snapshot tool was called
      for (const toolCall of responseMessage.tool_calls) {
        // Send tool start event via Realtime
        await channel.send({
          type: 'broadcast',
          event: 'ai_response',
          payload: {
            type: 'tool_start',
            toolName: toolCall.function.name,
            message: `Using tool: ${toolCall.function.name}...`,
          },
        });

        let toolResultContent: string;
        try {
          const toolArgs = JSON.parse(toolCall.function.arguments);

          if (toolCall.function.name === getSnapshotToolSchema.function.name) {
            // --- Execute Snapshot Tool ---
            wasSnapshotCalled = true; // Set the flag
            console.log('[process-ai-turn] Executing snapshot tool...', toolArgs);

            // 1. Construct Flamechart Server Request
            const queryParams = new URLSearchParams();
            queryParams.set('viewType', toolArgs.viewType || 'time_ordered'); // Required, use default
            if (toolArgs.width) queryParams.set('width', toolArgs.width.toString());
            if (toolArgs.height) queryParams.set('height', toolArgs.height.toString());
            if (toolArgs.mode) queryParams.set('mode', toolArgs.mode);
            if (toolArgs.flamegraphThemeName)
              queryParams.set('flamegraphThemeName', toolArgs.flamegraphThemeName);
            if (toolArgs.startTimeMs)
              queryParams.set('startTimeMs', toolArgs.startTimeMs.toString());
            if (toolArgs.endTimeMs) queryParams.set('endTimeMs', toolArgs.endTimeMs.toString());
            if (toolArgs.startDepth) queryParams.set('startDepth', toolArgs.startDepth.toString());

            const renderUrl = `${FLAMECHART_SERVER_URL}/render?${queryParams.toString()}`;
            console.log(`[process-ai-turn] Calling flamechart server: ${renderUrl}`);

            // 2. Call Flamechart Server
            const renderResponse = await fetch(renderUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: profileText, // Send the raw profile text downloaded earlier
            });

            if (!renderResponse.ok) {
              const errorText = await renderResponse.text();
              console.error(
                `[process-ai-turn] Flamechart server error (${renderResponse.status}): ${errorText}`
              );
              throw new Error(
                `Failed to render flamechart (status ${renderResponse.status}): ${errorText}`
              );
            }

            // 3. Get PNG buffer
            const pngBuffer = await renderResponse.arrayBuffer();
            console.log(`[process-ai-turn] PNG buffer received, length: ${pngBuffer.byteLength}`);

            // 4. Upload to Supabase Storage
            const timestamp = Date.now();
            // New path includes userId
            const storagePath = `ai-snapshots/${userId}/trace-${traceId}-${timestamp}.png`;
            console.log(`[process-ai-turn] Uploading PNG to storage: ${storagePath}`);
            const { error: uploadError } = await supabaseAdmin.storage
              .from('ai-snapshots') // Use the requested bucket name
              .upload(storagePath, pngBuffer, { contentType: 'image/png' });

            if (uploadError) {
              console.error('[process-ai-turn] Failed to upload snapshot to storage:', uploadError);
              throw new Error(`Storage upload failed: ${uploadError.message}`);
            }

            // 5. Get Public URL
            const { data: publicUrlData } = supabaseAdmin.storage
              .from('ai-snapshots') // Use the requested bucket name
              .getPublicUrl(storagePath);

            if (!publicUrlData?.publicUrl) {
              console.error('[process-ai-turn] Failed to get public URL for snapshot.');
              throw new Error('Could not get public URL for generated snapshot.');
            }
            toolResultContent = `Snapshot generated successfully: ${publicUrlData.publicUrl}`; // Result is the URL
            console.log(`[process-ai-turn] Snapshot uploaded. Public URL: ${toolResultContent}`);

            // --- End Snapshot Tool Execution ---
          } else if (toolCall.function.name === getTopFunctionsToolSchema.function.name) {
            // --- Execute Top Functions Tool (Existing Logic) ---
            toolResultContent = executeGetTopFunctions(profileData, toolArgs);
            // --- End Top Functions Tool ---
          } else {
            // Handle unknown tool
            console.warn(
              `[process-ai-turn] Model requested unknown tool: ${toolCall.function.name}`
            );
            toolResultContent = `Error: Unknown tool requested: ${toolCall.function.name}`;
          }
        } catch (e) {
          console.error(
            `[process-ai-turn] Error parsing tool args or executing tool ${toolCall.function.name}:`,
            e
          );
          // Check if e is an instance of Error before accessing .message
          const toolErrorMessage = e instanceof Error ? e.message : String(e);
          toolResultContent = `Error: Failed to execute tool ${toolCall.function.name} - ${toolErrorMessage}`;
        }

        // Append the tool result message for the next API call
        initialMessages.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          // If it was a snapshot, the content is the URL string
          // If it was top functions, content is the formatted string
          // If it was an error, content is the error message
          content: toolResultContent,
        });
      } // End loop over tool calls

      // --- Second API Call (With Tool Results) & Stream ---
      console.log(
        '[process-ai-turn] Sending second request to OpenAI with tool results...',
        JSON.stringify(initialMessages, null, 2)
      );
      const secondStream = await openai.chat.completions.create({
        // Use vision model if snapshot was called, otherwise use requested model
        model: wasSnapshotCalled ? 'gpt-4o' : modelName || 'gpt-4o-mini',
        messages: initialMessages, // Send history + assistant msg + tool results
        stream: true, // Stream the final response
      });

      // Stream the response from the SECOND call
      let firstChunkSent = false;
      for await (const chunk of secondStream) {
        const contentChunk = chunk.choices[0]?.delta?.content || '';
        if (contentChunk) {
          const payloadType = firstChunkSent ? 'model_chunk_append' : 'model_chunk_start';
          await channel.send({
            type: 'broadcast',
            event: 'ai_response',
            payload: { type: payloadType, chunk: contentChunk },
          });
          firstChunkSent = true;
        }
      }
      // ------------------------------------------
    } else {
      // --- No Tool Call: Stream Response from First Call ---
      console.log(`[process-ai-turn] No tool call requested. Streaming initial response.`);
      // Re-request with streaming if no tool call.
      const stream = await openai.chat.completions.create({
        model: modelName || 'gpt-4o-mini',
        messages: initialMessages,
        stream: true,
      });
      let firstChunkSent = false;
      for await (const chunk of stream) {
        const contentChunk = chunk.choices[0]?.delta?.content || '';
        if (contentChunk) {
          const payloadType = firstChunkSent ? 'model_chunk_append' : 'model_chunk_start';
          await channel.send({
            type: 'broadcast',
            event: 'ai_response',
            payload: { type: payloadType, chunk: contentChunk },
          });
          firstChunkSent = true;
        }
      }
      // -------------------------------------------------------
    }

    // --- Send stream end signal / Return Success (Now always happens here) ---
    await channel.send({
      type: 'broadcast',
      event: 'ai_response',
      payload: { type: 'model_response_end' },
    });
    console.log(`Finished processing request for user ${userId}`);
    return new Response(JSON.stringify({ success: true, message: 'AI response processed.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error(`Error processing request for user ${userId || 'unknown'}:`, error);
    // Publish error to Realtime if possible
    if (channel) {
      try {
        await channel.send({
          type: 'broadcast',
          event: 'ai_response',
          payload: {
            type: 'error',
            // Check if error is an instance of Error before accessing .message
            message:
              error instanceof Error
                ? error.message
                : 'An internal error occurred during AI processing.',
          },
        });
      } catch (e) {
        console.warn('Failed to send error over Realtime channel:', e);
      }
    }
    // Check if error is an instance of Error before accessing .message
    const finalErrorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: finalErrorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
