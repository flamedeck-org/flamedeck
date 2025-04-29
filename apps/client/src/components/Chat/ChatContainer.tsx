import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTraceAnalysisSocket } from '@/hooks/useTraceAnalysisSocket';
import { FloatingChatButton, ChatWindow, type ChatMessage, type ChatWindowHandle } from '@/components/Chat';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth to get user ID
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client
import { RealtimeChannel } from '@supabase/supabase-js'; // Import type for channel ref
import { HumanMessage, AIMessage as LangChainAIMessage, BaseMessage } from "@langchain/core/messages"; // Import Langchain message types if needed for type checking history mapping

interface ChatContainerProps {
  traceId: string | null; // Trace ID is needed to start analysis
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ traceId }) => {
  const { user } = useAuth(); // Get user from Auth context
  const userId = user?.id;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentMessageRef = useRef<ChatMessage | null>(null); // Ref to track current streaming message
  const chatWindowRef = useRef<ChatWindowHandle>(null); // <-- Create ref for ChatWindow

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
            // console.log("Chat opened, connecting WebSocket..."); // REMOVE
            connectSocket();
        }

        // Subscribe to Realtime Channel
        const channelName = `private-chat-results-${userId}`;
        // console.log(`Subscribing to Realtime channel: ${channelName}`); // REMOVE
        channel = supabase.channel(channelName, {
            config: {
                broadcast: { self: false }, // Don't receive our own broadcasts if ever needed
            },
        });

        channel
            .on('broadcast', { event: 'ai_response' }, (message) => {
                // console.log('[ChatContainer] Received Realtime Payload:', message.payload); // REMOVE (or keep if needed)
                const payload = message.payload;
                let newError: string | null = null;
                let forceScroll = false; // Flag to determine if scroll should be forced

                setChatMessages(prevMessages => {
                    const messageId = uuidv4(); // Generate ID within state update if needed
                    let updatedMessages = [...prevMessages];

                    if (payload.type === 'model_chunk_start') {
                        setIsStreaming(true);
                        const newMessage: ChatMessage = { id: messageId, sender: 'model', text: payload.chunk };
                        currentMessageRef.current = newMessage;
                        updatedMessages.push(newMessage);
                        forceScroll = true; // <-- Force scroll on new message start
                    } else if (payload.type === 'model_chunk_append' && currentMessageRef.current) {
                        setIsStreaming(true);
                        updatedMessages = updatedMessages.map(msg => 
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
                        console.warn('Received unknown payload type via Realtime:', payload.type);
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
                    // console.log(`Successfully subscribed to Realtime channel: ${channelName}`); // REMOVE
                    if (isSocketConnected) {
                         sendStartAnalysis();
                    }
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    // console.error(`Realtime subscription error on ${channelName}:`, status, err); // REMOVE
                    setChatError(`Realtime connection failed: ${status}`);
                    setChatMessages(prev => [...prev, { id: uuidv4(), sender: 'error', text: `Realtime connection failed: ${status}` }]);
                }
            });
            
        channelRef.current = channel; // Store channel in ref

    } else {
        // Chat closed or user/traceId missing
        if (isSocketConnected) {
            // console.log("Chat closed/invalid, disconnecting WebSocket..."); // REMOVE
            disconnectSocket();
        }
        if (channelRef.current) {
            // console.log("Chat closed/invalid, unsubscribing from Realtime..."); // REMOVE
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
            // console.log("Component unmounting, unsubscribing from Realtime..."); // REMOVE
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
    };
  // Rerun when chat opens/closes, or when userId/traceId become available/change
  }, [isChatOpen, userId, traceId, isSocketConnected, connectSocket, disconnectSocket]);

  // Helper function to send start_analysis
  const sendStartAnalysis = useCallback(() => {
    if (isSocketConnected && userId && traceId) {
        // console.log("WebSocket connected, sending start_analysis..."); // REMOVE
        // Clear previous errors/waiting state on connect/reconnect
        setChatError(null);
        setIsWaitingForModel(false);
        // Add system message only if it's the first message
        if (chatMessages.length === 0) {
             setChatMessages([{ id: uuidv4(), sender: 'system', text: 'Connecting to analysis service...' }]);
        }
        sendRawSocketMessage({ 
            type: "start_analysis", 
            userId: userId, // Send userId
            modelProvider: "openai", // Hardcoded for now
            modelName: "gpt-4o-mini", 
            traceId: traceId 
        });
    }
  }, [isSocketConnected, userId, traceId, sendRawSocketMessage, chatMessages.length]);

  // Effect to handle initial connection/ack from WebSocket
  useEffect(() => {
    // Completely remove handling for 'connection_ack' message display
    /*
    if (lastSocketMessage?.type === 'connection_ack') {
        console.log("WebSocket ACK received:", lastSocketMessage.message);
        // REMOVED: setChatMessages(prev => [...prev, { id: uuidv4(), sender: 'system', text: lastSocketMessage.message ?? 'Analysis service ready.' }]);
        setIsWaitingForModel(false); // Still ensure waiting is false
    } else */
    
    // Keep handling for other direct WS messages like waiting/error
    if (lastSocketMessage?.type === 'waiting_for_model') {
        // console.log("WebSocket received waiting_for_model"); // REMOVE
        setIsWaitingForModel(true);
        setChatError(null); 
    } else if (lastSocketMessage?.type === 'error') {
        // console.error("WebSocket direct error message:", lastSocketMessage.message); // REMOVE
        const errorMsg = lastSocketMessage.message ?? "Unknown WebSocket error";
        setChatMessages(prev => [...prev, { id: uuidv4(), sender: 'error', text: `Error: ${errorMsg}` }]);
        setChatError(errorMsg);
        setIsWaitingForModel(false);
    } else if (lastSocketMessage && lastSocketMessage.type !== 'connection_ack') {
        // Log any other unexpected direct message types except the ignored ack
        // console.log("[ChatContainer] Received other direct WS message:", lastSocketMessage); // REMOVE
    }
  }, [lastSocketMessage]);

  // Effect to handle raw socket errors (connection failures, etc.)
  useEffect(() => {
    if (socketErrorEvent) {
        // --- Specific Debug Logging --- 
        console.log("[ChatContainer] socketErrorEvent occurred. Type:", typeof socketErrorEvent, "Instance of CloseEvent:", socketErrorEvent instanceof CloseEvent, "Event:", socketErrorEvent);
        let eventCode = (socketErrorEvent as any)?.code; // Attempt to get code
        console.log("[ChatContainer] Event code (if available):", eventCode);
        // -------------------------------

        // Check for ignorable 1006 closure FIRST
        if (socketErrorEvent instanceof CloseEvent && socketErrorEvent.code === 1006) {
            console.log("[ChatContainer] Handling: Ignoring ignorable CloseEvent (1006)."); // LOG: Handling path
            setIsWaitingForModel(false); 
            return; 
        }

        // If it wasn't the ignorable 1006 error, proceed to handle other errors
        console.log("[ChatContainer] Handling: Processing as potentially displayable error."); // LOG: Handling path
        let errorMsg = "WebSocket connection error."; 

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
        console.log("[ChatContainer] Adding error to chat messages:", errorMsg); // LOG: Adding to UI
        setChatMessages(prev => [...prev, { id: errorId, sender: 'error', text: errorMsg }]);
        
        setChatError(errorMsg); 
        setIsWaitingForModel(false); 
    }
  }, [socketErrorEvent]);

  // handleSendMessage: Set waiting state immediately
  const handleSendMessage = useCallback((prompt: string) => {
    if (prompt.trim() && isSocketConnected && userId && traceId) {
      const newUserMessage: ChatMessage = { id: uuidv4(), sender: 'user', text: prompt };
      setChatMessages(prev => [...prev, newUserMessage]);
      setIsWaitingForModel(true); 
      setChatError(null); 
      setIsStreaming(false);

      // Force scroll when user sends a message
      setTimeout(() => {
        chatWindowRef.current?.scrollToBottom(true); // Pass true to force
      }, 0);

      // Prepare history (e.g., last 10 user/model messages)
      const historyToSend = chatMessages
        .filter(msg => msg.sender === 'user' || msg.sender === 'model') // Only user/model turns
        .slice(-10) // Limit history size
        .map(msg => ({ sender: msg.sender, text: msg.text })); // Send simplified history

      sendRawSocketMessage({
          type: 'user_prompt',
          prompt: prompt,
          userId: userId, 
          traceId: traceId, 
          history: historyToSend
      });
    } else if (!isSocketConnected) {
        setChatError("Cannot send message: WebSocket not connected.");
        setChatMessages(prev => [...prev, { id: uuidv4(), sender: 'error', text: 'Cannot send message: WebSocket not connected.' }]);
    } else if (!userId) {
        setChatError("Cannot send message: User not identified.");
        setChatMessages(prev => [...prev, { id: uuidv4(), sender: 'error', text: 'Cannot send message: User not identified.' }]);
    }
  }, [isSocketConnected, sendRawSocketMessage, userId, traceId, chatMessages]);

  // Only render button if traceId and userId are available
  if (!traceId || !userId) {
      // Optionally show a message indicating chat is unavailable
      return null; 
  }

  return (
    <>
      <FloatingChatButton onClick={() => setIsChatOpen(prev => !prev)} />
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