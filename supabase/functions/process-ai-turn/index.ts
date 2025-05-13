import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

import { getDurationMsFromProfileGroup } from '../../../packages/speedscope-import/src/index.ts';
import { parseProfileBuffer, type ProfileLoadResult } from '../_shared/profile-loader.ts';
import { TopFunctionsTool, GenerateFlamegraphSnapshotTool } from './trace-tools.ts';

// Langchain imports: Now using bare specifiers, relying on deno.json
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

console.log(`Function process-ai-turn (LangGraph version) booting up!`);

// Environment Variables
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const FLAMECHART_SERVER_URL = Deno.env.get('FLAMECHART_SERVER_URL');

// We need a reasoning model for this complex task
const MODEL_NAME = Deno.env.get('AI_ANALYSIS_MODEL') || 'o4-mini';

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
- Describe your observations and reasoning for each step.
- Stop when you have identified a likely bottleneck or after a few investigation steps.

- You can use the 'generate_flamegraph_screenshot' tool to request zoomed-in views. If successful, the image will be provided to you.
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
  flamechartServerUrl: string;

  // For managing LangChain streaming callbacks
  llmStreamingActiveForCurrentSegment: boolean;
  currentToolName: string | null; // For callbacks

  // Iteration control for the graph
  iterationCount: number;
  maxIterations: number;
}

// --- LangGraph Nodes ---

async function initialSetupNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Graph SetupNode] Starting initial setup...');
  const { supabaseAdmin, traceId, userId, realtimeChannel } = state;

  try {
    const { data: traceRecord, error: dbError } = await supabaseAdmin
      .from('traces')
      .select('blob_path')
      .eq('id', traceId)
      .single();

    if (dbError || !traceRecord?.blob_path) {
      const msg = `Trace record not found for ID ${traceId}`;
      console.error(`[Graph SetupNode] ${msg}:`, dbError);
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
      console.error(`[Graph SetupNode] ${msg}:`, blobError);
      await realtimeChannel.send({
        type: 'broadcast',
        event: 'ai_response',
        payload: { type: 'error', message: 'Failed to load profile data from storage.' },
      });
      throw new Error(msg);
    }
    const profileArrayBuffer = await blobData.arrayBuffer();
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

    console.log('[Graph SetupNode] Profile loaded and parsed. Summary generated.');

    // Prepare the messages with the system prompt
    const systemPromptContent = SYSTEM_PROMPT_TEMPLATE_STRING.replace(
      '{trace_summary}',
      traceSummary
    );
    // state.messages already contains initial user prompt + history from Deno.serve
    let updatedMessages = [...state.messages];
    if (updatedMessages.length > 0 && updatedMessages[0]._getType() === 'system') {
      // If first message is already a system message, update its content
      (updatedMessages[0] as SystemMessage).content = systemPromptContent;
    } else {
      // Otherwise, prepend the new system message
      updatedMessages.unshift(new SystemMessage(systemPromptContent));
    }

    return { profileArrayBuffer, profileData, traceSummary, messages: updatedMessages };
  } catch (error) {
    console.error('[Graph SetupNode] Critical error during setup:', error);
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
  console.log(`[Graph AgentNode] Iteration ${state.iterationCount}. Calling LLM.`);
  let callbackState = {
    llmStreamingActiveForCurrentSegment: state.llmStreamingActiveForCurrentSegment,
    currentToolName: state.currentToolName,
  };

  const langChainCallbacks: CallbackHandlerMethods[] = [
    {
      handleLLMNewToken: async (token: string) => {
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
        console.log('[Callback] LLM End.');
      },
      handleLLMError: async (err: any) => {
        console.error('[Callback] LLM Error:', err);
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
        const identifiedToolName =
          name || tool?.name || tool?.id?.[tool?.id?.length - 1] || 'unknown_tool_starting';
        callbackState.currentToolName = identifiedToolName;
        callbackState.llmStreamingActiveForCurrentSegment = false; // Reset for new segment
        console.log(
          `[Callback] Tool Start: ${callbackState.currentToolName}, Input: ${input.substring(0, 100)}...`
        );
        await state.realtimeChannel.send({
          type: 'broadcast',
          event: 'ai_response',
          payload: {
            type: 'tool_start',
            toolName: callbackState.currentToolName,
            message: `Using tool: ${callbackState.currentToolName}...`,
          },
        });
      },
      handleToolEnd: async (
        output: any,
        runId: string,
        parentRunId?: string,
        tags?: string[] | undefined,
        name?: string
      ) => {
        const toolNameForEvent = name || callbackState.currentToolName || 'unknown_tool_ended';
        callbackState.llmStreamingActiveForCurrentSegment = false;
        console.log(
          `[Callback] Tool End: ${toolNameForEvent}. Output (first 100 chars): ${output.substring(0, 100)}`
        );
        if (typeof output === 'string') {
          try {
            const parsedOutput = JSON.parse(output);
            if (parsedOutput.status === 'Error') {
              await state.realtimeChannel.send({
                type: 'broadcast',
                event: 'ai_response',
                payload: {
                  type: 'tool_error',
                  toolName: toolNameForEvent,
                  message: parsedOutput.error || 'Tool reported an error.',
                },
              });
            }
          } catch (e) {
            /* not a JSON error object */
          }
        }
        if (callbackState.currentToolName === toolNameForEvent)
          callbackState.currentToolName = null;
      },
      handleToolError: async (err: any, runId: string, parentRunId?: string, tags?: string[]) => {
        const toolNameForEvent = callbackState.currentToolName || 'unknown_tool_error';
        const errorMessage = err instanceof Error ? err.message : String(err);
        callbackState.llmStreamingActiveForCurrentSegment = false;
        console.error(`[Callback] Tool Error from LLM/Agent level for ${toolNameForEvent}:`, err);
        await state.realtimeChannel.send({
          type: 'broadcast',
          event: 'ai_response',
          payload: {
            type: 'tool_error',
            toolName: toolNameForEvent,
            message: `Error during setup/call for tool ${toolNameForEvent}: ${errorMessage}`,
          },
        });
        if (callbackState.currentToolName === toolNameForEvent)
          callbackState.currentToolName = null;
      },
    },
  ];

  let messagesForLLMInvocation = [...state.messages];
  const lastMessageFromState = state.messages[state.messages.length - 1];

  // Handle adding image to LLM input if last message was a successful screenshot tool call
  if (
    lastMessageFromState instanceof ToolMessage &&
    lastMessageFromState.name === 'generate_flamegraph_screenshot'
  ) {
    try {
      const toolOutput = JSON.parse(lastMessageFromState.content as string);
      if (
        (toolOutput.status === 'Success' || toolOutput.status === 'SuccessWithWarning') &&
        toolOutput.base64Image
      ) {
        console.log(
          `[Graph AgentNode] Detected successful screenshot tool output with base64Image.`
        );
        // This message is for the LLM invocation, not persisted in state unless explicitly added later
        messagesForLLMInvocation.push(
          new HumanMessage({
            content: [
              {
                type: 'text',
                text: toolOutput.message || `Screenshot was generated. Please analyze this image.`,
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${toolOutput.base64Image}` },
              },
            ],
          })
        );
      } else {
        console.log(
          `[Graph AgentNode] Screenshot tool did not return usable image data (status: ${toolOutput.status}).`
        );
      }
    } catch (e) {
      console.error(
        '[Graph AgentNode] Error parsing screenshot tool output for image handling:',
        e
      );
    }
  }

  // Ensure System Message is correctly placed (initialSetupNode should handle this primarily)
  // This is a safeguard for the messages being passed to the LLM.
  if (
    messagesForLLMInvocation.length === 0 ||
    messagesForLLMInvocation[0]._getType() !== 'system'
  ) {
    const systemPromptContent = SYSTEM_PROMPT_TEMPLATE_STRING.replace(
      '{trace_summary}',
      state.traceSummary
    );
    messagesForLLMInvocation = [
      new SystemMessage(systemPromptContent),
      ...messagesForLLMInvocation.filter((m) => m._getType() !== 'system'),
    ];
  } else if (messagesForLLMInvocation[0]._getType() === 'system') {
    (messagesForLLMInvocation[0] as SystemMessage).content = SYSTEM_PROMPT_TEMPLATE_STRING.replace(
      '{trace_summary}',
      state.traceSummary
    );
  }

  const currentTools = [
    new TopFunctionsTool(state.profileData),
    new GenerateFlamegraphSnapshotTool(
      state.supabaseAdmin,
      state.flamechartServerUrl!,
      state.profileArrayBuffer!,
      state.userId,
      state.traceId
    ),
  ];
  const modelWithTools = llm.bindTools(currentTools);
  const response = await modelWithTools.invoke(messagesForLLMInvocation, {
    callbacks: langChainCallbacks,
  });

  // The new state for messages includes the original state.messages plus the new AI response.
  // The HumanMessage with image (if added) was only for the LLM call and is not persisted here
  // unless we explicitly add it to newMessages. For now, assuming it's not persisted in the chat history.
  const newMessages = [...state.messages, response];

  return {
    messages: newMessages, // Return the new complete message history
    llmStreamingActiveForCurrentSegment: callbackState.llmStreamingActiveForCurrentSegment,
    currentToolName: callbackState.currentToolName,
    iterationCount: state.iterationCount + 1,
  };
}

// Define a type for individual tool calls if not already available from LangChain types
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
    console.warn('[Graph ToolHandlerNode] Called without tool_calls in last message.');
    // If no tools, return the current state messages (no change)
    // or return {} if messages should not be redundantly set by this node in this case.
    // For (x,y)=>y reducer, returning current state is fine if no changes.
    return { messages: state.messages };
  }
  console.log(
    `[Graph ToolHandlerNode] Executing tools: ${lastMessage.tool_calls.map((tc: ToolCall) => tc.name).join(', ')}`
  );

  const toolInvocations = lastMessage.tool_calls as ToolCall[];
  const toolResults: ToolMessage[] = [];

  const tools = [
    new TopFunctionsTool(state.profileData!),
    new GenerateFlamegraphSnapshotTool(
      state.supabaseAdmin,
      state.flamechartServerUrl!,
      state.profileArrayBuffer!,
      state.userId,
      state.traceId
    ),
  ];

  let callbackState = {
    llmStreamingActiveForCurrentSegment: state.llmStreamingActiveForCurrentSegment,
  };

  for (const call of toolInvocations) {
    const toolInstance = tools.find((t) => t.name === call.name);
    const toolCallIdFromAI = call.id;

    if (!toolCallIdFromAI || typeof toolCallIdFromAI !== 'string') {
      const errMsg = `Tool call from AI (name: ${call.name}) is missing a valid string ID. Received ID: ${toolCallIdFromAI}`;
      console.error(`[Graph ToolHandlerNode] ${errMsg}`, call);
      toolResults.push(
        new ToolMessage({
          content: `Error: ${errMsg}`,
          tool_call_id: toolCallIdFromAI || crypto.randomUUID(),
          name: call.name,
        })
      );
      await state.realtimeChannel.send({
        type: 'broadcast',
        event: 'ai_response',
        payload: { type: 'tool_error', toolName: call.name, message: errMsg },
      });
      continue;
    }

    if (toolInstance) {
      try {
        console.log(
          `[Graph ToolHandlerNode] Calling tool: ${call.name} with id: ${toolCallIdFromAI} and args:`,
          call.args
        );
        callbackState.llmStreamingActiveForCurrentSegment = false;
        await state.realtimeChannel.send({
          type: 'broadcast',
          event: 'ai_response',
          payload: {
            type: 'tool_start',
            toolName: call.name,
            message: `Executing tool: ${call.name}...`,
          },
        });

        const output = await toolInstance.invoke(call.args);

        toolResults.push(
          new ToolMessage({
            content: output as string,
            tool_call_id: toolCallIdFromAI,
            name: call.name,
          })
        );
        console.log(
          `[Graph ToolHandlerNode] Tool ${call.name} output (first 100 chars): ${(output as string).substring(0, 100)}`
        );
        let toolFailed = false;
        if (typeof output === 'string') {
          try {
            const parsedOutput = JSON.parse(output);
            if (parsedOutput.status === 'Error') {
              toolFailed = true;
              await state.realtimeChannel.send({
                type: 'broadcast',
                event: 'ai_response',
                payload: {
                  type: 'tool_error',
                  toolName: call.name,
                  message: parsedOutput.error || 'Tool reported an error.',
                },
              });
            }
          } catch (e) {
            /* not a JSON error from tool */
          }
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error(
          `[Graph ToolHandlerNode] Error executing tool ${call.name} (id: ${toolCallIdFromAI}):`,
          e
        );
        toolResults.push(
          new ToolMessage({
            content: `Error: ${errorMsg}`,
            tool_call_id: toolCallIdFromAI,
            name: call.name,
          })
        );
        await state.realtimeChannel.send({
          type: 'broadcast',
          event: 'ai_response',
          payload: {
            type: 'tool_error',
            toolName: call.name,
            message: `Execution failed: ${errorMsg}`,
          },
        });
      }
    } else {
      const unknownToolErrorMsg = `Unknown tool called: ${call.name}`;
      console.error(`[Graph ToolHandlerNode] ${unknownToolErrorMsg} (id: ${toolCallIdFromAI})`);
      toolResults.push(
        new ToolMessage({
          content: `Error: ${unknownToolErrorMsg}`,
          tool_call_id: toolCallIdFromAI,
          name: call.name,
        })
      );
      await state.realtimeChannel.send({
        type: 'broadcast',
        event: 'ai_response',
        payload: { type: 'tool_error', toolName: call.name, message: unknownToolErrorMsg },
      });
    }
  }

  const newMessages = [...state.messages, ...toolResults];
  return {
    messages: newMessages, // Return the new complete message history
    llmStreamingActiveForCurrentSegment: callbackState.llmStreamingActiveForCurrentSegment,
  };
}

const AgentState = Annotation.Root({
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
  flamechartServerUrl: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  llmStreamingActiveForCurrentSegment: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  currentToolName: Annotation<string | null>({ reducer: (x, y) => y ?? x, default: () => null }),
  iterationCount: Annotation<number>({ reducer: (x, y) => y, default: () => 0 }),
  maxIterations: Annotation<number>({ reducer: (x, y) => y ?? x, default: () => 7 }),
});

const workflow = new StateGraph(AgentState)
  .addNode('initialSetup', initialSetupNode)
  .addNode('agent', agentNode)
  .addNode('toolHandler', toolHandlerNode);

// Set the entry point
workflow.setEntryPoint('initialSetup'); // Or '__start__' if that's your convention

// Define edges
workflow.addEdge('initialSetup', 'agent');
workflow.addEdge('toolHandler', 'agent'); // After tools are handled, go back to the agent to process results

// Conditional Pges from Agent
workflow.addConditionalEdges(
  'agent', // Source Node
  (state: AgentState) => {
    const lastMessage = state.messages[state.messages.length - 1];
    if (
      lastMessage?._getType() === 'ai' && // Check if lastMessage is defined
      (lastMessage as AIMessage).tool_calls &&
      (lastMessage as AIMessage).tool_calls!.length > 0
    ) {
      console.log('[Graph Router] Agent called tools. Routing to toolHandler.');
      return 'toolHandler'; // Route to toolHandler if tools are called
    }

    // If no tools are called, check other stopping conditions
    if (state.iterationCount >= state.maxIterations) {
      console.log('[Graph Router] Max iterations reached. Ending graph.');
      return END;
    }
    if (
      lastMessage?.content && // Check if lastMessage and content are defined
      typeof lastMessage.content === 'string' &&
      (lastMessage.content.toLowerCase().includes('bottleneck identified') ||
        lastMessage.content.toLowerCase().includes('analysis complete'))
    ) {
      console.log('[Graph Router] AI indicated analysis complete. Ending graph.');
      return END;
    }

    console.log(
      '[Graph Router] No tool calls from AI, and no explicit end condition met. Ending graph for this turn.'
    );
    return END; // If no tools and no other stop condition, end the current autonomous run.
  },
  {
    toolHandler: 'toolHandler', // Mapping for the 'toolHandler' route
    [END]: END, // Mapping for the END route
  }
);

const app = workflow.compile();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FLAMECHART_SERVER_URL) {
    console.error('Missing environment variables');
    return new Response(JSON.stringify({ error: 'Internal configuration error.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Bad Request';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const { userId, prompt: userPrompt, traceId, history = [] } = payload;
  if (!userId || !userPrompt || !traceId) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: userId, prompt, traceId' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const realtimeChannel = supabaseAdmin.channel(`private-chat-results-${userId}`);

  try {
    await new Promise<void>((resolve, reject) => {
      // Corrected Promise generic type
      realtimeChannel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to channel for user ${userId}`);
          resolve(); // Resolve with no value for Promise<void>
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
          console.error(`[Realtime] Subscription error for user ${userId}:`, status, err);
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
      flamechartServerUrl: FLAMECHART_SERVER_URL!,
      llmStreamingActiveForCurrentSegment: false,
      currentToolName: null,
      iterationCount: 0,
      maxIterations: 7,
    };

    console.log('[Graph Main] Invoking LangGraph app stream...');
    // Pass recursionLimit directly in the second argument for app.stream config
    // @ts-ignore - recursionLimit is a valid option for app.stream
    const stream = await app.stream(initialState, { recursionLimit: 25 });

    for await (const event of stream) {
      if (event[END] !== undefined) {
        console.log('[Graph Stream] Reached END state in graph execution stream.');
      }
    }

    console.log('[Graph Main] LangGraph app stream finished.');
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'ai_response',
      payload: { type: 'model_response_end' },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'AI response processed with LangGraph.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `[Graph Main] CRITICAL ERROR in Deno.serve for user ${userId}: ${errorMsg}`,
      error
    );
    try {
      await realtimeChannel.send({
        type: 'broadcast',
        event: 'ai_response',
        payload: {
          type: 'error',
          message: errorMsg || 'An internal error occurred processing your request.',
        },
      });
    } catch (rtError) {
      console.warn(`[Graph Main] Failed to send critical error over Realtime channel:`, rtError);
    }
    return new Response(JSON.stringify({ error: errorMsg || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  } finally {
    if (realtimeChannel) {
      console.log(`[Graph Main] Removing channel for user ${userId}`);
      await supabaseAdmin.removeChannel(realtimeChannel);
    }
  }
});
