# Chat Architecture Overview

This document outlines the architecture of the AI Trace Analysis chat feature.

## Goal

To provide an interactive chat interface where users can ask questions about a loaded performance trace file and receive insights from an AI language model (e.g., GPT-4o), leveraging context from the trace file itself, including visual context from flamegraph snapshots, and allowing the AI to request specific data retrieval actions (tools).

## Key Architectural Decisions & Solutions

- **Processing Backend:** Core AI processing (LangGraph, LLM interactions, tool execution) is handled by a dedicated Node.js server (`apps/flamechart-server`) to overcome Supabase Edge Function timeouts and resource limits.
- **WebSocket Handling:** The `trace-analysis-socket` Supabase Edge Function acts as a lightweight WebSocket handler, primarily forwarding client requests to the `flamechart-server`.
- **Chat History Persistence:**
  - Conversation history (user prompts, AI responses, tool interactions) is stored in a `chat_messages` table in the Supabase database.
  - The `flamechart-server` (`ai-processor.ts`) is responsible for saving all message types to this table and fetching history from it to provide context to the LLM.
- **Client-Side Session Management:**
  - The client (`apps/client/src/components/Chat/ChatContainer.tsx`) generates a unique `sessionId` when a chat window is opened for a trace (for that browser session).
  - This `sessionId` is passed with every request through the WebSocket to `trace-analysis-socket`, then to `flamechart-server`.
  - The `flamechart-server` uses this `sessionId` to scope database operations (inserts and selects) for `chat_messages`, ensuring conversations are isolated per session.
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
  - Supabase Realtime is used for streaming responses. The `ai-processor.ts` module (on `flamechart-server`) establishes the Realtime channel and streams LLM token chunks and tool events to the client.
- **Debugging:**
  - `agentNode` (on `flamechart-server`) has the capability to save the exact messages being sent to the LLM to local JSON files for debugging purposes.

## Database Schema for Chat

A `chat_messages` table in Supabase stores the conversation:

- `id` (PK), `trace_id` (FK), `user_id` (FK), `session_id` (UUID, groups messages for a session).
- `created_at`, `sender` ('user', 'model', 'tool_request', 'tool_result', 'tool_error', 'system_event').
- `content_text`, `content_image_url` (for public URL of snapshot images).
- `tool_name`, `tool_call_id`, `tool_args_json`, `tool_status`.
- RLS policies ensure users can only access their own messages.

## Components

1.  **Client-Side UI (`apps/client/src/components/Chat/`)**

    - `ChatContainer.tsx`:
      - Manages WebSocket connection and Supabase Realtime subscription.
      - Generates and manages `sessionId` for the current chat interaction.
      - On chat open, fetches initial chat history for the current `sessionId` from the DB via `chatHistory.ts`.
      - Sends `start_analysis` and `user_prompt` messages (now including `sessionId` but _no history array_) via WebSocket.
      - Receives Realtime messages (AI stream, tool events) for live UI updates.
      - Optimistically adds new user messages to its local state.
    - `ChatWindow.tsx` & `ToolMessageItem.tsx`: Render messages, including special UI for tool calls (collapsible, status icons, image display via fetched object URL).

2.  **Client-Side API (`apps/client/src/lib/api/chatHistory.ts`)**

    - Contains `fetchChatHistory(userId, traceId, sessionId, limit)` function to query the `chat_messages` table.

3.  **WebSocket Handler (`supabase/functions/trace-analysis-socket/index.ts`)**

    - Manages WebSocket connections.
    - Receives `start_analysis` (with `userId`, `traceId`, `sessionId`) and `user_prompt` (with `userId`, `traceId`, `prompt`, `sessionId`) messages.
    - **Forwards these requests as HTTP POST to `/api/v1/ai/process-turn` on `apps/flamechart-server`**, including `sessionId` in the payload. No longer forwards client-side `history`.
    - Secured with an `X-Internal-Auth-Token`.
    - Sends WebSocket acks (`connection_ack`, `waiting_for_model`) to the client.

4.  **AI Processor (`apps/flamechart-server/src/ai-processor.ts` and related modules)**

    - Express.js route handler (`POST /api/v1/ai/process-turn`) on `flamechart-server`.
    - Authenticates request from `trace-analysis-socket`.
    - **`processAiTurnLogic` function:**
      - Saves the incoming user prompt to `chat_messages` table with `userId`, `traceId`, `sessionId`.
      - Fetches existing chat history for the current `userId`, `traceId`, and `sessionId` from `chat_messages`.
      - Maps DB history to Langchain `BaseMessage` objects.
      - Initializes `AgentState` for LangGraph (including `sessionId`, DB-fetched messages).
      - Establishes Supabase Realtime channel for this `userId`.
      - Invokes the LangGraph (`app.stream()`).
    - **LangGraph Nodes (running in Node.js):**
      - `initialSetupNode`: Fetches trace file from Supabase Storage, parses (using local `profile-loader.ts`), generates summary, prepares `SystemMessage`.
      - `agentNode`:
        - Interacts with LLM.
        - If the previous step was a successful `generate_flamegraph_screenshot` `ToolMessage`, temporarily constructs a `HumanMessage` with the base64 image and an explicit instruction for the AI to analyze it. This temporary message is _only_ for the immediate LLM call.
        - Saves the LLM's `AIMessage` (textual response or tool requests) to `chat_messages` table with `sessionId`. If tool requests are made, saves `tool_request` entries to DB.
        - Uses LangChain callbacks to stream LLM responses via Realtime.
      - `toolHandlerNode`:
        - Instantiates and executes tools (e.g., `TopFunctionsTool`, `GenerateFlamegraphSnapshotTool`).
        - `GenerateFlamegraphSnapshotTool` now renders flamegraphs locally.
        - Saves `tool_result` or `tool_error` messages to `chat_messages` table with `sessionId`.
        - Sends `tool_start`, `tool_result`, `tool_error` events to client via Realtime.
    - After graph completion, sends `model_response_end` via Realtime and cleans up channel.
    - Environment variables needed: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PROCESS_AI_TURN_SECRET`.

5.  **Profile Loader (`apps/flamechart-server/src/profile-loader.ts`)**

    - Contains `parseProfileBuffer` for trace file processing within `flamechart-server`.

6.  **Tools (`apps/flamechart-server/src/trace-tools.ts`)**

    - Defines `TopFunctionsTool` and `GenerateFlamegraphSnapshotTool`.
    - `GenerateFlamegraphSnapshotTool` renders locally, uploads to Storage, returns JSON with `status`, `publicUrl`, `base64Image`, `message`.

7.  **Flamechart Server (`apps/flamechart-server`)**

    - Hosts AI processing at `/api/v1/ai/process-turn` and the PNG rendering at `/api/v1/render`.

8.  **Supabase Storage (Bucket: `ai-snapshots`)**
    - Stores PNG snapshots.

## Data Flow Example (User Prompt with Snapshot Request - Updated Architecture)

1.  User opens chat for a trace. Client (`ChatContainer.tsx`) generates a `sessionId`. Fetches history for this `(userId, traceId, sessionId)` from DB (initially empty or contains past messages for this session).
2.  User types a prompt (e.g., "Show me a snapshot of the busiest part"). Client sends `user_prompt` message via WebSocket to `trace-analysis-socket`, including `userId`, `traceId`, current `prompt`, and `sessionId`.
3.  `trace-analysis-socket` (Edge Function) validates and forwards this as an HTTP POST to `apps/flamechart-server` (`/api/v1/ai/process-turn`) with the same payload and `X-Internal-Auth-Token`. Sends `waiting_for_model` ack to client.
4.  `apps/flamechart-server` (`/api/v1/ai/process-turn` endpoint):
    a. Authenticates request.
    b. **Saves the user's prompt** to `chat_messages` table with the `sessionId`.
    c. **Fetches chat history** (including the just-saved prompt) for the current `userId`, `traceId`, `sessionId` from `chat_messages`.
    d. Initializes `AgentState` with this history and other context (like `sessionId`). Establishes Realtime channel.
    e. Invokes LangGraph application.
5.  **Graph Execution (on `apps/flamechart-server`):**
    a. `initialSetupNode`: (May re-verify trace summary or just pass through if profile already loaded for session).
    b. `agentNode`: Receives history (including user's prompt). LLM processes it and decides to call `GenerateFlamegraphSnapshotTool`.
    i. **Saves AI's decision** (AIMessage with `tool_calls`) and the `tool_request` details to `chat_messages` table.
    c. `toolHandlerNode` (due to `tool_calls`):
    i. Sends `tool_start` event to client via Realtime.
    ii. Executes `GenerateFlamegraphSnapshotTool` locally.
    iii. Tool processes profile, renders PNG, uploads to Storage, returns JSON (`{status, publicUrl, base64Image, message}`).
    iv. **Saves `tool_result`** (with `publicUrl`, tool's message, status) to `chat_messages` table.
    v. Sends `tool_result` event (with `publicUrl`, tool's message, status) to client via Realtime.
    vi. Adds the `ToolMessage` (containing the JSON output) to the persistent graph state (`state.messages`).
    d. `agentNode` (re-invoked with history now including the `ToolMessage`):
    i. Detects the successful `ToolMessage` from `GenerateFlamegraphSnapshotTool`.
    ii. _Temporarily_ constructs a `HumanMessage` with the `base64Image` and an instruction to "analyze this image and describe your findings."
    iii. Calls LLM with current history + this temporary image message.
    iv. LLM formulates a textual response analyzing the image.
    v. `handleLLMNewToken` callback streams this textual AI response (`model_chunk_start/append`) to client via Realtime.
    vi. **Saves the AI's textual analysis** (`AIMessage` content) to `chat_messages` table.
    e. `agentNode` -> `END`.
6.  Client UI (`ChatWindow.tsx` & `ToolMessageItem.tsx`):
    a. Displays "Tool running..." message on `tool_start`.
    b. On `tool_result`, updates the tool message to "Success," displays the tool's textual message (`parsedOutput.message`), and if `imageUrl` is present, `ToolMessageItem` fetches and displays the image from Supabase storage using the `publicUrl`.
    c. Displays the streamed textual AI response analyzing the image.
7.  After graph execution finishes, `ai-processor.ts` sends `model_response_end` via Realtime.
