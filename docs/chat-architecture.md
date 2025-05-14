# Chat Architecture Overview

This document outlines the architecture of the AI Trace Analysis chat feature.

## Goal

To provide an interactive chat interface where users can ask questions about a loaded performance trace file and receive insights from an AI language model (e.g., GPT-4o), leveraging context from the trace file itself, including visual context from flamegraph snapshots, and allowing the AI to request specific data retrieval actions (tools).

## Key Constraints & Solutions

- **Supabase Edge Function Timeouts & Resource Limits:** Supabase Edge Functions have execution time limits and resource constraints (like CPU time) that can be restrictive for long-running AI model processing and complex LangGraph workflows.
  - **Solution:** The core AI processing logic (LangGraph, LLM interactions, tool execution) has been moved from a Supabase Edge Function to a dedicated Node.js server (`apps/flamechart-server`). The `trace-analysis-socket` Supabase Edge Function now acts as a lightweight WebSocket handler that forwards requests to this Node.js server.
- **Large Trace Files & Context Limits:** Trace files are often too large for LLM context windows.
  - **Solution:** The backend (now the `ai-processor.ts` module within `apps/flamechart-server`) fetches the file from Supabase Storage. An `initialSetupNode` in a LangGraph workflow parses it, generates a concise summary, and includes this in the `SystemMessage`.
- **Tool Execution & Context:** The AI needs to request specific data (e.g., top functions, flamegraph snapshot) and also _see_ the snapshots.
  - **Solution (Server-side Tools within LangGraph on Node.js server):**
    - Tools (like `TopFunctionsTool` and `GenerateFlamegraphSnapshotTool`) are defined as Langchain `StructuredTool` classes in `apps/flamechart-server/src/trace-tools.ts`, using Zod for input schema validation.
    - A `toolHandlerNode` in the LangGraph workflow (running on `apps/flamechart-server`) instantiates and executes these tools when requested by the `agentNode` (LLM).
    - **For `GenerateFlamegraphSnapshotTool` (Now Renders Locally):**
      1. The `agentNode` (LLM) decides to call the tool.
      2. The `toolHandlerNode` executes the tool's `_call` method. This method:
         a. **Directly processes** the `profileArrayBuffer` (gzipped or plain). It uses `pako` to decompress if needed, then `importProfileGroupFromText` to parse the profile data.
         b. **Locally renders** the flamegraph to a PNG buffer using the `renderToPng` function from `@flamedeck/flamechart-to-png` with specified rendering options.
         c. Encodes the PNG buffer to a base64 string (`base64Image`).
         d. Uploads the original PNG buffer to Supabase Storage (e.g., `ai-snapshots/<userId>/<filename>.png`).
         e. Gets the public URL of the uploaded PNG from Supabase Storage.
         f. The tool returns a **JSON string** to the `toolHandlerNode` containing `{ status: 'Success', publicUrl: '...', base64Image: '...', message: 'Snapshot taken' }`.
      3. The `toolHandlerNode` wraps this JSON string in a `ToolMessage`.
    - **Image Handling for LLM Context:** (This part remains conceptually similar but occurs on the Node.js server)
      1. After the `toolHandlerNode` provides the `ToolMessage`, the `agentNode` is invoked again.
      2. If the `ToolMessage` indicates a successful snapshot with `base64Image` data, the `agentNode` constructs a new `HumanMessage`. This message includes an image part (e.g., `{type: 'image_url', image_url: {url: 'data:image/png;base64,...'}}`) using the `base64Image` data.
      3. This `HumanMessage` (with the embedded image) is included in the messages passed to the LLM for its next reasoning step.
- **Real-time Updates:** Users need asynchronous AI responses.
  - **Solution:** Supabase Realtime is used. The `ai-processor.ts` module in `apps/flamechart-server` now establishes the Realtime channel and uses Langchain `callbacks` within its `agentNode` (specifically `handleLLMNewToken`) to stream LLM token chunks. The `toolHandlerNode` (also in `ai-processor.ts`) sends `tool_start` and `tool_error` events via this Realtime channel.

## Components

1.  **Client-Side UI (`apps/client/src/components/Chat/`)**

    - (No major changes to its described role: manages WebSocket, sends prompts, receives Realtime stream and WebSocket acks/errors, renders UI.)

2.  **WebSocket Hook (`apps/client/src/hooks/useTraceAnalysisSocket.ts`)**

    - (No major changes to its described role: manages raw WebSocket lifecycle.)

3.  **WebSocket Handler (`supabase/functions/trace-analysis-socket/index.ts`)**

    - Manages WebSocket connections.
    - Receives `start_analysis` and `user_prompt` messages from the client.
    - **On `start_analysis` / `user_prompt`:**
      - Makes an **HTTP POST request** to the `/api/v1/ai/process-turn` endpoint on the `apps/flamechart-server`.
      - The request payload includes `userId`, `traceId`, `prompt`, and `history`.
      - This call is secured using a shared secret (`PROCESS_AI_TURN_SECRET`) passed in an `X-Internal-Auth-Token` header.
      - Expects an immediate acknowledgment (e.g., HTTP 202 Accepted) from the `flamechart-server`.
    - Sends WebSocket acks to the client (e.g., `connection_ack`, `waiting_for_model`).
    - No longer handles `snapshot_result` messages; this flow is obsolete.

4.  **AI Processor (Now `apps/flamechart-server/src/ai-processor.ts` and related modules)**

    - An Express.js route handler (e.g., `POST /api/v1/ai/process-turn`) on the `apps/flamechart-server` receives requests from the `trace-analysis-socket` function.
    - **Initializes and runs a LangGraph workflow (Node.js environment):**
      - **State Definition**: Same `AgentState` structure as before.
      - **Nodes** (largely the same logic, but running in Node.js):
        - `initialSetupNode`: Fetches trace from Supabase Storage, parses (using `profile-loader.ts` now within `flamechart-server`), generates summary, prepares `SystemMessage`.
        - `agentNode`: Interacts with LLM, handles image messages (from local snapshot tool), uses LangChain callbacks to stream responses and events via Supabase Realtime (channel established by this Node.js process).
        - `toolHandlerNode`: Instantiates and executes tools (like `TopFunctionsTool`, `GenerateFlamegraphSnapshotTool` from `trace-tools.ts` now within `flamechart-server`). `GenerateFlamegraphSnapshotTool` now renders locally.
      - **Graph Flow (Edges)**: Same logic as before.
    - The Express handler initializes the `AgentState` (including `userId`, `traceId`, messages, Supabase admin client, and the Realtime channel) and invokes the compiled LangGraph using `app.stream()`.
    - After the graph stream completes, a final `model_response_end` message is sent via the Realtime channel.
    - This server is responsible for its own environment variables (`OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PROCESS_AI_TURN_SECRET`).

5.  **Shared Loader (`apps/flamechart-server/src/profile-loader.ts`)**

    - Contains `parseProfileBuffer` function.
    - Takes an `ArrayBuffer` and `fileName`, decompresses if needed (using `pako`), parses using `speedscope-import` with `ImporterDependencies` (including `pako`, `JSON_parse`, `Long`), returns `{ profileGroup, profileType }`. Runs in the Node.js environment of `flamechart-server`.

6.  **Shared Tools (`apps/flamechart-server/src/trace-tools.ts`)**

    - Defines Langchain `StructuredTool` classes (e.g., `TopFunctionsTool`, `GenerateFlamegraphSnapshotTool`). Runs in the Node.js environment.
    - `GenerateFlamegraphSnapshotTool`'s `_call` method now directly processes the profile buffer, renders the PNG using `renderToPng`, uploads to Supabase Storage, and returns details including `base64Image` and `publicUrl`.

7.  **Flamechart Server (`apps/flamechart-server`)**

    - This existing Node.js/Express server now hosts the primary AI processing logic at `/api/v1/ai/process-turn`.
    - It still provides its original HTTP API (`POST /api/v1/render`) for rendering profiles to PNG, which can be used by other services if needed (but is not used by `GenerateFlamegraphSnapshotTool` for AI snapshots anymore).

8.  **Supabase Storage (Bucket: `ai-snapshots`)**
    - (No change to its described role: stores PNG snapshots, RLS policies apply.)

## Data Flow Example (Snapshot Request - Updated Architecture)

1.  User asks a question requiring a visual (e.g., "Show me a snapshot").
2.  Client sends `user_prompt` (including history) via WebSocket to `trace-analysis-socket`.
3.  `trace-analysis-socket` (Supabase Edge Function):
    a. Receives the message.
    b. Sends an HTTP POST request to `apps/flamechart-server` at `/api/v1/ai/process-turn` with the payload (`userId`, `traceId`, `prompt`, `history`) and the `X-Internal-Auth-Token`.
    c. Receives an HTTP 202 Accepted (or similar) from `flamechart-server` and sends a `waiting_for_model` ack to the client via WebSocket.
4.  `apps/flamechart-server` (Node.js - `/api/v1/ai/process-turn` endpoint):
    a. Authenticates the request using the shared secret.
    b. Initializes `AgentState` (with `userId`, `traceId`, messages, Supabase admin client, and establishes a **Supabase Realtime channel** for this `userId`).
    c. Invokes the LangGraph application (`app.stream()`).
5.  **Graph Execution (on `apps/flamechart-server`):**
    a. `initialSetupNode`: Loads profile `ArrayBuffer` from storage, parses it into `profileData` (using local `profile-loader.ts`), generates `traceSummary`. Adds `SystemMessage` to state.messages.
    b. `agentNode`: LLM decides to call `GenerateFlamegraphSnapshotTool`.
    c. `toolHandlerNode` (due to `tool_calls`):
    i. Sends `tool_start` event to client via the Realtime channel.
    ii. Instantiates `GenerateFlamegraphSnapshotTool` (using `profileArrayBuffer`, `userId`, `traceId` from state).
    iii. Calls the tool. The tool: 1. Processes `profileArrayBuffer` (decompresses if needed). 2. Parses into `profileGroup` using `importProfileGroupFromText`. 3. Renders PNG locally using `renderToPng`. 4. Encodes to `base64Image`. 5. Uploads PNG to Supabase Storage, gets `publicUrl`. 6. Returns a JSON string: `{ "status": "Success", "publicUrl": "...", "base64Image": "...", "message": "Snapshot taken" }`.
    iv. `toolHandlerNode` creates a `ToolMessage` with this JSON string and updates state.messages.
    d. `agentNode` (re-invoked):
    i. Sees the `ToolMessage` from `GenerateFlamegraphSnapshotTool`.
    ii. Parses JSON. If `status` is 'Success' and `base64Image` is present, constructs a new `HumanMessage` with the `base64Image` data.
    iii. Adds this new `HumanMessage` to state.messages.
    iv. Calls LLM with all messages. LLM formulates response based on original request, summary, and the visual snapshot.
    v. `handleLLMNewToken` callback streams `model_chunk_start`/`model_chunk_append` messages to client via Realtime.
    e. `agentNode` -> `END`.
6.  Client receives and displays the streamed textual response from the Realtime channel.
7.  After graph execution finishes, `ai-processor.ts` (on `flamechart-server`) sends `model_response_end` via Realtime.
