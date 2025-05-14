# Chat Architecture Overview

This document outlines the architecture of the AI Trace Analysis chat feature.

## Goal

To provide an interactive chat interface where users can ask questions about a loaded performance trace file and receive insights from an AI language model (e.g., GPT-4o), leveraging context from the trace file itself, including visual context from flamegraph snapshots, and allowing the AI to request specific data retrieval actions (tools).

## Key Constraints & Solutions

- **Edge Function Timeouts:** Supabase Edge Functions have execution time limits.
  - **Solution:** A two-function asynchronous architecture is used. `trace-analysis-socket` handles the WebSocket connection and triggers `process-ai-turn` asynchronously.
- **Large Trace Files & Context Limits:** Trace files are often too large for LLM context windows.
  - **Solution:** The backend (`process-ai-turn`) fetches the file from Supabase Storage. An `initialSetupNode` in a LangGraph workflow parses it, generates a concise summary, and includes this in the `SystemMessage`.
- **Tool Execution & Context:** The AI needs to request specific data (e.g., top functions, flamegraph snapshot) and also _see_ the snapshots.
  - **Solution (Server-side Tools within LangGraph):**
    - Tools (like `TopFunctionsTool` and `GenerateFlamegraphSnapshotTool`) are defined as Langchain `StructuredTool` classes in `supabase/functions/process-ai-turn/trace-tools.ts`, using Zod for input schema validation.
    - A `toolHandlerNode` in the LangGraph workflow instantiates and executes these tools when requested by the `agentNode` (LLM).
    - **For `GenerateFlamegraphSnapshotTool`:**
      1. The `agentNode` (LLM) decides to call the tool.
      2. The `toolHandlerNode` executes the tool's `_call` method. This method:
         a. Makes an HTTP POST request to the dedicated `flamechart-server` API (`/render`) with the profile data (sent as `text/plain` if the server expects that for an ArrayBuffer, or `application/octet-stream` if it expects binary) and rendering options.
         b. The `flamechart-server` returns a PNG image buffer.
         c. The tool encodes the PNG buffer to a base64 string (`base64Image`).
         d. It uploads the original PNG buffer to Supabase Storage (e.g., `ai-snapshots/<userId>/<filename>.png`).
         e. It gets the public URL of the uploaded PNG.
         f. The tool returns a **JSON string** to the `toolHandlerNode` containing `{ status: 'Success', publicUrl: '...', base64Image: '...', message: 'Snapshot taken' }`.
      3. The `toolHandlerNode` wraps this JSON string in a `ToolMessage`.
    - **Image Handling for LLM Context:**
      1. After the `toolHandlerNode` provides the `ToolMessage` (with the JSON string from `GenerateFlamegraphSnapshotTool`), the `agentNode` is invoked again.
      2. If the `ToolMessage` indicates a successful snapshot with `base64Image` data, the `agentNode` constructs a new `HumanMessage`. This message includes an image part (e.g., `{type: 'image_url', image_url: {url: 'data:image/png;base64,...'}}`) using the `base64Image` data, and potentially some guiding text.
      3. This `HumanMessage` (with the embedded image) is then included in the messages passed to the LLM for its next reasoning step, allowing the LLM to "see" the snapshot.
- **Statelessness:** Edge Functions are stateless but the LangGraph maintains state for the duration of its execution for a given request.
  - **Solution:** Context (`traceId`, `userId`, initial `history` and `prompt`) is used to initialize the LangGraph's state. Trace data is fetched from Storage within the graph.
- **Real-time Updates:** Users need asynchronous AI responses.
  - **Solution:** Supabase Realtime is used by `process-ai-turn`. Langchain `callbacks` within the `agentNode` (specifically `handleLLMNewToken`) are used to stream LLM token chunks. The `toolHandlerNode` sends `tool_start` and `tool_error` events.

## Components

1.  **Client-Side UI (`apps/client/src/components/Chat/`)**

    - `FloatingChatButton.tsx`: Toggles chat window visibility.
    - `ChatWindow.tsx`: Renders messages (including images via URL), input. Manages scroll state.
    - `ChatContainer.tsx`: Client orchestrator.
      - Manages WebSocket (`useTraceAnalysisSocket`) and Supabase Realtime connections.
      - Handles chat state (`isChatOpen`, `chatMessages`, etc.) and controls `ChatWindow`.
      - Sends `start_analysis` and `user_prompt` (which now includes chat history) via WebSocket.
      - Receives WebSocket acks/errors.
      - Receives Realtime messages for AI stream (`model_chunk_start/append/end`, `error`, `tool_start`, `tool_error`).
      - Renders images if an image URL is part of the AI's textual response.

2.  **WebSocket Hook (`apps/client/src/hooks/useTraceAnalysisSocket.ts`)**

    - Manages raw WebSocket lifecycle, message sending/receiving.

3.  **WebSocket Handler (`supabase/functions/trace-analysis-socket/index.ts`)**

    - Manages WebSocket connections.
    - Receives `start_analysis` and `user_prompt` messages.
    - On `start_analysis` / `user_prompt`: Invokes `process-ai-turn` asynchronously with the payload including `userId`, `traceId`, `prompt`, and `history`.
    - Sends WebSocket acks (`connection_ack`, `waiting_for_model`).

4.  **AI Processor (`supabase/functions/process-ai-turn/index.ts`)**

    - An Edge Function invoked asynchronously.
    - **Initializes and runs a LangGraph workflow:**
      - **State Definition**: The graph's state (`AgentState`) is defined using `Annotation.Root` and `Annotation<Type>()` for each property (e.g., `messages`, `profileData`, `traceSummary`, `supabaseAdmin`, `realtimeChannel`, `userId`, `traceId`, `profileArrayBuffer`, etc.). This provides a structured schema for the graph's memory.
      - **Nodes**:
        - `initialSetupNode`: Fetches the trace file from Supabase Storage (obtaining an `ArrayBuffer` and storing it in state). Uses the shared loader (`_shared/profile-loader.ts`) to parse the trace file (using `profileArrayBuffer` from state), generating `profileData` and `traceSummary` (stored in state). It also constructs the initial `SystemMessage` using the `traceSummary` and prepends it to the `messages` in the state.
        - `agentNode`:
          - Responsible for interacting with the LLM (`ChatOpenAI`, configured for streaming and bound with tools).
          - **Image Handling Logic**: If the last message in the state is a `ToolMessage` from a successful `generate_flamegraph_screenshot` call (identified by parsing its JSON content for `status: 'Success'` and `base64Image`), it constructs a new `HumanMessage`. This `HumanMessage` includes an image part using the `base64Image` data (e.g., `{type: 'image_url', image_url: {url: 'data:image/png;base64,...'}}`) and relevant textual context. This new message is added to the current list of messages for the LLM.
          - Invokes the LLM with the current message history from the state (which includes system prompt, user prompts, AI responses, prior tool messages, and potentially the new human message with the embedded image).
          - Uses LangChain `callbacks` (`handleLLMNewToken`, `handleToolStart`, `handleToolEnd`, `handleToolError` - though tool events are primarily handled by `toolHandlerNode`) to stream LLM responses and manage streaming state for the client via the Supabase Realtime channel (passed in state).
          - Outputs an `AIMessage` which might contain text content and/or `tool_calls`.
        - `toolHandlerNode`:
          - Invoked if the `agentNode`'s `AIMessage` output contains `tool_calls`.
          - It instantiates the required tools (`TopFunctionsTool`, `GenerateFlamegraphSnapshotTool`) using context from the current graph state (e.g., `profileData`, `profileArrayBuffer`, `supabaseAdmin`, `userId`, `traceId`).
          - Sends a `tool_start` message to the client via Realtime.
          - Executes the called tool(s) with arguments provided by the LLM.
          - Creates `ToolMessage`(s) containing the output from the tool(s). For `GenerateFlamegraphSnapshotTool`, this output is a JSON string including `status`, `publicUrl`, `base64Image`, and a message.
          - If the tool execution itself (not the tool's returned content) fails, or if the tool's returned JSON indicates an error status, it may send a `tool_error` message to the client via Realtime.
          - Adds the `ToolMessage`(s) to the `messages` in the state.
      - **Graph Flow (Edges)**:
        - Starts with `initialSetupNode`.
        - `initialSetupNode` transitions to `agentNode`.
        - `agentNode` has conditional edges: if `tool_calls` are present in its output AIMessage, it routes to `toolHandlerNode`; otherwise, or if stopping conditions met, it routes to `END`.
        - `toolHandlerNode` transitions back to `agentNode` for the LLM to process tool results.
    - The main `Deno.serve` handler receives the client request, sets up the initial state for the LangGraph (mapping client `history` and `userPrompt` to messages, and passing other necessary initial values like `userId`, `traceId`, `supabaseAdmin`, `realtimeChannel`), and invokes the compiled graph using `app.stream()`.
    - After the graph stream completes (all nodes have run to an `END` state), a final `model_response_end` message is sent via Realtime.

5.  **Shared Loader (`supabase/functions/_shared/profile-loader.ts`)**

    - Contains `parseProfileBuffer` function (renamed from `loadProfileData`).
    - Takes an `ArrayBuffer` (already downloaded profile data) and `fileName`, decompresses if needed, parses using `speedscope-import`, returns `{ profileGroup, profileType }`.

6.  **Shared Tools (`supabase/functions/process-ai-turn/trace-tools.ts`)**

    - Defines Langchain `StructuredTool` classes (e.g., `TopFunctionsTool`, `GenerateFlamegraphSnapshotTool`).
    - Each tool uses a Zod schema to define its expected input arguments.
    - The core logic for each tool is implemented in its `_call` method. For example, `GenerateFlamegraphSnapshotTool`'s `_call` method handles the interaction with the `flamechart-server` and Supabase Storage.

7.  **Flamechart Server (`apps/flamechart-server`)**

    - External server providing an HTTP API (`POST /render`) for rendering profiles to PNG.
    - Takes raw profile data (now sent as `text/plain` from an `ArrayBuffer`) and rendering options as input.
    - Returns a PNG image buffer.
    - Environment variable `FLAMECHART_SERVER_URL` in `process-ai-turn` points to this server.

8.  **Supabase Storage (Bucket: `ai-snapshots`)**
    - Stores the generated PNG snapshots.
    - Path: `ai-snapshots/<userId>/trace-<traceId>-<timestamp>.png`
    - RLS Policy: Enforces that users can only read snapshots where the `<userId>` in the path matches their authenticated `auth.uid()`.

## Data Flow Example (Snapshot Request - LangGraph Architecture)

1.  User asks a question requiring a visual (e.g., "Show me a snapshot").
2.  Client sends `user_prompt` (including history) via WebSocket.
3.  `trace-analysis-socket` invokes `process-ai-turn`.
4.  `process-ai-turn`'s `Deno.serve` handler initializes the `AgentState` (with messages from history/prompt, `userId`, `traceId`, etc.) and invokes the LangGraph application (`app.stream()`).
5.  **Graph Execution:**
    a. `__start__` -> `initialSetupNode`: Loads profile `ArrayBuffer` from storage, parses it into `profileData`, generates `traceSummary`. Adds `SystemMessage` (with summary) to state.messages.
    b. `initialSetupNode` -> `agentNode`: `agentNode` is invoked. The LLM decides to call `GenerateFlamegraphSnapshotTool`.
    c. `agentNode` -> `toolHandlerNode` (due to `tool_calls` in agentNode's AIMessage output):
    i. `toolHandlerNode` sends `tool_start` event to client via Realtime.
    ii. It instantiates `GenerateFlamegraphSnapshotTool` (using `profileArrayBuffer`, `userId`, `traceId` from state).
    iii. It calls the tool. The tool: 1. POSTs to `flamechart-server` (e.g., with `profileArrayBuffer` as `text/plain` or `application/octet-stream`). 2. Receives PNG buffer, encodes it to `base64Image`. 3. Uploads PNG to Supabase Storage, gets `publicUrl`. 4. Returns a JSON string: `{ "status": "Success", "publicUrl": "...", "base64Image": "...", "message": "Snapshot taken" }`.
    iv. `toolHandlerNode` creates a `ToolMessage` with this JSON string as content and updates state.messages.
    d. `toolHandlerNode` -> `agentNode`:
    i. `agentNode` is invoked again. It sees the last message is the `ToolMessage` from `GenerateFlamegraphSnapshotTool`.
    ii. It parses the JSON content. If `status` is 'Success' and `base64Image` is present, it constructs a new `HumanMessage` containing the `base64Image` data (e.g., as `{type: 'image_url', image_url: {url: 'data:image/png;base64,...'}}`) and relevant text (like the `publicUrl` or a success message from the tool).
    iii. This new `HumanMessage` (with the image for the LLM) is added to the messages in the state.
    iv. `agentNode` calls the LLM with all messages, including the one with the image. The LLM now formulates its response based on the original request, the trace summary, _and the visual context of the flamegraph snapshot_.
    v. As the LLM generates its textual response, the `handleLLMNewToken` callback (configured for the LLM in `agentNode`) fires for each token, sending `model_chunk_start`/`model_chunk_append` messages via Realtime.
    e. `agentNode` -> `END` (assuming no more tools or the AI decides to conclude).
6.  Client receives and displays the streamed textual response. The client UI itself does not necessarily need to render the base64 image from the `HumanMessage` (as that was for the LLM), but it could display the `publicUrl` if included in the LLM's text.
7.  After the graph execution finishes, `process-ai-turn` sends a `model_response_end` Realtime message.
