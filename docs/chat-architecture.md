# Chat Architecture Overview

This document outlines the architecture of the AI Trace Analysis chat feature.

## Goal

To provide an interactive chat interface where users can ask questions about a loaded performance trace file and receive insights from an AI language model (e.g., GPT-4o Mini), leveraging context from the trace file itself and allowing the AI to request specific data retrieval actions (tools).

## Key Constraints & Solutions

- **Edge Function Timeouts:** Supabase Edge Functions have execution time limits. Waiting for an LLM response within a single function handling a persistent WebSocket connection would cause timeouts.
  - **Solution:** A two-function asynchronous architecture is used. `trace-analysis-socket` handles the WebSocket connection and triggers `process-ai-turn` asynchronously.
- **Large Trace Files & Context Limits:** Trace files are often too large for LLM context windows.
  - **Solution:** The backend (`process-ai-turn`) fetches the file from Supabase Storage using the `traceId`. It generates a concise summary using the `speedscope-import` package and includes this summary in the system prompt.
- **Tool Execution & Context:** The AI needs to request specific data (e.g., top functions, flamegraph snapshot).
  - **Solution (Server-side Tools - Top Functions):** For data computable from the trace file (like top functions), a tool schema is provided to the OpenAI API. When requested, `process-ai-turn` executes the tool logic using the loaded trace data and sends the result back to the API.
  - **Solution (Server-side Tools - Snapshot via Flamechart Server):** For flamegraph snapshots:
    1.  AI requests the `get_flamegraph_snapshot` tool, potentially with rendering parameters (view type, dimensions, theme, etc.).
    2.  `process-ai-turn` loads the raw profile data from Supabase Storage.
    3.  It makes an HTTP POST request to the dedicated `flamechart-server` API (`/render`) with the raw profile data and the specified rendering options.
    4.  The `flamechart-server` returns a PNG image buffer.
    5.  `process-ai-turn` uploads this PNG buffer to a designated Supabase Storage bucket (e.g., `ai-snapshots/<userId>/<filename>.png`), securing it with RLS policies so users can only access their own snapshots.
    6.  `process-ai-turn` constructs a tool result message containing the public (but RLS-protected) URL of the uploaded PNG.
    7.  This result is then sent back to the OpenAI API as part of the conversation to get the final user-facing response.
- **Statelessness:** Edge Functions are stateless.
  - **Solution:** Context (`traceId`, `userId`, `history`) is passed between functions. Trace data is fetched from Storage on demand.
- **Real-time Updates:** Users need asynchronous AI responses.
  - **Solution:** Supabase Realtime is used by `process-ai-turn` to stream AI response chunks and errors back to the client.

## Components

1.  **Client-Side UI (`apps/client/src/components/Chat/`)**

    - `FloatingChatButton.tsx`: Toggles chat window visibility.
    - `ChatWindow.tsx`: Renders messages (including images via URL), input. Manages scroll state.
    - `ChatContainer.tsx`: Client orchestrator.
      - Manages WebSocket (`useTraceAnalysisSocket`) and Supabase Realtime connections.
      - Handles chat state (`isChatOpen`, `chatMessages`, etc.) and controls `ChatWindow`.
      - Sends `start_analysis` and `user_prompt` via WebSocket.
      - Receives WebSocket acks/errors.
      - Receives Realtime messages for AI stream (`model_chunk_start/append/end`, `error`, `tool_start`).
      - **Does NOT handle snapshot generation or results directly.** The AI response will contain an image URL if a snapshot was requested.

2.  **WebSocket Hook (`apps/client/src/hooks/useTraceAnalysisSocket.ts`)**

    - Manages raw WebSocket lifecycle, message sending/receiving.

3.  **WebSocket Handler (`supabase/functions/trace-analysis-socket/index.ts`)**

    - Manages WebSocket connections.
    - Receives `start_analysis` and `user_prompt` messages.
    - On `start_analysis` / `user_prompt`: Invokes `process-ai-turn` asynchronously.
    - **Does NOT handle `snapshot_result` messages from the client.**
    - Sends WebSocket acks (`connection_ack`, `waiting_for_model`).

4.  **AI Processor (`supabase/functions/process-ai-turn/index.ts`)**

    - An Edge Function invoked asynchronously.
    - Uses Supabase admin client to query DB for `blob_path`.
    - Uses **shared loader** (`_shared/profile-loader.ts`) to download and parse the trace file (for summary) and to get the raw profile text (for snapshots).
    - Generates trace summary.
    - Uses the `openai` library directly.
    - Formats messages (system prompt, summary, history, user prompt).
    - Calls OpenAI Chat Completions API with tool schemas (`tools`) and `tool_choice: 'auto'`.
    - **If `get_flamegraph_snapshot` tool requested:**
      - Retrieves rendering arguments from the tool call.
      - Fetches the raw profile data text.
      - Makes an HTTP POST to the `flamechart-server` (URL from env var) with the profile text and rendering arguments.
      - Receives PNG image buffer.
      - Uploads PNG to Supabase Storage (e.g., `ai-snapshots/<userId>/trace-<traceId>-<timestamp>.png`).
      - Gets the public URL of the uploaded image.
      - Constructs the tool result message (containing the image URL).
      - Appends assistant message (tool request) + tool result message to history.
      - Makes a second OpenAI call (`stream: true`) with updated history.
      - Streams response (which should reference the image) via Realtime.
    - **If other tool requested (e.g., `get_top_functions`):** Executes tool locally, appends assistant message + tool result to history, makes second OpenAI call (`stream: true`), streams response via Realtime.
    - **If no tool requested:** Makes OpenAI call with original messages (`stream: true`), streams response via Realtime.
    - Sends Realtime messages (`model_chunk_start/append/end`, `tool_start`, `error`).

5.  **Shared Loader (`supabase/functions/_shared/profile-loader.ts`)**

    - Contains `loadProfileData` function.
    - Takes `blobPath`, downloads from storage, (optionally provides raw text), decompresses, parses using `speedscope-import`, returns `{ profileGroup, profileType }`.

6.  **Shared Tools (`supabase/functions/process-ai-turn/trace-tools.ts`)**

    - Defines tool schemas for OpenAI (e.g., `getTopFunctionsToolSchema`, `getSnapshotToolSchema` with parameters for viewType, width, height, theme, etc.).
    - Contains execution logic for server-side tools (e.g., `executeGetTopFunctions`).

7.  **Flamechart Server (`apps/flamechart-server`)**

    - External server providing an HTTP API (`POST /render`) for rendering profiles to PNG.
    - Takes raw profile data and rendering options as input.
    - Returns a PNG image buffer.
    - Environment variable `FLAMECHART_SERVER_URL` in `process-ai-turn` points to this server.

8.  **Supabase Storage (Bucket: `ai-snapshots`)**
    - Stores the generated PNG snapshots.
    - Path: `ai-snapshots/<userId>/trace-<traceId>-<timestamp>.png`
    - RLS Policy: Enforces that users can only read snapshots where the `<userId>` in the path matches their authenticated `auth.uid()`.

## Data Flow Example (Snapshot Request - New Architecture)

1.  User asks a question requiring a visual (e.g., "Show me the callees for function X as a flamegraph").
2.  Client sends `user_prompt` via WebSocket.
3.  `trace-analysis-socket` invokes `process-ai-turn` (initial).
4.  `process-ai-turn` loads profile data (summary and raw text).
5.  `process-ai-turn` calls OpenAI API (1st call) with tool schemas.
6.  OpenAI responds requesting `get_flamegraph_snapshot` tool with specific parameters (e.g., `viewType`, `width`, etc.) and `tool_call_id`.
7.  `process-ai-turn` sends a `tool_start` message via Realtime to the client.
8.  `process-ai-turn` makes an HTTP POST request to the `flamechart-server` with the raw profile text and rendering parameters.
9.  `flamechart-server` renders the PNG and returns the image buffer.
10. `process-ai-turn` uploads the PNG buffer to Supabase Storage at `ai-snapshots/<userId>/<filename>.png`.
11. `process-ai-turn` gets the public (RLS-protected) URL for the uploaded image.
12. It reconstructs conversation history including the assistant's tool request message and the tool result message (containing the image URL).
13. It calls OpenAI API (2nd call) with updated history and `stream: true`.
14. It streams the final LLM response (which should reference the snapshot via its URL) back to the client via Realtime (`model_chunk_append`, etc.).
15. Client displays the final streamed response, rendering the image from the URL.
