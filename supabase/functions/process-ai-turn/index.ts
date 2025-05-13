import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

import { getDurationMsFromProfileGroup } from '../../../packages/speedscope-import/src/index.ts';
import { parseProfileBuffer, type ProfileLoadResult } from '../_shared/profile-loader.ts';
import { TopFunctionsTool, GenerateFlamegraphSnapshotTool } from './trace-tools.ts';

import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import type { BaseMessage } from '@langchain/core/messages';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';

console.log(`Function process-ai-turn (Langchain) booting up!`);

// IMPORTANT: Set these environment variables in your Supabase project settings
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const FLAMECHART_SERVER_URL = Deno.env.get('FLAMECHART_SERVER_URL');

const MODEL_NAME = 'gpt-4o';

const llm = new ChatOpenAI({
  apiKey: OPENAI_API_KEY,
  modelName: MODEL_NAME,
  temperature: 0,
  streaming: true,
});

function mapHistoryToLangchainMessages(
  history: { sender: 'user' | 'model'; text: string }[]
): BaseMessage[] {
  return history.map((msg) => {
    if (msg.sender === 'user') {
      return new HumanMessage(msg.text);
    } else {
      return new AIMessage(msg.text);
    }
  });
}

function formatPromptTemplate(strings: TemplateStringsArray, ...values: any[]) {
  const result = strings.reduce(
    (acc, str, i) => acc + str + (values[i] !== undefined ? values[i] : ''),
    ''
  );
  const lines = result.split('\n');
  const leadingWhitespace = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)?.[0]?.length ?? 0)
  );
  const trimmedResult = lines.map((line) => line.slice(leadingWhitespace)).join('\n');
  return trimmedResult.replace(/^\n+|\n+$/g, '');
}

const SYSTEM_PROMPT_TEMPLATE = formatPromptTemplate`
You are a performance analysis assistant.

- Your goal is to pinpoint areas of high resource consumption or latency.
- Describe your observations and reasoning for each step.
- Stop when you have identified a likely bottleneck or after a few investigation steps.

- You can use the 'generate_flamegraph_screenshot' tool to request zoomed-in views or different perspectives (e.g., different time ranges or depths) to investigate further.
- You can use the 'get_top_functions' tool to get a list of the top functions by self or total time.

If you think you have identified a bottleneck, you can stop the analysis and provide a concise summary of your findings, and why you think it's a bottleneck.

To start with you should immediately get a screenshot of the flamegraph.

Trace Summary:
{trace_summary}
`;

Deno.serve(async (req) => {
  console.log('[SERVER] Received request'); // Log request received
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Check for required environment variables
  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FLAMECHART_SERVER_URL) {
    console.error('Missing environment variables');
    return new Response(JSON.stringify({ error: 'Internal configuration error.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  // Determine payload type early
  let payload;
  try {
    payload = await req.json();
    console.log('[SERVER] Parsed payload:', JSON.stringify(payload, null, 2));
  } catch (error) {
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

  let userId: string | undefined;
  let channel: any; // SupabaseRealtimeChannel type might not be easily importable

  try {
    userId = payload.userId;
    const userPrompt = payload.prompt;
    const traceId = payload.traceId;
    const history = payload.history || [];
    console.log(
      `[SERVER] UserID: ${userId}, TraceID: ${traceId}, Prompt: "${userPrompt}", History items: ${history.length}`
    );

    if (!userId || !userPrompt || !traceId) {
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
    console.log(`[process-ai-turn] Original blobPath from DB: ${blobPath}`);

    // Correct the path: remove leading "traces/" if present, as the .from('traces') already specifies the bucket.
    let pathInBucket = blobPath;
    const bucketNamePrefix = 'traces/';
    if (blobPath.startsWith(bucketNamePrefix)) {
      pathInBucket = blobPath.substring(bucketNamePrefix.length);
      console.log(`[process-ai-turn] Corrected blobPath (path in bucket): ${pathInBucket}`);
    } else {
      console.log(
        `[process-ai-turn] blobPath does not start with '${bucketNamePrefix}', using as is: ${pathInBucket}`
      );
    }

    console.log(
      `[process-ai-turn] Attempting to download from bucket 'traces' with path: ${pathInBucket}`
    );
    const { data: blobData, error: blobError } = await supabaseAdmin.storage
      .from('traces') // Assuming 'traces' is the bucket name
      .download(pathInBucket); // Use the corrected path

    if (blobError || !blobData) {
      console.error(`[process-ai-turn] Failed to download blob ${pathInBucket}:`, blobError);
      await channel.send({
        type: 'broadcast',
        event: 'ai_response',
        payload: { type: 'error', message: 'Failed to load profile data from storage.' },
      });
      throw new Error(`Failed to download profile data blob: ${blobError?.message}`);
    }
    const profileArrayBuffer = await blobData.arrayBuffer(); // Get ArrayBuffer for parsing
    console.log(
      `[process-ai-turn] Profile ArrayBuffer obtained, length: ${profileArrayBuffer.byteLength}`
    );
    // ---------------------------------------------------------

    // --- Parse profile for summary & other tools (use the downloaded ArrayBuffer) ---
    console.log(`[process-ai-turn] Parsing profile from buffer...`);
    // Extract filename from pathInBucket for the parser
    const fileNameForParser = pathInBucket.split('/').pop() || 'tracefile';
    const loadedData: ProfileLoadResult = await parseProfileBuffer(
      profileArrayBuffer,
      fileNameForParser
    );

    if (!loadedData?.profileGroup) {
      throw new Error(`Failed to load profile data for trace ${traceId}`);
    }
    const profileData = loadedData.profileGroup;
    const traceSummary = JSON.stringify(
      {
        name: profileData.name ?? 'N/A',
        profileType: loadedData.profileType ?? 'N/A',
        totalDurationMs: getDurationMsFromProfileGroup(profileData) ?? 'N/A',
      },
      null,
      2
    );
    // ---------------------------------

    console.log('[SERVER] Profile data loaded and parsed successfully.');
    console.log('[SERVER] Trace Summary:', traceSummary);

    const tools = [
      new TopFunctionsTool(profileData),
      new GenerateFlamegraphSnapshotTool(
        supabaseAdmin as SupabaseClient,
        FLAMECHART_SERVER_URL!,
        profileArrayBuffer,
        userId!,
        traceId!
      ),
    ];
    console.log('[SERVER] Tools instantiated.');

    const promptTemplate = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT_TEMPLATE),
      new MessagesPlaceholder('chat_history'),
      HumanMessagePromptTemplate.fromTemplate('{input}'),
      new MessagesPlaceholder('agent_scratchpad'),
    ]);
    console.log('[SERVER] Prompt template created.');

    const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt: promptTemplate });
    const agentExecutor = new AgentExecutor({ agent, tools });
    console.log('[SERVER] Agent and executor created.');

    const langchainHistory = mapHistoryToLangchainMessages(history);
    console.log('[SERVER] Langchain history mapped:', JSON.stringify(langchainHistory, null, 2));

    console.log('[SERVER] Invoking agentExecutor.stream() with input:', userPrompt);
    const stream = await agentExecutor.stream({
      input: userPrompt,
      chat_history: langchainHistory,
      trace_summary: traceSummary,
    });

    let currentToolCallId: string | null = null;
    let currentToolName: string | null = null;
    let accumulatedLlmOutput = '';
    let firstChunkSent = false;
    let streamCounter = 0;

    console.log('[SERVER] Starting to iterate agent stream...');
    for await (const chunk of stream) {
      streamCounter++;
      console.log(
        `[SERVER] Stream chunk ${streamCounter} RECEIVED:`,
        JSON.stringify(chunk, null, 2)
      );

      // Handle tool start from logs (this seems to be for when the agent decides to call a tool)
      if (
        chunk.log?.length > 0 &&
        chunk.log.some((logItem: any) => logItem.lc_event_name === 'on_tool_start')
      ) {
        const toolStartLog = chunk.log.find(
          (logItem: any) => logItem.lc_event_name === 'on_tool_start'
        );
        if (toolStartLog && toolStartLog.name && toolStartLog.id) {
          currentToolCallId = Array.isArray(toolStartLog.id)
            ? toolStartLog.id.join('_')
            : String(toolStartLog.id);
          currentToolName = toolStartLog.name;
          const logMsg = `[SERVER] Identified Tool Start in chunk ${streamCounter}. Tool: ${currentToolName}, ID: ${currentToolCallId}`;
          console.log(logMsg);
          const payloadToSend = {
            type: 'tool_start',
            toolName: currentToolName,
            message: `Using tool: ${currentToolName}...`,
          };
          console.log(
            `[SERVER] SENDING to client (tool_start):`,
            JSON.stringify(payloadToSend, null, 2)
          );
          await channel.send({ type: 'broadcast', event: 'ai_response', payload: payloadToSend });
        }
      }

      // Handle messages array (for AIMessageChunks and ToolMessages)
      if (chunk.messages && chunk.messages.length > 0) {
        console.log(
          `[SERVER] Chunk ${streamCounter} has ${chunk.messages.length} messages. Processing...`
        );
        for (const message of chunk.messages) {
          console.log(
            `[SERVER] Processing message in chunk ${streamCounter}:`,
            JSON.stringify(message, null, 2)
          );
          if (
            message.constructor.name === 'AIMessageChunk' &&
            typeof message.content === 'string' &&
            message.content.length > 0 // Only stream non-empty content
          ) {
            accumulatedLlmOutput += message.content;
            const payloadType = firstChunkSent ? 'model_chunk_append' : 'model_chunk_start';
            const logMsg = `[SERVER] Identified AIMessageChunk in chunk ${streamCounter}. Content: "${message.content}". Type: ${payloadType}`;
            console.log(logMsg);
            const payloadToSend = { type: payloadType, chunk: message.content };
            console.log(
              `[SERVER] SENDING to client (${payloadType}):`,
              JSON.stringify(payloadToSend, null, 2)
            );
            await channel.send({ type: 'broadcast', event: 'ai_response', payload: payloadToSend });
            firstChunkSent = true;
          } else if (
            message.constructor.name === 'ToolMessage' &&
            currentToolCallId &&
            ((typeof message.tool_call_id === 'string' &&
              message.tool_call_id === currentToolCallId) ||
              (Array.isArray(message.tool_call_id) &&
                message.tool_call_id.join('_') === currentToolCallId))
          ) {
            const toolOutputContent =
              typeof message.content === 'string'
                ? message.content
                : JSON.stringify(message.content);
            console.log(
              `[SERVER] Identified ToolMessage in chunk ${streamCounter} for ${currentToolName}. Result: ${toolOutputContent}`
            );
            if (toolOutputContent.startsWith('Error:')) {
              console.warn(
                `[SERVER] Tool ${currentToolName} reported an error: ${toolOutputContent}`
              );
              const payloadToSend = {
                type: 'tool_error',
                toolName: currentToolName,
                message: toolOutputContent,
              };
              console.log(
                `[SERVER] SENDING to client (tool_error):`,
                JSON.stringify(payloadToSend, null, 2)
              );
              await channel.send({
                type: 'broadcast',
                event: 'ai_response',
                payload: payloadToSend,
              });
            }
            console.log(
              `[SERVER] Resetting firstChunkSent to false after tool ${currentToolName} processed.`
            );
            firstChunkSent = false;
            currentToolCallId = null;
            currentToolName = null;
          } else {
            if (message.constructor.name === 'AIMessageChunk' && message.content === '') {
              console.log(
                `[SERVER] Message in chunk ${streamCounter} was an EMPTY AIMessageChunk. Skipping.`
              );
            } else {
              console.log(
                `[SERVER] Message in chunk ${streamCounter} was not a streamable AIMessageChunk or relevant ToolMessage. Type: ${message.constructor.name}`
              );
            }
          }
        }
      }

      // Handle final agent output (if present directly in chunk.output)
      // This seems to be where the complete response comes after tool execution in your logs
      if (chunk.output && typeof chunk.output === 'string' && chunk.output.length > 0) {
        console.log(`[SERVER] Chunk ${streamCounter} has DIRECT OUTPUT string: "${chunk.output}"`);
        accumulatedLlmOutput += chunk.output; // Accumulate if needed, though this is likely a complete segment
        const payloadType = firstChunkSent ? 'model_chunk_append' : 'model_chunk_start';
        console.log(`[SERVER] Treating direct chunk.output as ${payloadType}.`);
        const payloadToSend = { type: payloadType, chunk: chunk.output };
        console.log(
          `[SERVER] SENDING to client (${payloadType} from chunk.output):`,
          JSON.stringify(payloadToSend, null, 2)
        );
        await channel.send({ type: 'broadcast', event: 'ai_response', payload: payloadToSend });
        firstChunkSent = true;
        // Since this is often a final output for a step, consider if a model_response_end should follow *if* no more AIMessageChunks are expected for this thought.
        // However, the main model_response_end after the loop is probably sufficient.
      }

      if (
        !(chunk.messages && chunk.messages.length > 0) &&
        !(chunk.output && typeof chunk.output === 'string' && chunk.output.length > 0)
      ) {
        console.log(
          `[SERVER] Chunk ${streamCounter} had no processable messages in .messages and no direct .output string.`
        );
      }
    }

    console.log('[SERVER] Agent stream iteration ended.');
    console.log('[SERVER] Final accumulated LLM output (for logging only):', accumulatedLlmOutput);

    const finalPayload = { type: 'model_response_end' };
    console.log(
      '[SERVER] Sending to client (model_response_end): ',
      JSON.stringify(finalPayload, null, 2)
    );
    await channel.send({
      type: 'broadcast',
      event: 'ai_response',
      payload: finalPayload,
    });

    console.log(`[SERVER] Finished processing Langchain request for user ${userId}`);
    return new Response(
      JSON.stringify({ success: true, message: 'AI response processed with Langchain.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessageString = error instanceof Error ? error.message : String(error);
    console.error(
      `[SERVER] CRITICAL ERROR in Deno.serve for user ${userId || 'unknown'}: ${errorMessageString}`,
      error // Log the full error object for stack trace
    );

    if (channel) {
      try {
        await channel.send({
          type: 'broadcast',
          event: 'ai_response',
          payload: {
            type: 'error',
            message: error instanceof Error ? error.message : 'An internal error occurred.',
          },
        });
      } catch (e) {
        const channelErrorMessage = e instanceof Error ? e.message : String(e);
        console.warn(`Failed to send error over Realtime channel: ${channelErrorMessage}`);
      }
    }
    const finalErrorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: finalErrorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
