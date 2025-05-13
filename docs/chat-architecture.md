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
    - Uses Supabase admin client to query DB for `blob_path` and download the trace file from Storage (obtaining an `ArrayBuffer`).
    - Uses **shared loader** (`_shared/profile-loader.ts`) to parse the trace file (for summary and for use by tools).
    - Initializes Langchain components:
      - `ChatOpenAI` for LLM interaction (configured for streaming).
      - `TopFunctionsTool` and `GenerateFlamegraphSnapshotTool` (from `./trace-tools.ts`), passing necessary dependencies like profile data, Supabase client, and config URLs.
      - `ChatPromptTemplate` to structure the prompts for the agent, including system message, trace summary, chat history, and user input.
      - An OpenAI Functions Agent (`createOpenAIFunctionsAgent`) and an `AgentExecutor`.
    - Defines Langchain `callbacks` for:
      - `handleLLMNewToken`: Streams LLM response tokens (`model_chunk_start`, `model_chunk_append`) to the client via Realtime. Manages `llmStreamingActiveForCurrentSegment` state.
      - `handleToolStart`: Sends `tool_start` event (with tool name) via Realtime. Resets `llmStreamingActiveForCurrentSegment`.
      - `handleToolEnd`: If the tool's output string indicates an error, sends `tool_error` via Realtime. Resets `llmStreamingActiveForCurrentSegment`.
      - `handleToolError`: If Langchain encounters an error running a tool, sends `tool_error` via Realtime. Resets `llmStreamingActiveForCurrentSegment`.
    - Invokes the `agentExecutor.stream()` method with the user's prompt, mapped chat history, trace summary, and the defined `callbacks`.
    - The main loop `for await (const chunk of stream)` primarily serves to drive the agent's execution, as most client communication is handled by the callbacks. It may include fallback logic for `chunk.output` if it's a final non-LLM string.
    - Sends a final `model_response_end` message via Realtime after the agent stream completes.

5.  **Shared Loader (`supabase/functions/_shared/profile-loader.ts`)**

    - Contains `parseProfileBuffer` function (renamed from `loadProfileData`).
    - Takes an `ArrayBuffer` (already downloaded profile data) and `fileName`, decompresses if needed, parses using `speedscope-import`, returns `{ profileGroup, profileType }`.

6.  **Shared Tools (`supabase/functions/process-ai-turn/trace-tools.ts`)**

    - Defines Langchain `StructuredTool` classes (e.g., `TopFunctionsTool`, `GenerateFlamegraphSnapshotTool`).
    - Each tool uses a Zod schema to define its expected input arguments.
    - The core logic for each tool is implemented in its `_call` method. For example, `GenerateFlamegraphSnapshotTool`'s `_call` method handles the interaction with the `flamechart-server` and Supabase Storage.

7.  **Flamechart Server (`apps/flamechart-server`)**

    - External server providing an HTTP API (`POST /render`) for rendering profiles to PNG.
    - Takes raw profile data (now sent as `application/octet-stream` from an `ArrayBuffer`) and rendering options as input.
    - Returns a PNG image buffer.
    - Environment variable `FLAMECHART_SERVER_URL` in `process-ai-turn` points to this server.

8.  **Supabase Storage (Bucket: `ai-snapshots`)**
    - Stores the generated PNG snapshots.
    - Path: `ai-snapshots/<userId>/trace-<traceId>-<timestamp>.png`
    - RLS Policy: Enforces that users can only read snapshots where the `<userId>` in the path matches their authenticated `auth.uid()`.

## Data Flow Example (Snapshot Request - Langchain Architecture)

1.  User asks a question requiring a visual (e.g., "Show me the callees for function X as a flamegraph").
2.  Client sends `user_prompt` (including history) via WebSocket.
3.  `trace-analysis-socket` invokes `process-ai-turn`.
4.  `process-ai-turn` loads profile data (summary and `ArrayBuffer`).
5.  `process-ai-turn` initializes the Langchain agent with tools, including `GenerateFlamegraphSnapshotTool`.
6.  The agent is invoked with the prompt and history. The LLM (via agent) decides to use `GenerateFlamegraphSnapshotTool` and determines its arguments.
7.  The `handleToolStart` Langchain callback fires in `process-ai-turn`.
    - It sends a `tool_start` message (e.g., `{ type: 'tool_start', toolName: 'GenerateFlamegraphSnapshotTool', ... }`) via Realtime to the client.
    - It resets the `llmStreamingActiveForCurrentSegment` flag.
8.  The agent executes the `GenerateFlamegraphSnapshotTool`'s `_call` method:
    a. The tool makes an HTTP POST request to the `flamechart-server` with the profile `ArrayBuffer` and rendering parameters.
    b. `flamechart-server` renders the PNG and returns the image buffer.
    c. The tool uploads the PNG buffer to Supabase Storage at `ai-snapshots/<userId>/<filename>.png`.
    d. The tool gets the public (RLS-protected) URL for the uploaded image.
    e. The `_call` method returns the image URL string (or an error string) to the agent.
9.  The `handleToolEnd` (or `handleToolError`) Langchain callback fires:
    - If the tool returned an error string (e.g., "Error: ..."), `handleToolEnd` sends a `tool_error` message via Realtime.
    - If the tool execution itself threw an error, `handleToolError` sends a `tool_error` message via Realtime.
    - It resets the `llmStreamingActiveForCurrentSegment` flag.
10. The agent receives the tool's output (the image URL or error message).
11. The agent makes a subsequent call to the LLM, providing the tool's output as context, to formulate the final user-facing response.
12. As the LLM generates this response, the `handleLLMNewToken` callback in `process-ai-turn` fires for each token.
    - It sends `model_chunk_start` (for the first token of this new segment) and then `model_chunk_append` messages via Realtime to the client.
13. Client receives and displays the streamed response, which should reference the snapshot (e.g., by including the image URL as text, which the client can then render as an image).
14. After the agent stream finishes, `process-ai-turn` sends a `model_response_end` Realtime message.
