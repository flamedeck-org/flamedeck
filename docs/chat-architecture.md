# Chat Architecture Overview

This document outlines the architecture of the AI Trace Analysis chat feature.

## Goal

To provide an interactive chat interface where users can ask questions about a loaded performance trace file and receive insights from an AI language model (e.g., GPT-4o), leveraging context from the trace file itself, including visual context from flamegraph snapshots, and allowing the AI to request specific data retrieval actions (tools). This feature also incorporates usage limits based on user subscription plans.

## Key Architectural Decisions & Solutions

- **Processing Backend:** Core AI processing (LangGraph, LLM interactions, tool execution, chat limit enforcement) is handled by a dedicated Node.js server (`apps/flamechart-server`) to overcome Supabase Edge Function timeouts and resource limits.
- **WebSocket Handling:** The `trace-analysis-socket` Supabase Edge Function acts as a lightweight WebSocket handler, primarily forwarding client requests to the `flamechart-server`.
- **Chat History Persistence:**
  - Conversation history (user prompts, AI responses, tool interactions) is stored in a `chat_messages` table in the Supabase database.
  - The `flamechart-server` (`ai-processor.ts`) is responsible for saving all message types to this table and fetching history from it to provide context to the LLM.
- **Client-Side Session Management:**
  - The client (`apps/client/src/components/Chat/ChatContainer.tsx`) generates a unique `sessionId` when a chat window is opened for a trace (for that browser session).
  - This `sessionId` is passed with every request through the WebSocket to `trace-analysis-socket`, then to `flamechart-server`.
  - The `flamechart-server` uses this `sessionId` to scope database operations (inserts and selects) for `chat_messages`, ensuring conversations are isolated per session.
- **Chat Usage Limits & Subscription Plans:**
  - The system enforces chat usage limits based on user subscription plans. These limits include:
    - Messages per chat session.
    - Total chat sessions initiated (lifetime for free users, monthly for paid plans).
  - These limits are defined in the `subscription_plans` table.
  - User-specific counters (`lifetime_chat_analyses_count` in `user_profiles`, `monthly_chat_sessions_count` in `user_subscriptions`) track usage.
  - A dedicated `chat-limits` module within `apps/flamechart-server` handles fetching limit data, checking against current usage, and incrementing counters.
  - The `ai-processor.ts` module coordinates these checks:
    - An initial comprehensive check is performed before processing a user's turn.
    - The relevant session message limit is stored in the LangGraph `AgentState`.
    - The `agentNode` performs an in-graph check against the message limit before each LLM call.
    - If limits are exceeded, an error is sent to the client, and further processing is halted.
- **Large Trace Files & LLM Context:**
  - The `ai-processor.ts` module (on `flamechart-server`) fetches the trace file from Supabase Storage.
  - An `initialSetupNode` in its LangGraph workflow parses the trace and generates a concise summary for the `SystemMessage`, optimizing LLM context usage.
- **Tool Execution & Visual Context (Flamegraphs):**
  - Tools (e.g., `TopFunctionsTool`, `GenerateFlamegraphSnapshotTool`) are Langchain `StructuredTool` classes in `apps/flamechart-server/src/trace-tools.ts`.
  - `GenerateFlamegraphSnapshotTool` now renders PNGs locally within the `flamechart-server` process using `renderToPng`.
  - **Image Handling for LLM:**
    1. `toolHandlerNode` (on `flamechart-server`) adds the `ToolMessage` (containing JSON with `publicUrl`, `base64Image`, and a textual message from the tool) to the persistent graph state (and saves a representation to the DB).
    2. `agentNode` (on `flamechart-server`), if the last message was a successful screenshot `ToolMessage`, _temporarily_ constructs a `HumanMessage`. This message includes:
       a. An explicit textual instruction for the AI to analyze the image and describe its findings.
       b. The `base64Image` data (e.g., `{type: 'image_url', image_url: {url: 'data:image/png;base64,...'}}`).
    3. This temporary `HumanMessage` is added to the messages passed to the LLM for _that specific turn only_ and is not persisted in the graph's message history itself.
    4. The AI's textual analysis of the image (part of its `AIMessage` response) _is_ saved to the persistent chat history in the database. This ensures only the most recent image is directly processed by the LLM as base64 per turn.
- **Real-time Updates:**
  - Supabase Realtime is used for streaming responses. The `ai-processor.ts` module (on `flamechart-server`) establishes the Realtime channel and streams LLM token chunks, tool events, and chat limit errors to the client.
- **Debugging:**
  - `agentNode` (on `flamechart-server`) has the capability to save the exact messages being sent to the LLM to local JSON files for debugging purposes.

## System Prompt Sourcing

- The system prompt provided to the LLM is dynamically fetched from Langfuse using `langfuse.getPrompt("analysis-system-prompt")`.
- This is handled by a dedicated module: `apps/flamechart-server/src/system-prompt-loader.ts`.
- Fetching the system prompt from Langfuse is a critical step. If it fails (e.g., due to configuration issues, network problems, or the prompt not existing in Langfuse), the AI analysis process for that turn will halt, and an error will be reported to the client. There is no hardcoded fallback for the system prompt.

## Database Schema for Chat & Limits

- **`chat_messages` Table:**
  - `id` (PK), `trace_id` (FK), `user_id` (FK), `session_id` (UUID, groups messages for a session).
  - `created_at`, `sender` ('user', 'model', 'tool_request', 'tool_result', 'tool_error', 'system_event').
  - `content_text`, `content_image_url` (for public URL of snapshot images).
  - `tool_name`, `tool_call_id`, `tool_args_json`, `tool_status`.
  - RLS policies ensure users can only access their own messages.

- **`subscription_plans` Table (Relevant Additions for Chat Limits):**
  - `chat_messages_per_session` (INTEGER): Max messages per chat session for this plan.
  - `chat_sessions_limit` (INTEGER): Max chat sessions allowed by this plan.
  - `chat_sessions_period` (TEXT): Period for `chat_sessions_limit` (e.g., 'lifetime', 'monthly').

- **`user_profiles` Table (Relevant Additions for Chat Limits):**
  - `lifetime_chat_analyses_count` (INTEGER, DEFAULT 0): Tracks total chat sessions initiated by a user under a lifetime-limited plan (e.g., free tier).

- **`user_subscriptions` Table (Relevant Additions for Chat Limits):**
  - `monthly_chat_sessions_count` (INTEGER, DEFAULT 0): Tracks chat sessions initiated by a user in the current billing period for plans with monthly limits.

- **Database Functions for Chat Limits:**
  - `increment_lifetime_chat_analyses(p_user_id UUID)`: Increments the lifetime session counter for a user.
  - `increment_monthly_chat_sessions(p_user_subscription_id UUID)`: Increments the monthly session counter for a user's subscription.
  - `reset_expired_monthly_limits()`: (Updated) Resets `monthly_chat_sessions_count` along with other monthly counters at the end of a billing period.

## Components

1.  **Client-Side UI (`apps/client/src/components/Chat/`)**

    - `ChatContainer.tsx`:
      - Manages WebSocket connection and Supabase Realtime subscription.
      - Generates and manages `sessionId` for the current chat interaction.
      - On chat open, fetches initial chat history for the current `sessionId` from the DB via `chatHistory.ts`.
      - Sends `start_analysis` and `user_prompt` messages (now including `sessionId` but _no history array_) via WebSocket.
      - Receives Realtime messages (AI stream, tool events, **chat limit errors**) for live UI updates.
      - Optimistically adds new user messages to its local state.
      - **Handles `chat_error` events from the backend to display limit messages and disable input if necessary.**
    - `ChatWindow.tsx` & `ToolMessageItem.tsx`: Render messages, including special UI for tool calls (collapsible, status icons, image display via fetched object URL) **and displays chat limit error messages and upgrade prompts.**

2.  **Client-Side API (`apps/client/src/lib/api/chatHistory.ts`)**

    - Contains `fetchChatHistory(userId, traceId, sessionId, limit)` function to query the `chat_messages` table.

3.  **WebSocket Handler (`supabase/functions/trace-analysis-socket/index.ts`)**

    - Manages WebSocket connections.
    - Receives `start_analysis` (with `userId`, `traceId`, `sessionId`) and `user_prompt` (with `userId`, `traceId`, `prompt`, `sessionId`) messages.
    - Reads `AI_ANALYSIS_MODEL` environment variable to determine the AI model to be used.
    - **Forwards these requests as HTTP POST to `/api/v1/ai/process-turn` on `apps/flamechart-server`**, including `sessionId` and the desired `modelName` in the payload. No longer forwards client-side `history`.
    - Secured with an `X-Internal-Auth-Token`.
    - Sends WebSocket acks (`connection_ack`, `waiting_for_model`) to the client.

4.  **AI Processor (`apps/flamechart-server/src/ai-processor.ts` and related modules)**

    - Express.js route handler (`POST /api/v1/ai/process-turn`) on `flamechart-server`.
    - Authenticates request from `trace-analysis-socket`.
    - **`processAiTurnLogic` function:**
      - **Chat Limit Enforcement (Initial):** Calls `checkChatLimits` from the `chat-limits` module at the beginning of a turn. If a limit (lifetime sessions, monthly sessions, or already over messages for session) is hit, sends an error to the client via Realtime and halts further processing for the turn.
      - Fetches full user limit context using `getUserChatLimitContext`.
      - Initializes `ChatOpenAI` (LLM client) using the provided `modelName`.
      - Saves the incoming user prompt to `chat_messages` table.
      - Fetches existing chat history.
      - Initializes `AgentState` for LangGraph, now including `chatMessagesPerSessionLimit` and `planName` from the fetched context.
      - Establishes Supabase Realtime channel.
      - Invokes the LangGraph (`app.stream()`).
      - **Chat Counter Increment:** If it was the first message of the session and no initial limits were hit, calls `incrementChatCounter` from the `chat-limits` module after successful graph processing for the turn.
    - **LangGraph `AgentState` (Relevant Additions):**
      - `chatMessagesPerSessionLimit` (number | null): The session message limit for the current user's plan.
      - `planName` (string | null): The name of the current user's plan.
      - `sessionMessageLimitHitInGraph` (boolean): Flag to indicate if the session message limit was hit during graph execution.
    - **LangGraph Nodes (running in Node.js):**
      - `initialSetupNode`: Fetches trace file from Supabase Storage, parses (using local `profile-loader.ts`), generates summary, prepares `SystemMessage`.
      - `agentNode`:
        - **In-Graph Session Message Check:** Before calling the LLM, checks the count of human/AI messages in `state.messages` against `state.chatMessagesPerSessionLimit`. If the limit is exceeded, sets `state.sessionMessageLimitHitInGraph = true`, sends a `chat_error` via Realtime, and the graph transitions to `END`. Client UI displays error, disables input.
        - Retrieves the `llm` instance from `AgentState`.
        - Interacts with LLM.
        - If the previous step was a successful `generate_flamegraph_screenshot` `ToolMessage`, temporarily constructs a `HumanMessage` with the base64 image and an explicit instruction for the AI to analyze it. This temporary message is _only_ for the immediate LLM call.
        - Saves the LLM's `AIMessage` (textual response or tool requests) to `chat_messages` table with `sessionId`. If tool requests are made, saves `tool_request` entries to DB.
        - Uses LangChain callbacks to stream LLM responses via Realtime.
      - `toolHandlerNode`:
        - Instantiates and executes tools (e.g., `TopFunctionsTool`, `GenerateFlamegraphSnapshotTool`).
        - `GenerateFlamegraphSnapshotTool` now renders flamegraphs locally.
        - Saves `tool_result` or `tool_error` messages to `chat_messages` table with `sessionId`.
        - Sends `tool_start`, `tool_result`, `tool_error` events to client via Realtime.
    - After graph completion (or early exit due to limits), sends appropriate messages (`model_response_end` or `chat_error`) via Realtime and cleans up the channel.
    - Environment variables needed: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PROCESS_AI_TURN_SECRET`.
    - Note: `AI_ANALYSIS_MODEL` is now read by `trace-analysis-socket`, not directly by `ai-processor`.
    - Langfuse Integration (Mandatory for system prompt fetching and optional for full observability tracing):
      - `LANGFUSE_PUBLIC_KEY`: Public key for Langfuse.
      - `LANGFUSE_PRIVATE_KEY`: Secret key for Langfuse.
      - `LANGFUSE_HOST`: The base URL for your Langfuse instance (e.g., "https://us.cloud.langfuse.com").
      - These keys and host are **required** for fetching the system prompt from Langfuse.
      - If provided, these will also be used by the `CallbackHandler` to trace Langchain operations for observability.

5.  **Chat Limits Module (`apps/flamechart-server/src/chat-limits/`)**
    - `chatLimitTypes.ts`: Defines types like `UserChatLimitContext`, `ChatErrorPayload`.
    - `chatLimitService.ts`:
      - `getUserChatLimitContext(userId, dbClient)`: Fetches user profile, active subscription, and plan details to determine applicable chat limits.
      - `checkChatLimits(userId, traceId, sessionId, dbClient)`: Performs comprehensive checks against all configured limits (session messages, lifetime sessions, monthly sessions) at the start of a turn.
      - `incrementChatCounter(userId, traceId, sessionId, isFirstMessageOfSession, dbClient)`: Calls RPC functions to increment `lifetime_chat_analyses_count` or `monthly_chat_sessions_count` based on the user's plan.
      - `sendChatLimitError(realtimeChannel, errorPayload)`: Helper to send formatted error messages to the client.

6.  **Profile Loader (`apps/flamechart-server/src/profile-loader.ts`)**

    - Contains `parseProfileBuffer` for trace file processing within `flamechart-server`.

7.  **Tools (`apps/flamechart-server/src/trace-tools.ts`)**

    - Defines `TopFunctionsTool` and `GenerateFlamegraphSnapshotTool`.
    - `GenerateFlamegraphSnapshotTool` renders locally, uploads to Storage, returns JSON with `status`, `publicUrl`, `base64Image`, `message`.

8.  **Flamechart Server (`apps/flamechart-server`)**

    - Hosts AI processing at `/api/v1/ai/process-turn` and the PNG rendering at `/api/v1/render`.

9.  **Supabase Storage (Bucket: `ai-snapshots`)**
    - Stores PNG snapshots.

## Data Flow Example (User Prompt - Considering Chat Limits)

1.  User types a prompt. Client sends `user_prompt` to `trace-analysis-socket`, then to `apps/flamechart-server` (`/api/v1/ai/process-turn`).
2.  `apps/flamechart-server` (`processAiTurnLogic`):
    a. Authenticates request.
    b. **Initial Limit Check:** Calls `checkChatLimits`. If a limit is hit (e.g., user is free and has used all 5 lifetime sessions), send `chat_error` to client and **STOP**. Client UI displays error and disables input.
    c. Fetches `limitContext` (plan details like messages per session).
    d. Saves user prompt to `chat_messages`.
    e. Fetches chat history (now including the new prompt).
    f. Initializes `AgentState` including `chatMessagesPerSessionLimit`.
    g. Invokes LangGraph.
3.  **Graph Execution (on `apps/flamechart-server`):**
    a. `initialSetupNode`:
        i. Loads trace profile (using local `profile-loader.ts`).
        ii. **Crucially, fetches the system prompt from Langfuse via `system-prompt-loader.ts`. If this fails, the process stops and an error is sent to the client.**
        iii. Generates a summary of the trace.
        iv. Prepares the initial `SystemMessage` using the fetched prompt and trace summary.
    b. `agentNode`:
        i. **In-Graph Message Limit Check:** Checks current human/AI message count in `state.messages` against `state.chatMessagesPerSessionLimit`. If over limit, send `chat_error` to client, set `sessionMessageLimitHitInGraph = true`, and graph proceeds to `END`. Client UI displays error, disables input.
        ii. If not over limit, LLM processes prompt + history.
        iii. Saves AI response/tool calls to `chat_messages`.
    c. (If tool call) `toolHandlerNode`: Executes tool, saves result to `chat_messages`.
    d. (If tool call) `agentNode` re-invoked:
        i. **In-Graph Message Limit Check again.**
        ii. LLM processes tool result.
        iii. Saves AI response to `chat_messages`.
4.  After graph completion (or early END due to limits):
    a. If `isFirstMessageOfSession` was true and no initial limits were hit, `incrementChatCounter` is called.
    b. `model_response_end` (or existing `chat_error`) is sent to client via Realtime.

This ensures limits are checked at appropriate stages and user experience is managed when limits are encountered.
