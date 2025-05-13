# Chat Architecture Overview

This document outlines the architecture of the AI Trace Analysis chat feature.

## Goal

To provide an interactive chat interface where users can ask questions about a loaded performance trace file and receive insights from an AI language model (e.g., GPT-4o), leveraging context from the trace file itself and allowing the AI to request specific data retrieval actions (tools).

## Key Constraints & Solutions

- **Edge Function Timeouts:** Supabase Edge Functions have execution time limits. Waiting for an LLM response within a single function handling a persistent WebSocket connection would cause timeouts.
  - **Solution:** A two-function asynchronous architecture is used. `trace-analysis-socket` handles the WebSocket connection and triggers `process-ai-turn` asynchronously.
- **Large Trace Files & Context Limits:** Trace files are often too large for LLM context windows.
  - **Solution:** The backend (`process-ai-turn`) fetches the file from Supabase Storage using the `traceId`. It generates a concise summary using the `speedscope-import` package and includes this summary in the system prompt provided to the Langchain agent.
- **Tool Execution & Context:** The AI needs to request specific data (e.g., top functions, flamegraph snapshot).
  - **Solution (Server-side Tools via Langchain):**
    - Tools (like `TopFunctionsTool` and `GenerateFlamegraphSnapshotTool`) are defined as Langchain `StructuredTool` classes in `supabase/functions/process-ai-turn/trace-tools.ts`, using Zod for input schema validation.
    - The `process-ai-turn` function initializes these tools and provides them to a Langchain agent (`AgentExecutor` with `createOpenAIFunctionsAgent`).
    - When the agent decides to use a tool, it invokes the tool's `_call` method.
    - **For `GenerateFlamegraphSnapshotTool` (Snapshot via Flamechart Server):**
      1. The agent, guided by its prompt and the conversation, decides to call the `GenerateFlamegraphSnapshotTool`, providing necessary arguments (view type, dimensions, etc.).
      2. The tool's `_call` method is executed. This method:
         a. Loads the raw profile data (ArrayBuffer, passed to the tool during its construction).
         b. Makes an HTTP POST request to the dedicated `flamechart-server` API (`/render`) with the raw profile data and rendering options.
         c. The `flamechart-server` returns a PNG image buffer.
         d. The tool uploads this PNG buffer to a designated Supabase Storage bucket (e.g., `ai-snapshots/<userId>/<filename>.png`), securing it with RLS policies.
         e. The tool returns a string containing the public (but RLS-protected) URL of the uploaded PNG (or an error message) back to the Langchain agent.
- **Statelessness:** Edge Functions are stateless.
  - **Solution:** Context (`traceId`, `userId`, `history`) is passed between functions. Trace data is fetched from Storage on demand.
- **Real-time Updates:** Users need asynchronous AI responses.
  - **Solution:** Supabase Realtime is used by `process-ai-turn`. Langchain callbacks (`handleLLMNewToken`, `handleToolStart`, `handleToolEnd`, `handleToolError`) are used to trigger sending messages (LLM token chunks, tool status, errors) to the client over this Realtime channel.

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
    - Uses Supabase admin client to query DB for `blob_path`.
    - **Initializes and runs a LangGraph workflow:**
      - **State Definition**: The graph's state (`AgentState`) is defined using `Annotation.Root` and `Annotation<Type>()` for each property (e.g., `messages`, `profileData`, `traceSummary`, `supabaseAdmin`, `realtimeChannel`, etc.). This provides a structured schema for the graph's memory.
      - **Nodes**:
        - `initialSetupNode`: Fetches the trace file from Supabase Storage (obtaining an `ArrayBuffer`). Uses the shared loader (`_shared/profile-loader.ts`) to parse the trace file, generating `profileData` and `traceSummary`. It also constructs the initial `SystemMessage` using the `traceSummary` and prepends it to the message history.
        - `agentNode`:
          - Responsible for interacting with the LLM (`ChatOpenAI`, configured for streaming and bound with tools).
          - If the previous step was a successful `generate_flamegraph_screenshot` tool call (indicated by a `ToolMessage` containing a JSON string with `status: 'Success'` and `base64Image`), it parses this JSON, takes the `base64Image` data, and constructs a new `HumanMessage` embedding this image. This new `HumanMessage` is included in the messages sent to the LLM for the current turn.
          - Invokes the LLM with the current message history (which includes the system prompt, user prompts, AI responses, tool messages, and the specially prepared human message with image if applicable).
          - Uses LangChain `callbacks` (`handleLLMNewToken`, etc.) to stream LLM responses and tool lifecycle events to the client via the Supabase Realtime channel.
        - `toolHandlerNode`:
          - If the `agentNode`'s AIMessage contains `tool_calls`, this node is invoked.
          - It instantiates the required tools (`TopFunctionsTool`, `GenerateFlamegraphSnapshotTool`) using context from the current graph state (e.g., `profileData`, `profileArrayBuffer`, `supabaseAdmin`).
          - It executes the called tool(s) with the arguments provided by the LLM.
          - It creates `ToolMessage`(s) containing the output from the tool(s) (e.g., a JSON string from `GenerateFlamegraphSnapshotTool` which includes status, publicUrl, and base64Image).
          - It sends `tool_start` and `tool_error` (if applicable) messages to the client via Realtime.
      - **Graph Flow (Edges)**:
        - The graph execution starts with an edge from `__start__` to `initialSetupNode`.
        - `initialSetupNode` transitions to `agentNode`.
        - `agentNode` has conditional edges:
          - If the LLM's response includes tool calls, it routes to `toolHandlerNode`.
          - If stopping conditions are met (e.g., max iterations, AI indicates completion), it routes to `END`.
        - `toolHandlerNode` transitions back to `agentNode` for the LLM to process the tool results.
    - The main `Deno.serve` handler receives the client request, sets up the initial state for the LangGraph (including mapping client `history` and `userPrompt` to messages), and invokes the compiled graph using `app.stream()`.
    - After the graph stream completes, a final `model_response_end` message is sent via Realtime.

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

1.  User asks a question requiring a visual (e.g., "Show me the callees for function X as a flamegraph").
2.  Client sends `user_prompt` (including history) via WebSocket.
3.  `trace-analysis-socket` invokes `process-ai-turn`.
4.  `process-ai-turn`'s `Deno.serve` handler sets up the initial `AgentState` (with messages from history and user prompt) and invokes the LangGraph application (`app.stream()`).
5.  The LangGraph execution begins:
    a. `__start__` -> `initialSetupNode`: Loads profile data (`ArrayBuffer`, `profileData`), generates `traceSummary`. Constructs and prepends the `SystemMessage` to the messages in the state.
    b. `initialSetupNode` -> `agentNode`: The `agentNode` is invoked with the current state (including messages with the system prompt).
6.  The LLM (via `agentNode`) decides to use `GenerateFlamegraphSnapshotTool` and determines its arguments. The `agentNode`'s `AIMessage` output includes `tool_calls`.
7.  The graph's conditional logic routes from `agentNode` to `toolHandlerNode`. The `agentNode`'s `handleToolStart` LangChain callback fires, sending a `tool_start` message via Realtime.
8.  The `toolHandlerNode` executes:
    a. Instantiates `GenerateFlamegraphSnapshotTool` using `profileArrayBuffer` and other context from the graph state.
    b. Calls the tool. The tool:
    i. Makes an HTTP POST request to the `flamechart-server` with the profile `ArrayBuffer` and rendering parameters.
    ii. `flamechart-server` renders the PNG and returns the image buffer.
    iii.The tool encodes the `pngBuffer` to `base64Image`.
    iv. The tool uploads the PNG buffer to Supabase Storage (e.g., `ai-snapshots/<userId>/<filename>.png`).
    v. The tool gets the public (RLS-protected) URL for the uploaded image.
    vi. The `_call` method returns a **JSON string** containing `{ status: 'Success', publicUrl: '...', base64Image: '...', message: '...' }`.
    c. `toolHandlerNode` creates a `ToolMessage` with this JSON string as its content and adds it to the graph state's messages.
9.  The `toolHandlerNode` might send a `tool_error` message via Realtime if the JSON string from the tool indicates an error status. It then transitions back to `agentNode`.
10. The `agentNode` is invoked again. It sees the last message is a `ToolMessage` from `generate_flamegraph_screenshot`.
11. `agentNode` parses the JSON content of the `ToolMessage`. If `status` is 'Success' (or 'SuccessWithWarning') and `base64Image` is present:
    a. It creates a new `HumanMessage` containing the `base64Image` (e.g., `{type: 'image_url', image_url: {url: 'data:image/png;base64,...'}}`) and relevant text.
    b. This new `HumanMessage` is added to the list of messages sent to the LLM for this turn.
12. `agentNode` calls the LLM with the updated messages (now including the `HumanMessage` with the image). The LLM formulates its response based on the text and the provided image.
13. As the LLM generates this response, the `handleLLMNewToken` callback in `agentNode` fires for each token, sending `model_chunk_start`/`model_chunk_append` messages via Realtime.
14. Client receives and displays the streamed response. The client UI should be capable of rendering images if the AI's textual response implies an image was shown to it (or if the client also gets the image URL/data through a separate mechanism, though here the image is primarily for LLM consumption).
15. After the `agentNode` completes and if no further tools are called and stopping conditions aren't met, the graph might loop or end. Eventually, the graph execution finishes, and `process-ai-turn` sends a `model_response_end` Realtime message.
