import { useState, useEffect, useCallback, useRef } from 'react';
import { useTraceAnalysisSocket } from '@/hooks/useTraceAnalysisSocket';
import {
  FloatingChatButton,
  ChatWindow,
  type ChatMessage,
  type ChatWindowHandle,
} from '@/components/Chat';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth to get user ID
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client
import type { RealtimeChannel } from '@supabase/supabase-js'; // Import type for channel ref

interface ChatContainerProps {
  traceId: string | null;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ traceId }) => {
  const { user } = useAuth(); // Get user from Auth context
  const userId = user?.id;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentMessageRef = useRef<ChatMessage | null>(null); // Ref to track current streaming message
  const chatWindowRef = useRef<ChatWindowHandle>(null); // <-- Create ref for ChatWindow
  const [isInitialAnalysisRequested, setIsInitialAnalysisRequested] = useState<boolean>(false);
  const previousTraceIdRef = useRef<string | null>(null); // Ref to track previous traceId
  const analysisSentForCurrentTraceRef = useRef<boolean>(false); // Ref to track if initial analysis was sent for this traceId

  const {
    connect: connectSocket,
    disconnect: disconnectSocket,
    sendMessage: sendRawSocketMessage,
    isConnected: isSocketConnected,
    lastMessage: lastSocketMessage, // Renamed to avoid confusion
    error: socketErrorEvent,
  } = useTraceAnalysisSocket();

  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isWaitingForModel, setIsWaitingForModel] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  // Effect to manage WebSocket and Realtime connections based on chat open state
  useEffect(() => {
    let channel: RealtimeChannel | null = null; // Define channel var here

    if (isChatOpen && userId && traceId) {
      // Connect WebSocket
      if (!isSocketConnected) {
        console.log('[ChatContainer] isChatOpen, calling connectSocket().');
        connectSocket();
      }

      // Subscribe to Realtime Channel
      const channelName = `private-chat-results-${userId}`;
      channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false }, // Don't receive our own broadcasts if ever needed
        },
      });

      channel
        .on('broadcast', { event: 'ai_response' }, (message) => {
          const payload = message.payload;
          let newError: string | null = null;
          let forceScroll = false; // Flag to determine if scroll should be forced

          setChatMessages((prevMessages) => {
            const messageId = uuidv4(); // Generate ID within state update if needed
            let updatedMessages = [...prevMessages];

            // Handle new tool events
            if (payload.type === 'tool_start') {
              const toolMsg = payload.message || `Using tool: ${payload.toolName}...`;
              updatedMessages.push({ id: messageId, sender: 'system', text: toolMsg });
              setIsWaitingForModel(true); // Still waiting while tool runs
              setIsStreaming(false); // Not streaming LLM tokens now
            } else if (payload.type === 'tool_end') {
              // Optionally display tool output, or just indicate completion
              // For now, just remove the waiting state
              // updatedMessages.push({ id: messageId, sender: 'system', text: `Tool finished. Output: ${payload.output}` });
              setIsWaitingForModel(true); // Still waiting for LLM to process result
              setIsStreaming(false);
            }
            // Handle existing streaming events
            else if (payload.type === 'model_chunk_start') {
              setIsStreaming(true);
              const newMessage: ChatMessage = {
                id: messageId,
                sender: 'model',
                text: payload.chunk,
              };
              currentMessageRef.current = newMessage;
              updatedMessages.push(newMessage);
              forceScroll = true; // <-- Force scroll on new message start
            } else if (payload.type === 'model_chunk_append' && currentMessageRef.current) {
              setIsStreaming(true);
              updatedMessages = updatedMessages.map((msg) =>
                msg.id === currentMessageRef.current!.id
                  ? { ...msg, text: msg.text + payload.chunk }
                  : msg
              );
              // Do not force scroll for appended chunks
            } else if (payload.type === 'model_response_end') {
              setIsWaitingForModel(false);
              setIsStreaming(false);
              currentMessageRef.current = null;
              // Do not force scroll for end event
            } else if (payload.type === 'error') {
              newError = payload.message ?? 'An unknown error occurred during AI processing.';
              updatedMessages.push({ id: messageId, sender: 'error', text: `Error: ${newError}` });
              setIsWaitingForModel(false);
              setIsStreaming(false);
              currentMessageRef.current = null;
              forceScroll = true; // <-- Force scroll for errors
            } else {
              // Only log unknown types if they are not 'request_snapshot'
              if (payload.type !== 'request_snapshot') {
                console.warn('Received unknown payload type via Realtime:', payload.type);
              }
            }
            return updatedMessages;
          });

          // Explicitly scroll after state update, using the force flag
          setTimeout(() => {
            chatWindowRef.current?.scrollToBottom(forceScroll);
          }, 0);

          // Update error state outside the message update if needed
          if (payload.type === 'error' || payload.type === 'model_response_end') {
            setChatError(newError);
          }
        })
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log(
              `[ChatContainer] Realtime SUBSCRIBED.` // Removed socket check here
            ); // Log connection status
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setChatError(`Realtime connection failed: ${status}`);
            setChatMessages((prev) => [
              ...prev,
              { id: uuidv4(), sender: 'error', text: `Realtime connection failed: ${status}` },
            ]);
          }
        });

      channelRef.current = channel; // Store channel in ref
    } else {
      // Chat closed or user/traceId missing
      if (isInitialAnalysisRequested) {
        // Only log/reset if it was true
        console.log('[ChatContainer] Resetting isInitialAnalysisRequested (Chat Closed/Invalid).');
        setIsInitialAnalysisRequested(false);
      }
      if (isSocketConnected) {
        disconnectSocket();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }

    // Cleanup function
    return () => {
      if (isSocketConnected) {
        disconnectSocket();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // Rerun when chat opens/closes, or when userId/traceId become available/change
  }, [isChatOpen, userId, traceId, isSocketConnected, connectSocket, disconnectSocket]);

  // --- Effect to reset flag only when traceId changes ---
  useEffect(() => {
    // Store initial traceId or check if it changed
    if (traceId !== previousTraceIdRef.current) {
      console.log(
        `[ChatContainer] traceId changed from ${previousTraceIdRef.current} to ${traceId}. Resetting analysis flag.`
      );
      analysisSentForCurrentTraceRef.current = false; // Reset flag on trace change
      previousTraceIdRef.current = traceId; // Update the ref for next comparison
    }
  }, [traceId]);

  // Helper function to send start_analysis (Remove model details)
  const sendStartAnalysis = useCallback(() => {
    // Conditions checked in the effect below
    console.log(`[ChatContainer] Sending start_analysis for trace ${traceId}`);
    setChatMessages([]); // Clear previous messages
    analysisSentForCurrentTraceRef.current = true; // Mark as sent for this trace
    setChatError(null);
    setIsWaitingForModel(false);
    // Update initial system message
    if (chatMessages.length === 0) {
      setChatMessages([{ id: uuidv4(), sender: 'system', text: 'Connecting to AI analysis...' }]);
    }
    sendRawSocketMessage({
      type: 'start_analysis',
      userId: userId,
      traceId: traceId,
    });
  }, [userId, traceId, sendRawSocketMessage]);

  // --- Effect to send initial analysis request when socket connects ---
  useEffect(() => {
    if (
      isChatOpen &&
      isSocketConnected &&
      userId &&
      traceId &&
      !analysisSentForCurrentTraceRef.current // Only send if not already sent for this trace
    ) {
      sendStartAnalysis();
    }
    // Dependency array includes all conditions checked
  }, [isChatOpen, isSocketConnected, userId, traceId, sendStartAnalysis]);

  // Effect to handle initial connection/ack from WebSocket
  useEffect(() => {
    // Handle the ack message "Requesting initial analysis..."
    if (!lastSocketMessage) return;

    console.log('[ChatContainer] Processing lastSocketMessage:', lastSocketMessage);

    if (lastSocketMessage.type === 'server_ready') {
      console.log(
        '[ChatContainer] Received server_ready message from WebSocket:',
        lastSocketMessage.message
      );
      // Potentially update a system message here if needed, or just log
      // For now, we expect start_analysis to be sent by another effect
    } else if (lastSocketMessage.type === 'connection_ack') {
      console.log('[ChatContainer] WebSocket ACK received:', lastSocketMessage.message);
      setChatMessages((prev) => {
        const connectingMsgIndex = prev.findIndex(
          (msg) =>
            msg.text === 'Connecting to analysis service...' ||
            msg.text === 'Connecting to AI analysis...'
        );
        if (connectingMsgIndex !== -1) {
          const updated = [...prev];
          // Update the text to reflect the server is starting
          updated[connectingMsgIndex] = {
            ...updated[connectingMsgIndex],
            text: lastSocketMessage.message,
          };
          return updated;
        } else {
          // Avoid adding duplicate messages if already present
          if (!prev.some((msg) => msg.text === lastSocketMessage.message)) {
            return [...prev, { id: uuidv4(), sender: 'system', text: lastSocketMessage.message }];
          }
          return prev;
        }
      });
      setIsWaitingForModel(true);
      setChatError(null);
    } else if (lastSocketMessage?.type === 'waiting_for_model') {
      // console.log("WebSocket received waiting_for_model");
      setIsWaitingForModel(true);
      setChatError(null);
    } else if (lastSocketMessage.type === 'error') {
      // console.error("WebSocket direct error message:", lastSocketMessage.message); // REMOVE
      const errorMsg = lastSocketMessage.message ?? 'Unknown WebSocket error';
      setChatMessages((prev) => [
        ...prev,
        { id: uuidv4(), sender: 'error', text: `Error: ${errorMsg}` },
      ]);
      setChatError(errorMsg);
      setIsWaitingForModel(false);
    } else if (
      lastSocketMessage.type !== 'connection_ack' &&
      lastSocketMessage.type !== 'server_ready'
    ) {
      console.log(
        '[ChatContainer] Received other/unexpected direct WS message:',
        lastSocketMessage
      );
    }
  }, [lastSocketMessage]);

  // Effect to handle raw socket errors (connection failures, etc.)
  useEffect(() => {
    if (socketErrorEvent) {
      // Check for ignorable 1006 closure FIRST
      if (socketErrorEvent instanceof CloseEvent && socketErrorEvent.code === 1006) {
        console.warn(
          '[ChatContainer] WebSocket CloseEvent 1006 (Abnormal Closure) detected by socketErrorEvent handler. Usually means server dropped connection without a clean handshake.'
        );
        setIsWaitingForModel(false);
        return;
      }

      // If it wasn't the ignorable 1006 error, proceed to handle other errors
      console.log(
        '[ChatContainer] socketErrorEvent handler processing other error:',
        socketErrorEvent
      );
      let errorMsg = 'WebSocket connection error.';

      if (socketErrorEvent instanceof Error) {
        errorMsg = socketErrorEvent.message;
      } else if (typeof socketErrorEvent === 'object' && socketErrorEvent !== null) {
        if ('code' in socketErrorEvent) {
          if ('reason' in socketErrorEvent && socketErrorEvent.reason) {
            errorMsg = `WebSocket closed: ${socketErrorEvent.reason} (Code: ${socketErrorEvent.code})`;
          } else {
            errorMsg = `WebSocket closed (Code: ${socketErrorEvent.code})`;
          }
        } else if ('type' in socketErrorEvent) {
          errorMsg = `WebSocket error event: ${socketErrorEvent.type}`;
        }
      }

      // Add the non-ignorable error to the chat messages
      const errorId = uuidv4();
      // console.log("[ChatContainer] Adding error to chat messages:", errorMsg); // REMOVE
      setChatMessages((prev) => [...prev, { id: errorId, sender: 'error', text: errorMsg }]);

      setChatError(errorMsg);
      setIsWaitingForModel(false);
    }
  }, [socketErrorEvent]);

  // handleSendMessage (Add userId and traceId to user_prompt)
  const handleSendMessage = useCallback(
    (prompt: string) => {
      if (prompt.trim() && isSocketConnected && userId && traceId) {
        const newUserMessage: ChatMessage = { id: uuidv4(), sender: 'user', text: prompt };
        setChatMessages((prev) => [...prev, newUserMessage]);
        setIsWaitingForModel(true);
        setChatError(null);
        setIsStreaming(false);

        setTimeout(() => {
          chatWindowRef.current?.scrollToBottom(true);
        }, 0);

        const historyToSend = chatMessages
          .filter((msg) => msg.sender === 'user' || msg.sender === 'model')
          // For now send the entire history
          // .slice(-10)
          .map((msg) => ({ sender: msg.sender, text: msg.text }));

        console.log(historyToSend);

        sendRawSocketMessage({
          type: 'user_prompt',
          prompt: prompt,
          userId: userId,
          traceId: traceId,
          history: historyToSend,
        });
      } else if (!isSocketConnected) {
        setChatError('Cannot send message: WebSocket not connected.');
        setChatMessages((prev) => [
          ...prev,
          { id: uuidv4(), sender: 'error', text: 'Cannot send message: WebSocket not connected.' },
        ]);
      } else if (!userId) {
        setChatError('Cannot send message: User not identified.');
        setChatMessages((prev) => [
          ...prev,
          { id: uuidv4(), sender: 'error', text: 'Cannot send message: User not identified.' },
        ]);
      }
    },
    [isSocketConnected, sendRawSocketMessage, userId, traceId, chatMessages]
  );

  // Only render button if traceId and userId are available
  if (!traceId || !userId) {
    // Optionally show a message indicating chat is unavailable
    return null;
  }

  return (
    <>
      <FloatingChatButton onClick={() => setIsChatOpen((prev) => !prev)} />
      {isChatOpen && (
        <ChatWindow
          ref={chatWindowRef}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={chatMessages}
          sendMessage={handleSendMessage}
          isLoading={isWaitingForModel}
          isStreaming={isStreaming}
          error={chatError}
        />
      )}
    </>
  );
};
