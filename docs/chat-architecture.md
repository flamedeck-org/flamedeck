# Chat Architecture Overview

This document outlines the architecture of the AI Trace Analysis chat feature.

## Goal

To provide an interactive chat interface where users can ask questions about a loaded performance trace file and receive insights from an AI language model (e.g., GPT-4o Mini), leveraging context from the trace file itself and allowing the AI to request specific data retrieval actions (tools).

## Key Constraints & Solutions

*   **Edge Function Timeouts:** Supabase Edge Functions have execution time limits. Waiting for an LLM response within a single function handling a persistent WebSocket connection would cause timeouts.
    *   **Solution:** A two-function asynchronous architecture is used. `trace-analysis-socket` handles the WebSocket connection and triggers `process-ai-turn` asynchronously.
*   **Large Trace Files & Context Limits:** Trace files are often too large for LLM context windows.
    *   **Solution:** The backend (`process-ai-turn`) fetches the file from Supabase Storage using the `traceId`. It generates a concise summary using the `shared-importer` package and includes this summary in the system prompt.
*   **Tool Execution & Context:** The AI needs to request specific data (e.g., top functions, flamegraph snapshot).
    *   **Solution (Server-side Tools):** For data computable from the trace file (like top functions), a tool schema is provided to the OpenAI API. When requested, `process-ai-turn` executes the tool logic using the loaded trace data and sends the result back to the API.
    *   **Solution (Client-side Tools - Snapshot):** For actions requiring client-side rendering (like flamegraph snapshots), a different flow is needed:
        1.  AI requests the `get_flamegraph_snapshot` tool.
        2.  `process-ai-turn` stores the necessary conversation state (history, tool call info) in a temporary database table (`ai_chat_continuations`) associated with a unique `request_id` (the tool call ID).
        3.  `process-ai-turn` sends a `request_snapshot` message via Realtime to the client, including the `request_id`.
        4.  The client generates the snapshot and sends a `snapshot_result` message via WebSocket back to `trace-analysis-socket`, including the `request_id` and image data.
        5.  `trace-analysis-socket` receives the result, fetches the stored state from the database using `request_id`, deletes the state record, and re-invokes `process-ai-turn` with a special `continue_with_tool_result` payload containing the state and the snapshot result.
        6.  `process-ai-turn` receives the continuation payload, formats the tool result message, and sends the final completion request (with the tool result included) to the OpenAI API to get the final user-facing response.
*   **Statelessness:** Edge Functions are stateless.
    *   **Solution:** Context (`traceId`, `userId`, `history`) is passed between functions. Trace data is fetched from Storage on demand. Temporary state for client-side tool calls is managed via the database table.
*   **Real-time Updates:** Users need asynchronous AI responses and client-side tool requests.
    *   **Solution:** Supabase Realtime is used by `process-ai-turn` to stream AI response chunks and errors back to the client, and also to request client-side actions (like snapshots).

## Components

1.  **Client-Side UI (`apps/client/src/components/Chat/`)**
    *   `FloatingChatButton.tsx`: Toggles chat window visibility.
    *   `ChatWindow.tsx`: Renders messages, input. Manages scroll state (including user scroll detection).
    *   `ChatContainer.tsx`: Client orchestrator.
        *   Manages WebSocket (`useTraceAnalysisSocket`) and Supabase Realtime connections.
        *   Handles chat state (`isChatOpen`, `chatMessages`, etc.) and controls `ChatWindow`.
        *   Sends `start_analysis` and `user_prompt` via WebSocket.
        *   Receives WebSocket acks/errors.
        *   Receives Realtime messages for AI stream (`model_chunk_start/append/end`, `error`) **and** `request_snapshot` events.
        *   **Triggers snapshot generation** (communicating with `SpeedscopeViewer` via props/context - *Needs implementation detail*) upon receiving `request_snapshot`.
        *   Sends `snapshot_result` back via WebSocket.

2.  **WebSocket Hook (`apps/client/src/hooks/useTraceAnalysisSocket.ts`)**
    *   Manages raw WebSocket lifecycle, message sending/receiving.

3.  **Client Snapshot Logic (`apps/client/src/components/SpeedscopeViewer.tsx` - Proposed)**
    *   Needs modification to accept a prop/context function (e.g., `generateSnapshot`) from its parent page.
    *   Implements the logic to capture the canvas content using `canvas.toDataURL()` based on the requested `viewType`.

4.  **WebSocket Handler (`supabase/functions/trace-analysis-socket/index.ts`)**
    *   Manages WebSocket connections.
    *   Receives `start_analysis`, `user_prompt`, and `snapshot_result` messages.
    *   On `start_analysis` / `user_prompt`: Invokes `process-ai-turn` asynchronously (initial request).
    *   On `snapshot_result`:
        *   Uses Supabase admin client to fetch state from `ai_chat_continuations` using `requestId`.
        *   Deletes the state record.
        *   Invokes `process-ai-turn` asynchronously with `continue_with_tool_result` payload.
    *   Sends WebSocket acks (`connection_ack`, `waiting_for_model`).

5.  **AI Processor (`supabase/functions/process-ai-turn/index.ts`)**
    *   An Edge Function invoked asynchronously.
    *   Handles initial requests (`start_analysis`, `user_prompt`) and continuation requests (`continue_with_tool_result`).
    *   Uses Supabase admin client to query DB for `blob_path`.
    *   Uses **shared loader** (`_shared/profile-loader.ts`) to download, decompress, and parse the trace file using `shared-importer`.
    *   Generates trace summary.
    *   Uses the `openai` library directly (not LangChain agents).
    *   **On initial request:**
        *   Formats messages (system prompt, summary, history, user prompt).
        *   Calls OpenAI Chat Completions API with tool schemas (`tools`) and `tool_choice: 'auto'`.
        *   **If snapshot tool requested:** Stores state (`userId`, `traceId`, `message_history`, `tool_call`) in `ai_chat_continuations` table, sends `request_snapshot` via Realtime to client, **ends execution**. 
        *   **If other tool requested:** Executes tool locally (e.g., `executeGetTopFunctions`), appends assistant message + tool result to history, makes second OpenAI call (`stream: true`), streams response via Realtime.
        *   **If no tool requested:** Makes second OpenAI call with original messages (`stream: true`), streams response via Realtime.
    *   **On `continue_with_tool_result` request:**
        *   Retrieves original state and snapshot result from payload.
        *   Constructs tool result message.
        *   Appends assistant message (tool request) + tool result message to history.
        *   Makes OpenAI call (`stream: true`) with updated history.
        *   Streams response via Realtime.
    *   Sends Realtime messages (`model_chunk_start/append/end`, `tool_start`, `error`).

6.  **Shared Loader (`supabase/functions/_shared/profile-loader.ts`)**
    *   Contains `loadProfileData` function.
    *   Takes `blobPath`, downloads from storage, decompresses, parses using `shared-importer`, returns `{ profileGroup, profileType }`.

7.  **Shared Tools (`supabase/functions/process-ai-turn/trace-tools.ts` - currently local)**
    *   Defines tool schemas for OpenAI (e.g., `getTopFunctionsToolSchema`).
    *   Contains execution logic for server-side tools (e.g., `executeGetTopFunctions`).

8.  **Database Table (`public.ai_chat_continuations`)**
    *   Stores temporary state for pending client-side tool calls (snapshots).
    *   Fields: `request_id`, `user_id`, `trace_id`, `message_history`, `tool_call`, `created_at`.
    *   Requires cleanup mechanism (e.g., TTL or cron job).

## Data Flow Example (Snapshot Request)

1.  User asks a question requiring a visual (e.g., "Show me the callees for function X").
2.  Client sends `user_prompt` via WebSocket.
3.  `trace-analysis-socket` invokes `process-ai-turn` (initial).
4.  `process-ai-turn` loads profile, calls OpenAI API (1st call) with tool schemas.
5.  OpenAI responds requesting `get_flamegraph_snapshot` tool with specific `viewType` and `tool_call_id`.
6.  `process-ai-turn` stores current `message_history`, `tool_call`, etc. in `ai_chat_continuations` table using `tool_call_id` as `request_id`.
7.  `process-ai-turn` sends `{ type: 'request_snapshot', requestId, viewType }` via Realtime to client.
8.  `process-ai-turn` (initial invocation) finishes.
9.  `ChatContainer` receives Realtime message.
10. `ChatContainer` triggers snapshot generation in `SpeedscopeViewer` (needs implementation).
11. `SpeedscopeViewer` generates data URL.
12. `ChatContainer` sends `{ type: 'snapshot_result', requestId, status: 'success', imageDataUrl }` via WebSocket.
13. `trace-analysis-socket` receives `snapshot_result`.
14. `trace-analysis-socket` fetches state from `ai_chat_continuations` using `requestId`, then deletes the row.
15. `trace-analysis-socket` invokes `process-ai-turn` (continuation) with state + result.
16. `process-ai-turn` (continuation) receives payload.
17. It reconstructs history including the assistant tool request and the tool result (containing the image data URL).
18. It calls OpenAI API (2nd call) with updated history and `stream: true`.
19. It streams the final LLM response (which should reference the snapshot) back to the client via Realtime (`model_chunk_append`, etc.).
20. Client displays the final streamed response. 