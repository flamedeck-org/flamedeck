# Chat Architecture Overview

This document outlines the architecture of the AI Trace Analysis chat feature.

## Goal

To provide an interactive chat interface where users can ask questions about a loaded performance trace file and receive insights from an AI language model (e.g., GPT-4o Mini), leveraging context from the trace file itself.

## Key Constraints & Solutions

*   **Edge Function Timeouts:** Supabase Edge Functions have execution time limits (e.g., 150s on free tier). Waiting for an LLM response within a single function handling a persistent WebSocket connection would cause timeouts.
    *   **Solution:** A two-function asynchronous architecture is used. One function handles the WebSocket, another handles the potentially long-running AI processing.
*   **Large Trace Files:** Trace files can be too large to fit into an LLM's context window.
    *   **Solution:** Instead of sending the file, the backend fetches the file from Supabase Storage using the `traceId`. It generates a concise summary using the `shared-importer` package and includes this summary in the prompt sent to the LLM.
*   **Statelessness:** Edge Functions are stateless.
    *   **Solution:** Relevant context (like `traceId`, `userId`, conversation `history`) is passed with each request. Trace data is fetched from Storage on demand.
*   **Real-time Updates:** The user needs to see the AI response, which is generated asynchronously.
    *   **Solution:** Supabase Realtime is used for the AI processing function to push results back to the specific client.

## Components

1.  **Client-Side UI (`apps/client/src/components/Chat/`)**
    *   `FloatingChatButton.tsx`: A simple button positioned at the bottom-right to toggle the chat window's visibility.
    *   `ChatWindow.tsx`: Renders the chat interface (messages, input field, header). Handles user input, displays messages, and manages scrolling (including preventing auto-scroll if the user scrolls up during streaming). Exposes a `scrollToBottom` method via `forwardRef`.
    *   `ChatContainer.tsx`: The main orchestrator on the client. 
        *   Uses `useAuth` to get the `userId`.
        *   Uses the `useTraceAnalysisSocket` hook to manage the WebSocket connection.
        *   Uses the `supabase` client to subscribe/unsubscribe from a user-specific Supabase Realtime channel (`private-chat-results-${userId}`).
        *   Manages chat state (`isChatOpen`, `chatMessages`, `isLoading`, `isStreaming`, `chatError`, `isInitialAnalysisRequested`).
        *   Connects WebSocket and subscribes to Realtime when the chat is opened (`isChatOpen` becomes true) and disconnects/unsubscribes when closed.
        *   Sends `start_analysis` message via WebSocket upon successful connection (only once per session/`traceId`).
        *   Sends `user_prompt` messages (including history and `traceId`) via WebSocket.
        *   Receives acknowledgements and errors directly from the WebSocket.
        *   Receives AI responses (streamed chunks, end signals, errors) via the Realtime subscription.
        *   Updates the `chatMessages` state based on incoming WebSocket and Realtime messages.
        *   Controls the `ChatWindow` component, passing props and calling `scrollToBottom` on its ref.

2.  **WebSocket Hook (`apps/client/src/hooks/useTraceAnalysisSocket.ts`)**
    *   A reusable hook that encapsulates the raw WebSocket connection logic.
    *   Handles connecting, disconnecting, sending JSON messages, and receiving messages.
    *   Manages connection state (`isConnected`) and surfaces the last received message (`lastMessage`) and connection errors (`error`).
    *   **Important:** Passes the original `CloseEvent` object on close, not a generic `Error`, to allow specific handling (like ignoring 1006).

3.  **WebSocket Handler (`supabase/functions/trace-analysis-socket/index.ts`)**
    *   An Edge Function responsible for managing WebSocket connections.
    *   Handles the WebSocket upgrade handshake.
    *   Receives `start_analysis` and `user_prompt` messages.
    *   **Does NOT interact with the LLM directly.**
    *   Stores the `userId` associated with the connection (requires secure JWT validation in production).
    *   Uses the standard Supabase client (`supabaseClient`) to **asynchronously invoke** the `process-ai-turn` function, passing the necessary payload (`userId`, `prompt`, `traceId`, `history`, `isInitialAnalysis`).
    *   Sends acknowledgements (`connection_ack`, `waiting_for_model`) back to the client via WebSocket.

4.  **AI Processor (`supabase/functions/process-ai-turn/index.ts`)**
    *   A separate Edge Function invoked asynchronously by `trace-analysis-socket`.
    *   Receives the payload including `userId`, `prompt`, `traceId`, `history`, and `isInitialAnalysis`.
    *   Uses the Supabase **admin client** (`supabaseAdmin`, requires `SUPABASE_SERVICE_ROLE_KEY`) to:
        *   Query the `traces` database table to get the `blob_path` for the given `traceId`.
        *   Download the trace file (`.json.gz`) from Supabase Storage using the fetched `blob_path`.
    *   Decompresses the trace file (`pako`).
    *   Uses the `shared-importer` package (`importProfilesFromArrayBuffer`) to parse the trace data.
    *   Generates a concise summary of the trace data.
    *   Constructs the full prompt for the LLM, including a system message, the trace summary, the mapped conversation history, and the user's current prompt.
    *   Initializes the LangChain `ChatOpenAI` model (with `streaming: true`).
    *   Calls `chatModel.stream()` to get the streaming response.
    *   Uses the Supabase **admin client** again to publish messages to the user-specific Realtime channel (`private-chat-results-${userId}`):
        *   `model_chunk_start`: For the first chunk of the AI response.
        *   `model_chunk_append`: For subsequent chunks.
        *   `model_response_end`: When the stream finishes successfully.
        *   `error`: If an error occurs during processing or the AI call.
    *   This function runs within its own execution time limit.

## Data Flow Example (User Prompt)

1.  User types message in `ChatWindow` and presses Enter.
2.  `ChatContainer.handleSendMessage` is called.
3.  User message is added to `chatMessages` state.
4.  `isWaitingForModel` state is set to `true`.
5.  `ChatContainer` forces `ChatWindow` to scroll to bottom (`scrollToBottom(true)`).
6.  Relevant `history` is extracted.
7.  A `{ type: 'user_prompt', prompt, userId, traceId, history }` message is sent via WebSocket using `useTraceAnalysisSocket`.
8.  `trace-analysis-socket` Edge Function receives the message via `socket.onmessage`.
9.  It looks up the `userId`.
10. It sends a `{ type: 'waiting_for_model' }` message back via WebSocket.
11. It asynchronously invokes the `process-ai-turn` Edge Function with the payload.
12. `trace-analysis-socket` finishes its `onmessage` handling.
13. `ChatContainer` receives `{ type: 'waiting_for_model' }` via WebSocket, updates state if necessary (already set `isWaitingForModel`).
14. `process-ai-turn` Edge Function starts executing.
15. It queries the database for the `blob_path` using `traceId`.
16. It downloads the trace file from Storage using `blob_path`.
17. It decompresses and parses the trace using `shared-importer`.
18. It generates the trace summary.
19. It constructs the full prompt (system, summary, history, user prompt).
20. It calls `chatModel.stream()`.
21. As chunks arrive from the LLM:
    *   It sends broadcast messages (`{ type: 'broadcast', event: 'ai_response', payload: { type: 'model_chunk_start'/'model_chunk_append', chunk: '...' } }`) to the `private-chat-results-${userId}` Realtime channel.
22. `ChatContainer` receives these Realtime messages via its subscription.
23. The `on('broadcast', ...)` handler updates the `chatMessages` state, creating/appending to the AI message.
24. `ChatContainer` calls `scrollToBottom()` (non-forced) on `ChatWindow` ref after each chunk update.
25. When the LLM stream finishes, `process-ai-turn` sends a final Realtime broadcast (`{ payload: { type: 'model_response_end' } }`).
26. `ChatContainer` receives the end message, sets `isWaitingForModel` and `isStreaming` to `false`.

This architecture decouples the persistent connection handling from the potentially slow AI processing, using Realtime for the asynchronous callback, while providing context to the AI via summaries fetched on the backend. 