// Remove Deno-specific runtime import
// import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from '@supabase/supabase-js'; // Changed to npm import

// TODO: Port or create cors.ts for Node.js if needed for shared headers, or handle in Express
// import { corsHeaders } from '../_shared/cors.ts';

import { getDurationMsFromProfileGroup } from '@flamedeck/speedscope-import'; // Assuming this workspace import resolves

import { parseProfileBuffer, type ProfileLoadResult } from './profile-loader'; // Using the new Node.js version
import { TopFunctionsTool, GenerateFlamegraphSnapshotTool } from './trace-tools'; // Using the new Node.js version

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
- Stop when you have identified a likely bottleneck or after a few investigation steps.

- You can use the 'generate_flamegraph_screenshot' tool to get images of the flamegraph - you can zoom in to specific areas of the flamegraph using the startDepth, startTimeMs and endTimeMs parameters to debug specific callstacks.
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
}

// --- LangGraph Nodes ---

async function initialSetupNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Node AI Processor - SetupNode] Starting initial setup...');
  const { supabaseAdmin, traceId, userId, realtimeChannel } = state;

  try {
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
    // Using the imported parseProfileBuffer from ./profile-loader
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
    if (updatedMessages.length > 0 && updatedMessages[0]._getType() === 'system') {
      (updatedMessages[0] as SystemMessage).content = systemPromptContent;
    } else {
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
        const errorMessage = err instanceof Error ? err.message : String(err);
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

  // Prepare messages for this specific LLM invocation - now directly from state
  let messagesForLLMInvocation = [...state.messages];
  // const lastMessageFromState = state.messages[state.messages.length - 1]; // No longer needed here

  // Removed the block that checked lastMessageFromState and pushed a new HumanMessage with image,
  // as this is now handled by toolHandlerNode adding it to the persistent state.messages.

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

  const currentTools = [
    new TopFunctionsTool(state.profileData),
    new GenerateFlamegraphSnapshotTool(
      state.supabaseAdmin,
      state.profileArrayBuffer!,
      state.userId,
      state.traceId
    ),
  ];
  const modelWithTools = llm.bindTools(currentTools);

  let llmResponse;
  try {
    llmResponse = await modelWithTools.invoke(messagesForLLMInvocation, {
      // messagesForLLMInvocation now comes directly from state
      callbacks: langChainCallbacks,
    });
  } catch (invokeError: any) {
    console.error('[Node AI Processor - AgentNode] modelWithTools.invoke failed:', invokeError);
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
    // Return current state messages and increment iteration
    return { messages: state.messages, iterationCount: state.iterationCount + 1 };
  }

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

        if (state.realtimeChannel) {
          if (call.name === 'generate_flamegraph_screenshot') {
            try {
              const parsedOutput = JSON.parse(output as string);
              if (
                parsedOutput.status === 'success' ||
                parsedOutput.status === 'success_with_warning'
              ) {
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

                // Create and add HumanMessage with image to persistent state
                if (parsedOutput.base64Image) {
                  const imageMessageForHistory = new HumanMessage({
                    content: [
                      {
                        type: 'text',
                        text:
                          parsedOutput.message ||
                          `Snapshot (tool call ID: ${toolCallIdFromAI}) was generated and is now part of the history.`,
                      },
                      {
                        type: 'image_url',
                        image_url: { url: `data:image/png;base64,${parsedOutput.base64Image}` },
                      },
                    ],
                  });
                  newMessages.push(imageMessageForHistory); // Add to persistent messages
                  console.log(
                    '[Node AI Processor - ToolHandlerNode] Added HumanMessage with image to persistent history.'
                  );
                }
              } else {
                await state.realtimeChannel.send({
                  type: 'broadcast',
                  event: 'ai_response',
                  payload: {
                    type: 'tool_error',
                    toolCallId: toolCallIdFromAI,
                    toolName: call.name,
                    message: parsedOutput.error || 'Tool reported an error in its output.',
                  },
                });
              }
            } catch (e) {
              console.error(
                '[Node AI Processor - ToolHandlerNode] Error processing screenshot output:',
                e
              );
              await state.realtimeChannel.send({
                type: 'broadcast',
                event: 'ai_response',
                payload: {
                  type: 'tool_error',
                  toolCallId: toolCallIdFromAI,
                  toolName: call.name,
                  message: 'Failed to process tool output for screenshot.',
                },
              });
            }
          } else {
            // For other tools like TopFunctionsTool (assume text output)
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
  history?: { sender: 'user' | 'model'; text: string }[];
}

export async function processAiTurnLogic(payload: ProcessAiTurnPayload): Promise<void> {
  const { userId, prompt: userPrompt, traceId, history = [] } = payload;

  const missingEnvVars: string[] = [];
  if (!OPENAI_API_KEY) missingEnvVars.push('OPENAI_API_KEY');
  if (!SUPABASE_URL) missingEnvVars.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missingEnvVars.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missingEnvVars.length > 0) {
    const errorMessage = `Missing critical environment variables: ${missingEnvVars.join(', ')}`;
    console.error(`[Node AI Processor] ${errorMessage}`);
    throw new Error(`Internal configuration error: ${errorMessage}`);
  }

  const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const realtimeChannel = supabaseAdmin.channel(`private-chat-results-${userId}`);

  try {
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

    const initialMessages: BaseMessage[] = mapHistoryToLangchainMessages(history);
    initialMessages.push(new HumanMessage(userPrompt));

    const initialState: AgentState = {
      messages: initialMessages,
      supabaseAdmin,
      realtimeChannel,
      userId,
      traceId,
      profileArrayBuffer: null,
      profileData: null,
      traceSummary: '',
      llmStreamingActiveForCurrentSegment: false,
      currentToolName: null,
      iterationCount: 0,
      maxIterations: 7,
    };

    console.log('[Node AI Processor] Invoking LangGraph app stream...');
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
