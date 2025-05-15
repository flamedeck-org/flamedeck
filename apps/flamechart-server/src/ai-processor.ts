// Remove Deno-specific runtime import
// import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from '@supabase/supabase-js'; // Changed to npm import
import { type Database } from '@/integrations/supabase/types'; // Import generated DB types

import { getDurationMsFromProfileGroup } from '@flamedeck/speedscope-import'; // Assuming this workspace import resolves

import { parseProfileBuffer, type ProfileLoadResult } from './profile-loader'; // Using the new Node.js version
import {
  TopFunctionsTool,
  GenerateFlamegraphSnapshotTool,
  GenerateSandwichSnapshotTool,
  type FlamegraphSnapshotToolResponse,
} from './trace-tools'; // Using the new Node.js version

// Langchain imports: Now using bare specifiers, relying on deno.json (should work in Node if installed)
import { ChatOpenAI } from '@langchain/openai';
import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  ToolMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { type CallbackHandlerMethods } from '@langchain/core/callbacks/base';

// LangGraph imports - using bare specifiers
import { StateGraph, END, Annotation } from '@langchain/langgraph';

import * as fs from 'fs/promises'; // For file system operations
import * as path from 'path'; // For path manipulation

console.log('[Node AI Processor] Module initialized.'); // Changed log message

// Environment Variables - use process.env for Node.js
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// We need a reasoning model for this complex task
const MODEL_NAME = process.env.AI_ANALYSIS_MODEL || 'o4-mini';

const llm = new ChatOpenAI({
  apiKey: OPENAI_API_KEY,
  modelName: MODEL_NAME,
  streaming: true,
});

function formatPromptTemplateStrings(strings: TemplateStringsArray, ...values: any[]) {
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

const SYSTEM_PROMPT_TEMPLATE_STRING = formatPromptTemplateStrings`
You are a performance analysis assistant.

- Your goal is to pinpoint areas of high resource consumption or latency.
- You should try to act with as little user involvement as possible, investigating likely bottlenecks and providing a summary.
- If you cannot find any bottlenecks, you should say so - do not make up performance issues.

- You can use the 'generate_flamegraph_screenshot' tool to get images of the flamegraph - you can zoom in to specific areas of the flamegraph using the startDepth, startTimeMs and endTimeMs parameters to debug specific callstacks.
- You can use the 'generate_sandwich_flamegraph_screenshot' tool to get a caller/callee sandwich view for a specific function by providing its name via the 'frameName' parameter.
- You can use the 'get_top_functions' tool to get a list of the top functions by self or total time.

If you think you have identified a bottleneck, provide a concise summary.

Start by generating a flamegraph screenshot of the entire trace.

Trace Summary:
{trace_summary}
`;

// --- LangGraph State Definition ---
interface AgentState {
  messages: BaseMessage[];
  supabaseAdmin: SupabaseClient;
  realtimeChannel: any; // SupabaseRealtimeChannel
  userId: string;
  traceId: string;
  profileArrayBuffer: ArrayBuffer | null;
  profileData: any | null; // ProfileGroup type from speedscope-core
  traceSummary: string;

  // For managing LangChain streaming callbacks
  llmStreamingActiveForCurrentSegment: boolean;
  currentToolName: string | null; // For callbacks

  // Iteration control for the graph
  iterationCount: number;
  maxIterations: number;

  sessionId: string; // Added sessionId
}

// --- LangGraph Nodes ---

async function initialSetupNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Node AI Processor - SetupNode] Starting initial setup...');
  const { supabaseAdmin, traceId, realtimeChannel } = state;

  try {
    // 1. Get the trace record from the database
    const { data: traceRecord, error: dbError } = await supabaseAdmin
      .from('traces')
      .select('blob_path')
      .eq('id', traceId)
      .single();

    if (dbError || !traceRecord?.blob_path) {
      const msg = `Trace record not found for ID ${traceId}`;
      console.error(`[Node AI Processor - SetupNode] ${msg}:`, dbError);
      await realtimeChannel.send({
        type: 'broadcast',
        event: 'ai_response',
        payload: { type: 'error', message: msg },
      });
      throw new Error(msg);
    }
    const blobPath = traceRecord.blob_path;
    let pathInBucket = blobPath.startsWith('traces/')
      ? blobPath.substring('traces/'.length)
      : blobPath;

    // 2. Download the profile data blob from the storage bucket
    const { data: blobData, error: blobError } = await supabaseAdmin.storage
      .from('traces')
      .download(pathInBucket);

    if (blobError || !blobData) {
      const msg = `Failed to download profile data blob ${pathInBucket}`;
      console.error(`[Node AI Processor - SetupNode] ${msg}:`, blobError);
      await realtimeChannel.send({
        type: 'broadcast',
        event: 'ai_response',
        payload: { type: 'error', message: 'Failed to load profile data from storage.' },
      });
      throw new Error(msg);
    }
    const profileArrayBuffer = await blobData.arrayBuffer();
    const fileNameForParser = pathInBucket.split('/').pop() || 'tracefile';

    // 3. Parse the profile data
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

    console.log('[Node AI Processor - SetupNode] Profile loaded and parsed. Summary generated.');

    const systemPromptContent = SYSTEM_PROMPT_TEMPLATE_STRING.replace(
      '{trace_summary}',
      traceSummary
    );
    let updatedMessages = [...state.messages];

    if (updatedMessages.length === 0 || updatedMessages[0]._getType() !== 'system') {
      updatedMessages.unshift(new SystemMessage(systemPromptContent));
    }

    return { profileArrayBuffer, profileData, traceSummary, messages: updatedMessages };
  } catch (error) {
    console.error('[Node AI Processor - SetupNode] Critical error during setup:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'ai_response',
      payload: { type: 'error', message: `Setup failed: ${errorMsg}` },
    });
    throw error;
  }
}

const LOGS_DIR = '/Users/zacharymarion/src/flamedeck/apps/flamechart-server/logs'; // Define a logs directory

async function agentNode(state: AgentState, config?: RunnableConfig): Promise<Partial<AgentState>> {
  console.log(
    `[Node AI Processor - AgentNode] Iteration ${state.iterationCount}. Calling LLM. Current messages count: ${state.messages.length}`
  );
  let callbackState = {
    llmStreamingActiveForCurrentSegment: state.llmStreamingActiveForCurrentSegment,
    currentToolName: state.currentToolName,
  };

  if (!state.realtimeChannel) {
    console.error(
      '[Node AI Processor - AgentNode] CRITICAL: state.realtimeChannel is null. Aborting agent node.'
    );
    return { messages: state.messages, iterationCount: state.iterationCount + 1 };
  }

  const langChainCallbacks: CallbackHandlerMethods[] = [
    {
      handleLLMNewToken: async (token: string) => {
        if (!state.realtimeChannel) return;
        if (token === '' || token === null) return;
        const payloadType = callbackState.llmStreamingActiveForCurrentSegment
          ? 'model_chunk_append'
          : 'model_chunk_start';
        await state.realtimeChannel.send({
          type: 'broadcast',
          event: 'ai_response',
          payload: { type: payloadType, chunk: token },
        });
        callbackState.llmStreamingActiveForCurrentSegment = true;
      },
      handleLLMEnd: async () => {
        if (!state.realtimeChannel) return;
        console.log('[Node AI Processor - Callback] LLM End.');
      },
      handleLLMError: async (err: any) => {
        if (!state.realtimeChannel) return;
        console.error('[Node AI Processor - Callback] LLM Error:', err);
        await state.realtimeChannel
          .send({
            type: 'broadcast',
            event: 'ai_response',
            payload: {
              type: 'error',
              message: `LLM processing error: ${err.message || String(err)}`,
            },
          })
          .catch((rtErr: any) =>
            console.error(
              '[Node AI Processor - Callback] Failed to send error over Realtime:',
              rtErr
            )
          );
      },
      handleToolStart: async (
        tool: any,
        input: string,
        runId: string,
        parentRunId?: string,
        tags?: string[],
        metadata?: Record<string, unknown>,
        name?: string
      ) => {
        if (!state.realtimeChannel) return;
        const identifiedToolName =
          name || tool?.name || tool?.id?.[tool?.id?.length - 1] || 'unknown_tool_starting';
        callbackState.currentToolName = identifiedToolName;
        callbackState.llmStreamingActiveForCurrentSegment = false;
        console.log(
          `[Node AI Processor - Callback] Tool Start: ${callbackState.currentToolName}, Input: ${input.substring(0, 100)}...`
        );
        // tool_start event is now primarily sent from toolHandlerNode for better context
      },
      handleToolEnd: async (
        output: any,
        runId: string,
        parentRunId?: string,
        tags?: string[] | undefined,
        name?: string
      ) => {
        if (!state.realtimeChannel) return;
        const toolNameForEvent = name || callbackState.currentToolName || 'unknown_tool_ended';
        callbackState.llmStreamingActiveForCurrentSegment = false;
        console.log(`[Node AI Processor - Callback] Tool End from LLM: ${toolNameForEvent}.`);

        // tool_result and tool_error events are now primarily sent from toolHandlerNode
        if (callbackState.currentToolName === toolNameForEvent)
          callbackState.currentToolName = null;
      },
      handleToolError: async (err: any, runId: string, parentRunId?: string, tags?: string[]) => {
        if (!state.realtimeChannel) return;
        const toolNameForEvent = callbackState.currentToolName || 'unknown_tool_error';
        callbackState.llmStreamingActiveForCurrentSegment = false;
        console.error(
          `[Node AI Processor - Callback] Tool Error from LLM for ${toolNameForEvent}:`,
          err
        );
        // tool_error event is now primarily sent from toolHandlerNode
        if (callbackState.currentToolName === toolNameForEvent)
          callbackState.currentToolName = null;
      },
    },
  ];

  let messagesForLLMInvocation = [...state.messages].map((msg) => {
    if (
      msg instanceof ToolMessage &&
      (msg.name === 'generate_flamegraph_screenshot' ||
        msg.name === 'generate_sandwich_flamegraph_screenshot')
    ) {
      // Updated condition
      const toolOutput = msg.content as unknown as FlamegraphSnapshotToolResponse;

      const content =
        toolOutput.status === 'success' || toolOutput.status === 'success_with_warning'
          ? `Successfully generated ${msg.name === 'generate_sandwich_flamegraph_screenshot' ? 'sandwich ' : ''}flamegraph screenshot: ${toolOutput.publicUrl}` // Dynamic message
          : `Failed to generate ${msg.name === 'generate_sandwich_flamegraph_screenshot' ? 'sandwich ' : ''}flamegraph screenshot: ${toolOutput.message}`;

      // Strip the base64Image from the content since it is huge and we only want the AI to
      // interpret it if its the last image
      return new ToolMessage({ tool_call_id: msg.tool_call_id, content });
    }
    return msg;
  });

  const lastMessageFromState = state.messages[state.messages.length - 1];

  // Check if the last message is a successful screenshot tool call to add image for LLM
  if (
    lastMessageFromState instanceof ToolMessage &&
    (lastMessageFromState.name === 'generate_flamegraph_screenshot' ||
      lastMessageFromState.name === 'generate_sandwich_flamegraph_screenshot') && // Updated condition
    lastMessageFromState.tool_call_id // Ensure there is a tool_call_id
  ) {
    try {
      const toolOutput = lastMessageFromState.content as unknown as FlamegraphSnapshotToolResponse;
      if (
        (toolOutput.status === 'success' || toolOutput.status === 'success_with_warning') &&
        toolOutput.base64Image
      ) {
        console.log(
          '[Node AI Processor - AgentNode] Preparing temporary HumanMessage with image and analysis instruction for LLM.'
        );
        const imageMessageForLLM = new HumanMessage({
          content: [
            {
              type: 'text',
              // Explicit instruction for the AI
              text: `The ${lastMessageFromState.name === 'generate_sandwich_flamegraph_screenshot' ? 'sandwich ' : ''}flamegraph screenshot you requested (tool call ID: ${lastMessageFromState.tool_call_id}) is provided. Please analyze this image and describe your key observations or findings from it before deciding on the next step.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${toolOutput.base64Image}` },
            },
          ],
        });
        messagesForLLMInvocation.push(imageMessageForLLM); // Add to TEMPORARY list for this LLM call only
      } else {
        console.log(
          '[Node AI Processor - AgentNode] Screenshot tool_result was not success or base64Image missing; not adding image to LLM input.'
        );
      }
    } catch (e) {
      console.error(
        '[Node AI Processor - AgentNode] Error parsing screenshot tool_result for image handling in agentNode:',
        e
      );
    }
  }

  // Ensure System Prompt is correctly placed or updated if needed
  if (
    messagesForLLMInvocation.length > 0 &&
    messagesForLLMInvocation[0]._getType() === 'system' &&
    (messagesForLLMInvocation[0] as SystemMessage).content !==
      SYSTEM_PROMPT_TEMPLATE_STRING.replace('{trace_summary}', state.traceSummary)
  ) {
    (messagesForLLMInvocation[0] as SystemMessage).content = SYSTEM_PROMPT_TEMPLATE_STRING.replace(
      '{trace_summary}',
      state.traceSummary
    );
  }

  // --- Save messages to file before LLM call ---
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true }); // Ensure log directory exists
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `llm_input_session_${state.sessionId}_trace_${state.traceId}_iter_${state.iterationCount}_${timestamp}.json`;
    const filePath = path.join(LOGS_DIR, filename);
    // Serialize messages: Handle potential circular structures or complex objects if any
    // A simple JSON.stringify might work for Langchain messages, but be cautious.
    const serializableMessages = messagesForLLMInvocation.map((msg) => msg.toJSON());
    await fs.writeFile(filePath, JSON.stringify(serializableMessages, null, 2));
    console.log(`[Node AI Processor - AgentNode] Saved LLM input to ${filePath}`);
  } catch (fileError) {
    console.error('[Node AI Processor - AgentNode] Error saving LLM input to file:', fileError);
    // Do not crash the main process, just log the error
  }
  // --- End save messages to file ---

  const currentTools = [
    new TopFunctionsTool(state.profileData),
    new GenerateFlamegraphSnapshotTool(
      state.supabaseAdmin,
      state.profileArrayBuffer!,
      state.userId,
      state.traceId
    ),
    new GenerateSandwichSnapshotTool(
      state.supabaseAdmin,
      state.profileArrayBuffer!,
      state.userId,
      state.traceId
    ),
  ];
  const modelWithTools = llm.bindTools(currentTools);

  let llmResponse: AIMessage;
  try {
    llmResponse = (await modelWithTools.invoke(messagesForLLMInvocation, {
      callbacks: langChainCallbacks,
    })) as AIMessage;
  } catch (invokeError: any) {
    console.error('[Node AI Processor - AgentNode] modelWithTools.invoke failed:', invokeError);
    const errorToSave = {
      user_id: state.userId,
      trace_id: state.traceId,
      session_id: state.sessionId,
      sender: 'system_event' as const,
      content_text: `LLM invocation failed: ${invokeError.message || String(invokeError)}`,
    };
    await state.supabaseAdmin
      .from('chat_messages')
      .insert(errorToSave)
      .then(({ error: dbErr }) => {
        if (dbErr)
          console.error(
            '[Node AI Processor - AgentNode] DB error saving LLM invoke fail event:',
            dbErr
          );
      });
    if (state.realtimeChannel) {
      await state.realtimeChannel
        .send({
          type: 'broadcast',
          event: 'ai_response',
          payload: {
            type: 'error',
            message: `LLM invocation failed: ${invokeError.message || String(invokeError)}`,
          },
        })
        .catch((rtErr: any) =>
          console.error(
            '[Node AI Processor - AgentNode] Failed to send invokeError over Realtime:',
            rtErr
          )
        );
    }
    return { messages: state.messages, iterationCount: state.iterationCount + 1 };
  }

  // Save the AIMessage (which might contain text or tool_calls) to the database
  if (llmResponse) {
    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      // This is an AIMessage requesting tool calls.
      // Save it as one 'model' message with the tool_calls details in tool_calls_json.
      const aiMessageToSave = {
        user_id: state.userId,
        trace_id: state.traceId,
        session_id: state.sessionId,
        sender: 'model' as const,
        content_text: llmResponse.content || '', // Ensure content is not undefined/null
        tool_calls_json: llmResponse.tool_calls as any, // Store the array of tool calls
      };
      const { error: modelMsgError } = await state.supabaseAdmin
        .from('chat_messages')
        .insert(aiMessageToSave);
      if (modelMsgError)
        console.error(
          '[Node AI Processor - AgentNode] DB error saving AI model message with tool_calls:',
          modelMsgError
        );
    } else {
      // This is a standard AIMessage with textual content
      const aiTextMessage = {
        user_id: state.userId,
        trace_id: state.traceId,
        session_id: state.sessionId,
        sender: 'model' as const,
        content_text: llmResponse.content as string,
        // tool_calls_json will be null or undefined here by default
      };
      const { error: textMsgError } = await state.supabaseAdmin
        .from('chat_messages')
        .insert(aiTextMessage);
      if (textMsgError)
        console.error(
          '[Node AI Processor - AgentNode] DB error saving AI text message:',
          textMsgError
        );
    }
  }

  // The llmResponse (AIMessage) is added to the persistent graph state.
  // The temporary imageMessageForLLM is NOT added here.
  const newPersistentMessages = [...state.messages, llmResponse];

  return {
    messages: newPersistentMessages,
    llmStreamingActiveForCurrentSegment: callbackState.llmStreamingActiveForCurrentSegment,
    currentToolName: callbackState.currentToolName,
    iterationCount: state.iterationCount + 1,
  };
}

interface ToolCall {
  name: string;
  args: Record<string, any>;
  id?: string;
  type?: 'tool_call';
}

async function toolHandlerNode(
  state: AgentState,
  config?: RunnableConfig
): Promise<Partial<AgentState>> {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    return { messages: state.messages };
  }

  const toolInvocations = lastMessage.tool_calls as ToolCall[];
  let newMessages = [...state.messages]; // Start with current messages
  const toolResultsForAIMessage: ToolMessage[] = []; // Collect ToolMessages for the AIMessage response

  const tools = [
    new TopFunctionsTool(state.profileData!),
    new GenerateFlamegraphSnapshotTool(
      state.supabaseAdmin,
      state.profileArrayBuffer!,
      state.userId,
      state.traceId
    ),
    new GenerateSandwichSnapshotTool(
      state.supabaseAdmin,
      state.profileArrayBuffer!,
      state.userId,
      state.traceId
    ),
  ];

  for (const call of toolInvocations) {
    const toolInstance = tools.find((t) => t.name === call.name);
    const toolCallIdFromAI = call.id;

    if (!toolCallIdFromAI) {
      const errMsg = `Tool call from AI (name: ${call.name}) is missing an ID.`;
      console.error(`[Node AI Processor - ToolHandlerNode] ${errMsg}`, call);
      const generatedId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `missing-id-${Math.random().toString(36).substring(2, 15)}`;
      toolResultsForAIMessage.push(
        // Add to specific list for AIMessage
        new ToolMessage({
          content: `Error: ${errMsg}`,
          tool_call_id: generatedId,
          name: call.name,
        })
      );
      // Save this specific error to DB as a 'tool_error' for this pseudo-tool call
      const dbErrorMsg = {
        user_id: state.userId,
        trace_id: state.traceId,
        session_id: state.sessionId,
        sender: 'tool_error' as const,
        tool_name: call.name,
        tool_call_id: generatedId, // The ID we generated
        content_text: errMsg,
        tool_status: 'error' as const,
      };
      await state.supabaseAdmin
        .from('chat_messages')
        .insert(dbErrorMsg)
        .then(({ error: dbErr }) => {
          if (dbErr)
            console.error(
              '[Node AI Processor - ToolHandlerNode] DB error saving missing tool ID event:',
              dbErr
            );
        });
      if (state.realtimeChannel) {
        await state.realtimeChannel.send({
          type: 'broadcast',
          event: 'ai_response',
          payload: {
            type: 'tool_error',
            toolCallId: generatedId,
            toolName: call.name,
            message: errMsg,
          },
        });
      }
      continue;
    }

    if (toolInstance) {
      try {
        if (state.realtimeChannel) {
          await state.realtimeChannel.send({
            type: 'broadcast',
            event: 'ai_response',
            payload: {
              type: 'tool_start',
              toolCallId: toolCallIdFromAI,
              toolName: call.name,
              message: `Executing tool: ${call.name}...`,
            },
          });
        }
        const output = await toolInstance.invoke(call.args);
        const toolMessage = new ToolMessage({
          // Create the standard ToolMessage
          content: output as string,
          tool_call_id: toolCallIdFromAI,
          name: call.name,
        });
        toolResultsForAIMessage.push(toolMessage); // Add to list for AIMessage
        // Add the standard ToolMessage to the persistent graph state messages
        newMessages.push(toolMessage);

        // Save successful tool_result to DB and Realtime event
        if (
          call.name === 'generate_flamegraph_screenshot' ||
          call.name === 'generate_sandwich_flamegraph_screenshot'
        ) {
          // Updated condition
          try {
            const parsedOutput = output as unknown as FlamegraphSnapshotToolResponse;
            const dbToolResultMessage = {
              user_id: state.userId,
              trace_id: state.traceId,
              session_id: state.sessionId,
              sender: 'tool_result' as const,
              tool_name: call.name,
              tool_call_id: toolCallIdFromAI,
              content_text: parsedOutput.message || `Screenshot generated (${call.name}).`,
              content_image_url: parsedOutput.publicUrl, // Save public URL
              tool_status: parsedOutput.status as 'success' | 'success_with_warning' | 'error',
              metadata: { base64ProvidedToLLM: !!parsedOutput.base64Image }, // Note that base64 was handled
            };
            await state.supabaseAdmin
              .from('chat_messages')
              .insert(dbToolResultMessage)
              .then(({ error: dbErr }) => {
                if (dbErr)
                  console.error(
                    '[Node AI Processor - ToolHandlerNode] DB error saving screenshot tool_result:',
                    dbErr
                  );
              });

            if (
              parsedOutput.status === 'success' ||
              parsedOutput.status === 'success_with_warning'
            ) {
              if (state.realtimeChannel) {
                await state.realtimeChannel.send({
                  type: 'broadcast',
                  event: 'ai_response',
                  payload: {
                    type: 'tool_result',
                    toolCallId: toolCallIdFromAI,
                    toolName: call.name,
                    status: parsedOutput.status,
                    resultType: 'image',
                    textContent: parsedOutput.message,
                    imageUrl: parsedOutput.publicUrl,
                  },
                });
              }
            } else {
              // Tool itself reported an error in its JSON output
              const dbToolErrorMessage = {
                user_id: state.userId,
                trace_id: state.traceId,
                session_id: state.sessionId,
                sender: 'tool_error' as const,
                tool_name: call.name,
                tool_call_id: toolCallIdFromAI,
                content_text: parsedOutput.message || 'Tool reported an error in its output.',
                tool_status: 'error' as const,
              };
              await state.supabaseAdmin
                .from('chat_messages')
                .insert(dbToolErrorMessage)
                .then(({ error: dbErr }) => {
                  if (dbErr)
                    console.error(
                      '[Node AI Processor - ToolHandlerNode] DB error saving tool_error from parsed output:',
                      dbErr
                    );
                });
              if (state.realtimeChannel) {
                await state.realtimeChannel.send({
                  type: 'broadcast',
                  event: 'ai_response',
                  payload: {
                    type: 'tool_error',
                    toolCallId: toolCallIdFromAI,
                    toolName: call.name,
                    message: parsedOutput.message || 'Tool reported an error in its output.',
                  },
                });
              }
            }
          } catch (e) {
            const parseErrorMsg = `Failed to process tool output for ${call.name}.`;
            const dbParseErrorMessage = {
              user_id: state.userId,
              trace_id: state.traceId,
              session_id: state.sessionId,
              sender: 'tool_error' as const,
              tool_name: call.name,
              tool_call_id: toolCallIdFromAI,
              content_text: parseErrorMsg,
              tool_status: 'error' as const,
            };
            await state.supabaseAdmin
              .from('chat_messages')
              .insert(dbParseErrorMessage)
              .then(({ error: dbErr }) => {
                if (dbErr)
                  console.error(
                    '[Node AI Processor - ToolHandlerNode] DB error saving screenshot parse error:',
                    dbErr
                  );
              });
            if (state.realtimeChannel) {
              await state.realtimeChannel.send({
                type: 'broadcast',
                event: 'ai_response',
                payload: {
                  type: 'tool_error',
                  toolCallId: toolCallIdFromAI,
                  toolName: call.name,
                  message: parseErrorMsg,
                },
              });
            }
          }
        } else {
          // For other tools like TopFunctionsTool (text output)
          const dbToolResultMessage = {
            user_id: state.userId,
            trace_id: state.traceId,
            session_id: state.sessionId,
            sender: 'tool_result' as const,
            tool_name: call.name,
            tool_call_id: toolCallIdFromAI,
            content_text: output as string,
            tool_status: 'success' as const,
          };
          await state.supabaseAdmin
            .from('chat_messages')
            .insert(dbToolResultMessage)
            .then(({ error: dbErr }) => {
              if (dbErr)
                console.error(
                  '[Node AI Processor - ToolHandlerNode] DB error saving text tool_result:',
                  dbErr
                );
            });
          if (state.realtimeChannel) {
            await state.realtimeChannel.send({
              type: 'broadcast',
              event: 'ai_response',
              payload: {
                type: 'tool_result',
                toolCallId: toolCallIdFromAI,
                toolName: call.name,
                status: 'success',
                resultType: 'text',
                textContent: output as string,
              },
            });
          }
        }
      } catch (e: any) {
        // Error during toolInstance.invoke()
        // Error during toolInstance.invoke()
        const errorMsg = e instanceof Error ? e.message : String(e);
        const errorToolMessage = new ToolMessage({
          content: `Error: ${errorMsg}`,
          tool_call_id: toolCallIdFromAI,
          name: call.name,
        });
        toolResultsForAIMessage.push(errorToolMessage);
        newMessages.push(errorToolMessage); // Add error tool message to persistent state
        if (state.realtimeChannel) {
          await state.realtimeChannel.send({
            type: 'broadcast',
            event: 'ai_response',
            payload: {
              type: 'tool_error',
              toolCallId: toolCallIdFromAI,
              toolName: call.name,
              message: `Execution failed: ${errorMsg}`,
            },
          });
        }
        // Save this specific error to DB as a 'tool_error' for this pseudo-tool call
        const dbInvokeErrorMessage = {
          user_id: state.userId,
          trace_id: state.traceId,
          session_id: state.sessionId,
          sender: 'tool_error' as const,
          tool_name: call.name,
          tool_call_id: toolCallIdFromAI,
          content_text: `Execution failed: ${errorMsg}`,
          tool_status: 'error' as const,
        };
        await state.supabaseAdmin
          .from('chat_messages')
          .insert(dbInvokeErrorMessage)
          .then(({ error: dbErr }) => {
            if (dbErr)
              console.error(
                '[Node AI Processor - ToolHandlerNode] DB error saving tool invoke error:',
                dbErr
              );
          });
      }
    } else {
      // Unknown tool
      const unknownToolErrorMsg = `Unknown tool called: ${call.name}`;
      const errorToolMessage = new ToolMessage({
        content: `Error: ${unknownToolErrorMsg}`,
        tool_call_id: toolCallIdFromAI,
        name: call.name,
      });
      toolResultsForAIMessage.push(errorToolMessage);
      newMessages.push(errorToolMessage); // Add error tool message to persistent state
      if (state.realtimeChannel) {
        await state.realtimeChannel.send({
          type: 'broadcast',
          event: 'ai_response',
          payload: {
            type: 'tool_error',
            toolCallId: toolCallIdFromAI,
            toolName: call.name,
            message: unknownToolErrorMsg,
          },
        });
      }
      // Save this specific error to DB as a 'tool_error' for this pseudo-tool call
      const dbUnknownToolMessage = {
        user_id: state.userId,
        trace_id: state.traceId,
        session_id: state.sessionId,
        sender: 'tool_error' as const,
        tool_name: call.name,
        tool_call_id: toolCallIdFromAI,
        content_text: unknownToolErrorMsg,
        tool_status: 'error' as const,
      };
      await state.supabaseAdmin
        .from('chat_messages')
        .insert(dbUnknownToolMessage)
        .then(({ error: dbErr }) => {
          if (dbErr)
            console.error(
              '[Node AI Processor - ToolHandlerNode] DB error saving unknown tool error:',
              dbErr
            );
        });
    }
  }

  // The AIMessage that invoked the tools is already in state.messages.
  // We have now added the ToolMessages (and potentially a HumanMessage with an image) to newMessages.
  return {
    messages: newMessages, // This now includes the original messages, plus ToolMessages, plus HumanMessage (if image)
    llmStreamingActiveForCurrentSegment: false,
  };
}

const AgentStateAnnotations = Annotation.Root({
  // Changed name for clarity
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => y,
    default: () => [],
  }),
  supabaseAdmin: Annotation<null | SupabaseClient>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  realtimeChannel: Annotation<null | any>({ reducer: (x, y) => y ?? x, default: () => null }),
  userId: Annotation<string | null>({ reducer: (x, y) => y ?? x, default: () => null }),
  traceId: Annotation<string | null>({ reducer: (x, y) => y ?? x, default: () => null }),
  profileArrayBuffer: Annotation<ArrayBuffer | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  profileData: Annotation<null | any>({ reducer: (x, y) => y ?? x, default: () => null }),
  traceSummary: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),
  llmStreamingActiveForCurrentSegment: Annotation<boolean>({
    reducer: (x, y) => y,
    default: () => false,
  }),
  currentToolName: Annotation<string | null>({ reducer: (x, y) => y ?? x, default: () => null }),
  iterationCount: Annotation<number>({ reducer: (x, y) => y, default: () => 0 }),
  maxIterations: Annotation<number>({ reducer: (x, y) => y ?? x, default: () => 7 }),
  sessionId: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),
});

const workflow = new StateGraph(AgentStateAnnotations) // Used updated name
  .addNode('initialSetup', initialSetupNode)
  .addNode('agent', agentNode)
  .addNode('toolHandler', toolHandlerNode);

workflow.setEntryPoint('initialSetup');
workflow.addEdge('initialSetup', 'agent');
workflow.addEdge('toolHandler', 'agent');

workflow.addConditionalEdges(
  'agent',
  (state: AgentState) => {
    const lastMessage = state.messages[state.messages.length - 1];
    if (
      lastMessage?._getType() === 'ai' &&
      (lastMessage as AIMessage).tool_calls &&
      (lastMessage as AIMessage).tool_calls!.length > 0
    ) {
      return 'toolHandler';
    }
    if (state.iterationCount >= state.maxIterations) {
      return END;
    }
    if (
      lastMessage?.content &&
      typeof lastMessage.content === 'string' &&
      (lastMessage.content.toLowerCase().includes('bottleneck identified') ||
        lastMessage.content.toLowerCase().includes('analysis complete'))
    ) {
      return END;
    }
    return END;
  },
  {
    toolHandler: 'toolHandler',
    [END]: END,
  }
);

const app = workflow.compile();

// --- Main Exported Function ---
export interface ProcessAiTurnPayload {
  userId: string;
  prompt: string;
  traceId: string;
  sessionId: string;
}

export async function processAiTurnLogic(payload: ProcessAiTurnPayload): Promise<void> {
  const { userId, prompt: userPrompt, traceId, sessionId } = payload;

  const missingEnvVars: string[] = [];
  if (!OPENAI_API_KEY) missingEnvVars.push('OPENAI_API_KEY');
  if (!SUPABASE_URL) missingEnvVars.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missingEnvVars.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missingEnvVars.length > 0) {
    const errorMessage = `Missing critical environment variables: ${missingEnvVars.join(', ')}`;
    console.error(`[Node AI Processor] ${errorMessage}`);
    throw new Error(`Internal configuration error: ${errorMessage}`);
  }

  const supabaseAdmin = createClient<Database>(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const realtimeChannel = supabaseAdmin.channel(`private-chat-results-${userId}`);

  try {
    // 1. Insert the user prompt into the chat_messages table
    const { error: insertError } = await supabaseAdmin.from('chat_messages').insert({
      user_id: userId,
      trace_id: traceId,
      session_id: sessionId,
      sender: 'user',
      content_text: userPrompt,
    });

    if (insertError) {
      console.error('[Node AI Processor] Error saving user prompt to DB:', insertError);
      // Decide if to throw or just log. For now, log and attempt to continue.
      // Throwing might be better to ensure data integrity if saving history is critical.
      // For now, we'll try to send an error over realtime and then throw to prevent further processing on bad state.
      const dbErrorMsg = 'Failed to save your message to the database.';
      if (realtimeChannel) {
        try {
          await realtimeChannel.send({
            type: 'broadcast',
            event: 'ai_response',
            payload: { type: 'error', message: dbErrorMsg },
          });
        } catch (e) {}
      }
      throw new Error(`${dbErrorMsg} Details: ${insertError.message}`);
    }

    // 2. Subscribe to the realtime channel
    await new Promise<void>((resolve, reject) => {
      realtimeChannel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Node AI Processor - Realtime] Subscribed to channel for user ${userId}`);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
          console.error(
            `[Node AI Processor - Realtime] Subscription error for user ${userId}:`,
            status,
            err
          );
          reject(err || new Error(`Realtime subscription failed with status: ${status}`));
        }
      });
    });

    // 3. Fetch the chat history from the database
    const HISTORY_LIMIT = 20;
    const { data: dbHistory, error: fetchHistoryError } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('trace_id', traceId)
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(HISTORY_LIMIT);

    if (fetchHistoryError) {
      console.error('[Node AI Processor] Error fetching chat history from DB:', fetchHistoryError);
      const dbErrorMsg = 'Failed to load conversation history.';
      if (realtimeChannel) {
        try {
          await realtimeChannel.send({
            type: 'broadcast',
            event: 'ai_response',
            payload: { type: 'error', message: dbErrorMsg },
          });
        } catch (e) {}
      }
      throw new Error(`${dbErrorMsg} Details: ${fetchHistoryError.message}`);
    }

    const langChainMessages: BaseMessage[] = [];

    console.log(`[Node AI Processor] Received ${dbHistory.length} messages from DB`);

    try {
      await fs.writeFile(
        `${LOGS_DIR}/dbHistory_${traceId}_${sessionId}.json`,
        JSON.stringify(dbHistory, null, 2)
      );
    } catch (e) {
      console.error('[Node AI Processor] Error saving DB history to file:', e);
    }

    if (dbHistory) {
      for (const dbMsg of dbHistory) {
        if (dbMsg.sender === 'user' && dbMsg.content_text) {
          langChainMessages.push(new HumanMessage({ content: dbMsg.content_text }));
        } else if (dbMsg.sender === 'model') {
          if (
            dbMsg.tool_calls_json &&
            Array.isArray(dbMsg.tool_calls_json) &&
            (dbMsg.tool_calls_json as any[]).length > 0
          ) {
            // Type assertion for tool_calls, assuming dbMsg.tool_calls_json is already in the correct format [{name, args, id}, ...]
            const toolCalls = (dbMsg.tool_calls_json as any[]).map((tc) => ({
              name: tc.name,
              args: tc.args,
              id: tc.id,
              type: tc.type, // Preserve type if present (e.g. 'tool_call' or 'function')
            }));
            langChainMessages.push(
              new AIMessage({
                content: dbMsg.content_text || '',
                tool_calls: toolCalls,
              })
            );
          } else {
            langChainMessages.push(new AIMessage({ content: dbMsg.content_text || '' }));
          }
        } else if (dbMsg.sender === 'tool_result') {
          if (dbMsg.tool_name && dbMsg.tool_call_id && dbMsg.content_text) {
            langChainMessages.push(
              new ToolMessage({
                content: dbMsg.content_text,
                name: dbMsg.tool_name,
                tool_call_id: dbMsg.tool_call_id,
              })
            );
            // If it was a screenshot and we persisted the HumanMessage with image separately:
            // TODO: Fix image persistence across chat history.
            if (
              (dbMsg.tool_name === 'generate_flamegraph_screenshot' ||
                dbMsg.tool_name === 'generate_sandwich_flamegraph_screenshot') &&
              dbMsg.content_image_url
            ) {
              // The HumanMessage with base64 image is now added to persistent state by toolHandlerNode.
              // If that HumanMessage was ALSO saved to DB with a specific sender type or metadata,
              // we could reconstruct it here. For now, assume toolHandlerNode's in-memory addition to state.messages handles this for the next LLM call.
              // The persisted record here is for the client UI and long-term log.
            }
          }
        } else if (
          dbMsg.sender === 'tool_error' &&
          dbMsg.tool_name &&
          dbMsg.tool_call_id &&
          dbMsg.content_text
        ) {
          langChainMessages.push(
            new ToolMessage({
              content: `Error from tool ${dbMsg.tool_name}: ${dbMsg.content_text}`,
              name: dbMsg.tool_name,
              tool_call_id: dbMsg.tool_call_id,
            })
          );
        }
      }
    }

    const initialState: AgentState = {
      messages: langChainMessages,
      supabaseAdmin,
      realtimeChannel,
      userId,
      traceId,
      sessionId,
      profileArrayBuffer: null,
      profileData: null,
      traceSummary: '',
      llmStreamingActiveForCurrentSegment: false,
      currentToolName: null,
      iterationCount: 0,
      maxIterations: 7,
    };

    console.log('[Node AI Processor] Invoking LangGraph app stream with DB history...');
    const stream = await app.stream(initialState, { recursionLimit: 25 });

    for await (const event of stream) {
      if (event[END] !== undefined) {
        console.log(
          '[Node AI Processor - Graph Stream] Reached END state in graph execution stream.'
        );
      }
    }

    console.log('[Node AI Processor] LangGraph app stream finished.');
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'ai_response',
      payload: { type: 'model_response_end' },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `[Node AI Processor] CRITICAL ERROR in processAiTurnLogic for user ${userId}: ${errorMsg}`,
      error
    );
    try {
      if (realtimeChannel && realtimeChannel.state === 'joined') {
        // Check if channel is joined
        await realtimeChannel.send({
          type: 'broadcast',
          event: 'ai_response',
          payload: {
            type: 'error',
            message: errorMsg || 'An internal error occurred processing your request.',
          },
        });
      }
    } catch (rtError: any) {
      // Added type for rtError
      console.warn(
        `[Node AI Processor] Failed to send critical error over Realtime channel:`,
        rtError
      );
    }
    // Re-throw the error so the calling Express handler can send an HTTP error response
    throw error;
  } finally {
    if (realtimeChannel) {
      console.log(`[Node AI Processor] Removing Realtime channel for user ${userId}`);
      await supabaseAdmin.removeChannel(realtimeChannel);
    }
  }
}
