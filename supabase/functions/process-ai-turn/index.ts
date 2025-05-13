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

const MODEL_NAME = Deno.env.get('MODEL_NAME') || 'gpt-4o';

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

    // Add SystemMessage here if not present, using the generated traceSummary
    const systemPromptContent = SYSTEM_PROMPT_TEMPLATE_STRING.replace(
      '{trace_summary}',
      traceSummary
    );
    let initialMessages = [...state.messages];
    if (initialMessages.length === 0 || initialMessages[0]._getType() !== 'system') {
      initialMessages = [new SystemMessage(systemPromptContent), ...initialMessages];
    } else {
      (initialMessages[0] as SystemMessage).content = systemPromptContent; // Update if already exists
    }
    return { profileArrayBuffer, profileData, traceSummary, messages: initialMessages };
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
  // Create a mutable copy of llmStreamingActive and currentToolName for callbacks
  // as state object might be immutable within this specific call if passed around by LangGraph.
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
        // Note: Tool output itself is handled by the graph. This callback is for signalling.
        // If the output string *itself* is an error message from the tool, we can signal tool_error here.
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
        // Determine tool name carefully if direct `name` param is not in this specific signature
        const toolNameForEvent = callbackState.currentToolName || 'unknown_tool_error'; // Fallback to active tool
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

  let messagesForLLM = [...state.messages];
  const lastMessage = state.messages[state.messages.length - 1];

  if (lastMessage instanceof ToolMessage && lastMessage.name === 'generate_flamegraph_screenshot') {
    try {
      const toolOutput = JSON.parse(lastMessage.content as string);
      if (toolOutput.status === 'Success' && toolOutput.outputPath) {
        console.log(
          `[Graph AgentNode] Detected successful screenshot tool output with outputPath: ${toolOutput.outputPath}`
        );
        messagesForLLM.push(
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
      } else if (toolOutput.status === 'Success' && toolOutput.publicUrl) {
        console.log(
          `[Graph AgentNode] Detected successful screenshot tool output with publicUrl: ${toolOutput.publicUrl}`
        );
        messagesForLLM.push(
          new HumanMessage(
            toolOutput.message ||
              `Screenshot generated. You can view it at: ${toolOutput.publicUrl}. Please analyze based on this URL.`
          )
        );
      } else {
        console.log(
          `[Graph AgentNode] Screenshot tool did not return usable image data (status: ${toolOutput.status}).`
        );
        // Potentially add a message like "Tool execution finished, but no image was provided in the expected format."
        // For now, the LLM will see the JSON output of the tool.
      }
    } catch (e) {
      console.error(
        '[Graph AgentNode] Error parsing screenshot tool output for image handling:',
        e
      );
      // LLM will see the raw JSON output if parsing fails.
    }
  }

  // Ensure System Message is first if not already
  // initialSetupNode should already do this, but as a safeguard or if flow changes:
  if (messagesForLLM.length === 0 || messagesForLLM[0]._getType() !== 'system') {
    const systemPromptContent = SYSTEM_PROMPT_TEMPLATE_STRING.replace(
      '{trace_summary}',
      state.traceSummary
    );
    messagesForLLM = [
      new SystemMessage(systemPromptContent),
      ...messagesForLLM.filter((m) => m._getType() !== 'system'),
    ];
  } else if (messagesForLLM[0]._getType() === 'system') {
    // Ensure summary is up-to-date in existing system message
    (messagesForLLM[0] as SystemMessage).content = SYSTEM_PROMPT_TEMPLATE_STRING.replace(
      '{trace_summary}',
      state.traceSummary
    );
  }

  const modelWithTools = llm.bindTools(messagesForLLM);

  // For LCEL chains with agent_scratchpad, you typically use an agent executor structure.
  // Here, we are more directly invoking the LLM with tools.
  // The `agent_scratchpad` placeholder might be less relevant unless replicating AgentExecutor logic.
  // OpenAI tools calling typically expects a sequence of messages.
  // We pass all `messagesForLLM` as the history. The last message is the current human input or tool response.

  // The agent needs the entire message history formatted correctly.
  // If messagesForLLM is the complete history, it can be passed directly.
  const response = await modelWithTools.invoke(messagesForLLM, { callbacks: langChainCallbacks });

  return {
    messages: [...state.messages, response],
    llmStreamingActiveForCurrentSegment: callbackState.llmStreamingActiveForCurrentSegment,
    currentToolName: callbackState.currentToolName,
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
      state.flamechartServerUrl,
      state.profileArrayBuffer!,
      state.userId,
      state.traceId
    ),
  ];

  // Similar to agentNode, manage callback state for tool execution phase if needed
  let callbackState = {
    llmStreamingActiveForCurrentSegment: state.llmStreamingActiveForCurrentSegment,
    // currentToolName is more for LLM <-> Tool interaction, here we are just executing
  };

  for (const call of toolInvocations) {
    const toolInstance = tools.find((t) => t.name === call.name);
    if (toolInstance) {
      try {
        console.log(`[Graph ToolHandlerNode] Calling tool: ${call.name} with args:`, call.args);
        // Manually send tool_start via Realtime
        callbackState.llmStreamingActiveForCurrentSegment = false; // Reset before tool output
        await state.realtimeChannel.send({
          type: 'broadcast',
          event: 'ai_response',
          payload: {
            type: 'tool_start',
            toolName: call.name,
            message: `Executing tool: ${call.name}...`,
          },
        });

        const output = await toolInstance.invoke(call.args); // Assuming args are already parsed by LLM

        // Ensure tool_call_id is a string, fallback to new UUID if undefined
        const toolCallId = typeof call.id === 'string' ? call.id : crypto.randomUUID();
        toolResults.push(
          new ToolMessage({
            content: output as string,
            tool_call_id: toolCallId,
            name: call.name,
          })
        );
        console.log(
          `[Graph ToolHandlerNode] Tool ${call.name} output (first 100 chars): ${(output as string).substring(0, 100)}`
        );

        // Manually send tool_end or tool_error via Realtime
        let toolFailed = false;
        if (typeof output === 'string') {
          try {
            const parsedOutput = JSON.parse(output); // Assuming tools return JSON string
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
        if (!toolFailed) {
          // For now, a generic tool_end is implicit by the next LLM response.
          // Or send a simple text message via Realtime if needed:
          // await state.realtimeChannel.send({ type: 'broadcast', event: 'ai_response', payload: { type: 'tool_output_text', toolName: call.name, message: `Tool ${call.name} finished.` } });
        }
      } catch (e) {
        console.error(`[Graph ToolHandlerNode] Error executing tool ${call.name}:`, e);
        const errorMsg = e instanceof Error ? e.message : String(e);
        const toolCallId = typeof call.id === 'string' ? call.id : crypto.randomUUID();
        toolResults.push(
          new ToolMessage({
            content: `Error: ${errorMsg}`,
            tool_call_id: toolCallId,
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
      console.error(`[Graph ToolHandlerNode] Unknown tool called: ${call.name}`);
      const toolCallId = typeof call.id === 'string' ? call.id : crypto.randomUUID();
      toolResults.push(
        new ToolMessage({
          content: `Error: Unknown tool ${call.name}`,
          tool_call_id: toolCallId,
          name: call.name,
        })
      );
      await state.realtimeChannel.send({
        type: 'broadcast',
        event: 'ai_response',
        payload: { type: 'tool_error', toolName: call.name, message: 'Unknown tool called.' },
      });
    }
  }
  return {
    messages: [...state.messages, ...toolResults],
    llmStreamingActiveForCurrentSegment: callbackState.llmStreamingActiveForCurrentSegment, // Persist potential change
  };
}

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  supabaseAdmin: Annotation<null | SupabaseClient>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }), // Static after init
  realtimeChannel: Annotation<null | any>({ reducer: (x, y) => y ?? x, default: () => null }), // Static after init
  userId: Annotation<string | null>({ reducer: (x, y) => y ?? x, default: () => null }), // Static
  traceId: Annotation<string | null>({ reducer: (x, y) => y ?? x, default: () => null }), // Static
  profileArrayBuffer: Annotation<ArrayBuffer | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }), // Set by initialSetupNode
  profileData: Annotation<null | any>({ reducer: (x, y) => y ?? x, default: () => null }), // Set by initialSetupNode
  traceSummary: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }), // Set by initialSetupNode
  flamechartServerUrl: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }), // Static
  llmStreamingActiveForCurrentSegment: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  currentToolName: Annotation<string | null>({ reducer: (x, y) => y ?? x, default: () => null }),
  iterationCount: Annotation<number>({ reducer: (x, y) => (x ?? 0) + (y ?? 1), default: () => 0 }), // Increment per agent-tool cycle
  maxIterations: Annotation<number>({ reducer: (x, y) => y ?? x, default: () => 7 }),
});

const workflow = new StateGraph(AgentState)
  .addNode('initialSetup', initialSetupNode)
  .addNode('agent', agentNode)
  .addNode('toolHandler', toolHandlerNode)
  .addEdge('__start__', 'initialSetup')
  .addEdge('initialSetup', 'agent')
  .addEdge('agent', 'toolHandler')
  .addEdge('toolHandler', 'agent');

workflow.addConditionalEdges(
  'agent',
  (state: AgentState) => {
    const lastMessage = state.messages[state.messages.length - 1];
    if (
      lastMessage._getType() === 'ai' &&
      (lastMessage as AIMessage).tool_calls &&
      (lastMessage as AIMessage).tool_calls!.length > 0
    ) {
      console.log('[Graph Router] Agent called tools. Routing to toolHandler.');
      return 'toolHandler';
    }
    if (state.iterationCount >= state.maxIterations) {
      console.log('[Graph Router] Max iterations reached. Ending.');
      return END;
    }
    if (
      typeof lastMessage.content === 'string' &&
      (lastMessage.content.toLowerCase().includes('bottleneck identified') ||
        lastMessage.content.toLowerCase().includes('analysis complete'))
    ) {
      console.log('[Graph Router] AI indicated analysis complete. Ending.');
      return END;
    }
    console.log(
      '[Graph Router] No tool calls from AI, or stopping condition not met by AI text. Ending current turn/loop.'
    );
    return END; // End the current processing loop. New user input would start a new graph invocation.
  },
  {
    toolHandler: 'toolHandler',
    [END]: END,
  }
);
workflow.addEdge('toolHandler', 'agent'); // Loop back to agent after tools execute

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
    // Subscribe might be async and needs to complete before sending.
    // Using a try/catch for subscribe is good practice.
    await new Promise((resolve, reject) => {
      realtimeChannel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to channel for user ${userId}`);
          resolve(status);
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
      traceSummary: '', // Will be populated by initialSetupNode
      flamechartServerUrl: FLAMECHART_SERVER_URL!,
      llmStreamingActiveForCurrentSegment: false,
      currentToolName: null,
      iterationCount: 0, // Start at 0, first agent call will be iteration 1 due to +1 in channel def
      maxIterations: 7,
    };

    console.log('[Graph Main] Invoking LangGraph app stream...');
    const stream = await app.stream(initialState, { recursionLimit: 25 }); // recursionLimit for safety

    for await (const event of stream) {
      // console.log("[Graph Stream Event]", JSON.stringify(event, null, 2)); // For debugging graph flow
      if (event[END] !== undefined) {
        // Check if the END sentinel is a key in the event chunk
        console.log('[Graph Stream] Reached END state in graph execution stream.');
        // The final AI message is already in event[END].messages if END is the last node's output
      }
    }

    console.log('[Graph Main] LangGraph app stream finished.');
    // Ensure final "end" message is sent after all processing
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
    // Attempt to send error over Realtime, but channel might be issue if subscribe failed.
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
