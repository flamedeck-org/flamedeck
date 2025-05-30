import { createClient, type SupabaseClient } from '@supabase/supabase-js'; // Changed to npm import
import { type Database } from '@flamedeck/supabase-integration'; // Import generated DB types

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

// Langfuse import
import { CallbackHandler } from "langfuse-langchain";
import { Langfuse } from "langfuse"; // Added for fetching prompts

import * as fs from 'fs/promises'; // For file system operations
import * as path from 'path'; // For path manipulation
import { createImageHumanMessageFromToolResult } from './ai-message-utils'; // Updated import name
import { checkChatLimits, incrementChatCounter, sendChatLimitError, getUserChatLimitContext } from './chat-limits'; // Added getUserChatLimitContext
import { loadSystemPromptContent } from './system-prompt-loader'; // Import the new loader

console.log('[Node AI Processor] Module initialized.'); // Changed log message

// Environment Variables - use process.env for Node.js
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_PRIVATE_KEY = process.env.LANGFUSE_PRIVATE_KEY;
const LANGFUSE_HOST = process.env.LANGFUSE_HOST;

const MAX_HISTORY_LIMIT = 50; // Keep if used for fetching, or adjust based on plan

// --- LangGraph State Definition ---
interface AgentState {
  messages: BaseMessage[];
  supabaseAdmin: SupabaseClient;
  realtimeChannel: any; // SupabaseRealtimeChannel
  userId: string;
  traceId: string;
  sessionId: string;
  profileArrayBuffer: ArrayBuffer | null;
  profileData: any | null; // ProfileGroup type from speedscope-core
  traceSummary: string;
  llm: ChatOpenAI;
  modelName?: string;
  langfuseHandler?: CallbackHandler; // Added for Langfuse
  langfuseClient?: Langfuse; // Added for Langfuse prompt fetching

  // For managing LangChain streaming callbacks
  llmStreamingActiveForCurrentSegment: boolean;
  currentToolName: string | null;

  // Iteration control for the graph
  iterationCount: number;
  maxIterations: number;

  // For optimized session message limit checking
  chatMessagesPerSessionLimit: number | null;
  planName: string | null;
  sessionMessageLimitHitInGraph: boolean;
}

// --- LangGraph State Annotations (Add new fields) ---
const AgentStateAnnotations = Annotation.Root({
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
  maxIterations: Annotation<number>({ reducer: (x, y) => y ?? x, default: () => 7 }), // Default to 7, can be overridden
  sessionId: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),
  llm: Annotation<ChatOpenAI | null>({ reducer: (x, y) => y ?? x, default: () => null }),
  // New annotations for chat limits
  chatMessagesPerSessionLimit: Annotation<number | null>({ reducer: (x, y) => y ?? x, default: () => null }),
  planName: Annotation<string | null>({ reducer: (x, y) => y ?? x, default: () => null }),
  sessionMessageLimitHitInGraph: Annotation<boolean>({ reducer: (x, y) => y, default: () => false }),
  langfuseHandler: Annotation<CallbackHandler | null>({ reducer: (x, y) => y ?? x, default: () => null }), // Added for Langfuse
  langfuseClient: Annotation<Langfuse | undefined>({ reducer: (x, y) => y ?? x, default: () => undefined }), // Added for Langfuse prompt fetching
});

// --- LangGraph Nodes ---

async function initialSetupNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Node AI Processor - SetupNode] Starting initial setup...');
  const { supabaseAdmin, traceId, realtimeChannel, langfuseClient } = state;
  let systemPromptContent: string;
  let traceSummaryForPrompt = ''; // Initialize with a default or empty string

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
    traceSummaryForPrompt = JSON.stringify(
      {
        name: profileData.name ?? 'N/A',
        profileType: loadedData.profileType ?? 'N/A',
        totalDurationMs: getDurationMsFromProfileGroup(profileData) ?? 'N/A',
      },
      null,
      2
    );

    console.log('[Node AI Processor - SetupNode] Profile loaded and parsed. Summary generated.');

    // Attempt to fetch prompt from Langfuse if client is available
    systemPromptContent = await loadSystemPromptContent({
      langfuseClient,
      traceSummary: traceSummaryForPrompt,
      realtimeChannel,
    });

    let updatedMessages = [...state.messages];

    if (updatedMessages.length === 0 || updatedMessages[0]._getType() !== 'system') {
      updatedMessages.unshift(new SystemMessage(systemPromptContent));
    }

    return { profileArrayBuffer, profileData, traceSummary: traceSummaryForPrompt, messages: updatedMessages };
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
  // *** SESSION MESSAGE LIMIT CHECK (IN-GRAPH) ***
  if (state.chatMessagesPerSessionLimit !== null) {
    const humanAndAIMessagesCount = state.messages.filter(
      (msg) => msg._getType() === 'human' || msg._getType() === 'ai'
    ).length;

    console.log(`[Node AI Processor - AgentNode] In-graph message check: Count=${humanAndAIMessagesCount}, Limit=${state.chatMessagesPerSessionLimit}`);

    if (humanAndAIMessagesCount > state.chatMessagesPerSessionLimit) {
      console.warn(`[Node AI Processor - AgentNode] Session message limit (${state.chatMessagesPerSessionLimit}) hit in-graph for session ${state.sessionId}. Current H/AI messages: ${humanAndAIMessagesCount}.`);
      sendChatLimitError(state.realtimeChannel, {
        error_code: 'limit_exceeded',
        limit_type: 'session_messages',
        message: `You have reached the message limit of ${state.chatMessagesPerSessionLimit} for this chat session on the ${state.planName || 'current'} plan.`
      });
      // Signal to END the graph by setting maxIterations effectively reached and a flag
      return { ...state, sessionMessageLimitHitInGraph: true, iterationCount: state.maxIterations + 1 };
    }
  }
  // *** END SESSION MESSAGE LIMIT CHECK (IN-GRAPH) ***

  console.log(
    `[Node AI Processor - AgentNode] Iteration ${state.iterationCount}. Calling LLM. Current messages count (all types): ${state.messages.length}`
  );
  const { llm } = state; // Get LLM from state
  if (!llm) {
    console.error(
      '[Node AI Processor - AgentNode] CRITICAL: state.llm is null. Aborting agent node.'
    );
    return { messages: state.messages, iterationCount: state.iterationCount + 1 };
  }

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

  if (state.langfuseHandler) {
    // Type assertion might be needed if CallbackHandler doesn't directly match CallbackHandlerMethods fully,
    // but typically langfuse-langchain's handler is compatible.
    langChainCallbacks.push(state.langfuseHandler as unknown as CallbackHandlerMethods);
    console.log('[Node AI Processor - AgentNode] Langfuse handler added to callbacks.');
  }

  // Construct messages for LLM invocation, inserting HumanMessage with image after its generating ToolMessage
  const messagesForLLMInvocation: BaseMessage[] = [];
  for (const originalMessage of state.messages) {
    if (
      originalMessage instanceof ToolMessage &&
      (originalMessage.name === 'generate_flamegraph_screenshot' ||
        originalMessage.name === 'generate_sandwich_flamegraph_screenshot') &&
      originalMessage.tool_call_id // Ensure there is a tool_call_id for safety
    ) {
      // This is the original ToolMessage from state.messages, potentially containing the full content (incl. base64)
      const toolOutput = originalMessage.content as unknown as FlamegraphSnapshotToolResponse;

      // Create the version of the ToolMessage for the LLM (text summary, no base64 in content string)
      const displayContent =
        toolOutput.status === 'success' || toolOutput.status === 'success_with_warning'
          ? `Successfully generated ${originalMessage.name === 'generate_sandwich_flamegraph_screenshot' ? 'sandwich ' : ''}flamegraph screenshot: ${toolOutput.publicUrl}`
          : `Failed to generate ${originalMessage.name === 'generate_sandwich_flamegraph_screenshot' ? 'sandwich ' : ''}flamegraph screenshot: ${toolOutput.message}`;

      messagesForLLMInvocation.push(
        new ToolMessage({
          tool_call_id: originalMessage.tool_call_id,
          content: displayContent,
          name: originalMessage.name,
        })
      );

      // Try to create and add the HumanMessage with the base64 image
      // The originalMessage (which is a ToolMessage) is passed here as it contains the full output including base64
      const imageHumanMessage = createImageHumanMessageFromToolResult(originalMessage);

      if (imageHumanMessage) {
        messagesForLLMInvocation.push(imageHumanMessage);
        console.log(
          '[Node AI Processor - AgentNode] Added HumanMessage with image for tool_call_id:',
          originalMessage.tool_call_id
        );
      }
    } else {
      // For all other messages, add them as they are.
      // If specific transformations are needed for other message types in the future,
      // they can be added here.
      messagesForLLMInvocation.push(originalMessage);
    }
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

            if (
              parsedOutput.status === 'success' ||
              parsedOutput.status === 'success_with_warning'
            ) {
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

              // Save the tool_result to the DB
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

              // Send the tool_result to the Realtime channel
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
              // Save the tool_error to the DB
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
              // Send the tool_error to the Realtime channel
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
        }
      } catch (e: any) {
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
    // Check if in-graph limit was hit
    if (state.sessionMessageLimitHitInGraph) {
      console.log('[Node AI Processor - Graph] Conditional edge: sessionMessageLimitHitInGraph is true, transitioning to END.');
      return END;
    }

    const lastMessage = state.messages[state.messages.length - 1];
    if (
      lastMessage?._getType() === 'ai' &&
      (lastMessage as AIMessage).tool_calls &&
      (lastMessage as AIMessage).tool_calls!.length > 0
    ) {
      return 'toolHandler';
    }
    if (state.iterationCount >= state.maxIterations) {
      console.log('[Node AI Processor - Graph] Conditional edge: Max iterations reached, transitioning to END.');
      return END;
    }
    if (
      lastMessage?.content &&
      typeof lastMessage.content === 'string' &&
      (lastMessage.content.toLowerCase().includes('bottleneck identified') || //This is probably too simple
        lastMessage.content.toLowerCase().includes('analysis complete'))
    ) {
      return END;
    }
    return END; // Default to END if no other path taken after checks
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
  modelName?: string; // ADDED: Optional model name from client
}

export async function processAiTurnLogic(payload: ProcessAiTurnPayload): Promise<void> {
  const { userId, prompt: userPrompt, traceId, sessionId, modelName: requestedModelName } = payload;

  const missingEnvVars: string[] = [];
  if (!OPENAI_API_KEY) missingEnvVars.push('OPENAI_API_KEY');
  if (!SUPABASE_URL) missingEnvVars.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missingEnvVars.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!LANGFUSE_PUBLIC_KEY) missingEnvVars.push('LANGFUSE_PUBLIC_KEY');
  if (!LANGFUSE_PRIVATE_KEY) missingEnvVars.push('LANGFUSE_PRIVATE_KEY');

  if (missingEnvVars.length > 0) {
    const filteredMissingVars = missingEnvVars.filter(v => !(v === 'LANGFUSE_PUBLIC_KEY' || v === 'LANGFUSE_PRIVATE_KEY'));
    if (filteredMissingVars.length > 0) {
      const errorMessage = `Missing critical environment variables: ${filteredMissingVars.join(', ')}. Langfuse keys are optional.`;
      console.error(`[Node AI Processor] ${errorMessage}`);
      // Only throw error if critical (non-Langfuse) keys are missing
      if (filteredMissingVars.some(key => key !== 'LANGFUSE_PUBLIC_KEY' && key !== 'LANGFUSE_PRIVATE_KEY')) {
        throw new Error(`Internal configuration error: ${errorMessage}`);
      }
    }
    if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_PRIVATE_KEY) {
      console.warn('[Node AI Processor] Langfuse Public or Private Key not found. Langfuse tracing will be disabled.');
    }
  }

  const modelToUse = requestedModelName || 'o4-mini';
  console.log(`[Node AI Processor] Using AI model: ${modelToUse}`);

  const llm = new ChatOpenAI({
    apiKey: OPENAI_API_KEY,
    modelName: modelToUse,
    streaming: true,
  });

  const supabaseAdmin = createClient<Database>(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const realtimeChannel = supabaseAdmin.channel(`private-chat-results-${userId}`);

  if (!realtimeChannel) {
    console.error('[Node AI Processor] Failed to initialize Realtime channel for user ${userId}');
    throw new Error('Failed to initialize Realtime channel');
  }

  let langfuseHandler: CallbackHandler | undefined = undefined;
  let langfuseClient: Langfuse | undefined = undefined;

  if (LANGFUSE_PUBLIC_KEY && LANGFUSE_PRIVATE_KEY) {
    try {
      const sharedOptions = {
        publicKey: LANGFUSE_PUBLIC_KEY,
        secretKey: LANGFUSE_PRIVATE_KEY,
        baseUrl: LANGFUSE_HOST,
      }
      langfuseHandler = new CallbackHandler({
        ...sharedOptions,
        sessionId: sessionId, // flamedeck's session id
        userId: userId,       // flamedeck's user id
      });
      console.log('[Node AI Processor] Langfuse callback handler initialized successfully.');

      // Initialize Langfuse client for fetching prompts if keys are available
      langfuseClient = new Langfuse({ ...sharedOptions });
      console.log('[Node AI Processor] Langfuse client for prompts initialized.');

    } catch (e: any) {
      console.error('[Node AI Processor] Failed to initialize Langfuse callback handler or client:', e.message);
      // langfuseHandler and langfuseClient remain undefined
    }
  } else {
    console.warn('[Node AI Processor] Langfuse Public Key or Secret Key not provided in environment variables. Langfuse tracing and prompt fetching will be disabled.');
  }

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

    // *** 1. INITIAL CHAT LIMIT CHECK (for new sessions, lifetime/monthly limits) ***
    console.log(`[Node AI Processor] Performing initial chat limit check for user ${userId}, session ${sessionId}`);
    const initialLimitError = await checkChatLimits(userId, traceId, sessionId, supabaseAdmin);
    if (initialLimitError) {
      console.log(`[Node AI Processor] User ${userId} hit initial chat limit: ${initialLimitError.limit_type || 'unknown'}`);
      sendChatLimitError(realtimeChannel, initialLimitError);
      if (realtimeChannel) await supabaseAdmin.removeChannel(realtimeChannel);
      return;
    }

    // *** 2. GET FULL LIMIT CONTEXT (ONCE PER TURN) ***
    const limitContext = await getUserChatLimitContext(userId, supabaseAdmin);
    if (!limitContext || !limitContext.plan || !limitContext.userProfile) {
      console.error(`[Node AI Processor] Failed to get limit context for user ${userId}. Aborting.`);
      sendChatLimitError(realtimeChannel, { error_code: 'config_error', message: 'Could not retrieve your plan details.' });
      if (realtimeChannel) await supabaseAdmin.removeChannel(realtimeChannel);
      return;
    }

    // *** 3. Insert the user prompt into the DB ***
    const { error: insertError } = await supabaseAdmin.from('chat_messages').insert({
      user_id: userId,
      trace_id: traceId,
      session_id: sessionId,
      sender: 'user',
      content_text: userPrompt,
    });

    if (insertError) {
      console.error('[Node AI Processor] Error saving user prompt to DB:', insertError);
      const dbErrorMsg = 'Failed to save your message to the database.';
      if (realtimeChannel) {
        try {
          await realtimeChannel.send({
            type: 'broadcast',
            event: 'ai_response',
            payload: { type: 'error', message: dbErrorMsg },
          });
        } catch (e) { }
      }
      if (realtimeChannel) await supabaseAdmin.removeChannel(realtimeChannel);
      throw new Error(`${dbErrorMsg} Details: ${insertError.message}`);
    }

    // *** 4. Fetch chat history (includes the new user prompt) ***
    const { data: dbHistory, error: fetchHistoryError } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('trace_id', traceId)
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(MAX_HISTORY_LIMIT);

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
        } catch (e) { }
      }
      if (realtimeChannel) await supabaseAdmin.removeChannel(realtimeChannel);
      throw new Error(`${dbErrorMsg} Details: ${fetchHistoryError.message}`);
    }

    console.log("DB HISTORY LENGTH", dbHistory.length);
    console.log("DB HISTORY FIRST SENDER", dbHistory[0].sender);
    console.log("DB HISTORY FIRST CONTENT TEXT", dbHistory[0].content_text);

    // Determine if this is the first message of this session based on the fetched history
    const isFirstMessageOfSession = dbHistory.length === 1 &&
      dbHistory[0].sender === 'user' &&
      dbHistory[0].content_text === userPrompt;

    const langChainMessages: BaseMessage[] = [];
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
            const toolCalls = (dbMsg.tool_calls_json as any[]).map((tc) => ({
              name: tc.name,
              args: tc.args,
              id: tc.id,
              type: tc.type,
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
            if (
              (dbMsg.tool_name === 'generate_flamegraph_screenshot' ||
                dbMsg.tool_name === 'generate_sandwich_flamegraph_screenshot') &&
              dbMsg.content_image_url
            ) {
              // Serialize the core snapshot info into a JSON string for the ToolMessage content
              const toolContent = JSON.stringify({
                status: dbMsg.tool_status,
                publicUrl: dbMsg.content_image_url,
                // base64Image is intentionally omitted here as it's not part of the persistent ToolMessage content for the LLM
                message: dbMsg.content_text,
              });
              langChainMessages.push(
                new ToolMessage({
                  content: toolContent, // Now a string
                  name: dbMsg.tool_name,
                  tool_call_id: dbMsg.tool_call_id,
                })
              );
            } else {
              langChainMessages.push(
                new ToolMessage({
                  content: dbMsg.content_text,
                  name: dbMsg.tool_name,
                  tool_call_id: dbMsg.tool_call_id,
                })
              );
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
      llm,
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
      maxIterations: 10,
      chatMessagesPerSessionLimit: limitContext.plan.chat_messages_per_session,
      planName: limitContext.plan.name,
      sessionMessageLimitHitInGraph: false,
      modelName: requestedModelName,
      langfuseHandler: langfuseHandler, // Pass initialized handler
      langfuseClient: langfuseClient, // Pass initialized client
    };

    console.log(`[Node AI Processor] Initializing graph with chatMessagesPerSessionLimit: ${initialState.chatMessagesPerSessionLimit}`);
    const stream = await app.stream(initialState, { recursionLimit: 25 });

    for await (const event of stream) {
      if (event[END] !== undefined) {
        console.log(
          '[Node AI Processor - Graph Stream] Reached END state in graph execution stream.'
        );
      }
    }

    // *** 5. CHAT COUNTER INCREMENT (after successful first message processing) ***
    if (isFirstMessageOfSession) {
      console.log(`[Node AI Processor] Attempting to increment session/analysis counter for user ${userId}, session ${sessionId}`);
      await incrementChatCounter(userId, traceId, sessionId, true, supabaseAdmin);
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
      console.warn(
        `[Node AI Processor] Failed to send critical error over Realtime channel:`,
        rtError
      );
    }
    throw error;
  } finally {
    if (realtimeChannel) {
      console.log(`[Node AI Processor] Ensuring Realtime channel removal for user ${userId}`);
      await supabaseAdmin.removeChannel(realtimeChannel);
    }
  }
}
