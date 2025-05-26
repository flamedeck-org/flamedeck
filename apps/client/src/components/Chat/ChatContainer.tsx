import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useTraceAnalysisApi } from '@/hooks/useTraceAnalysisApi';
import {
  FloatingChatButton,
  ChatWindow,
  type ChatMessage,
  type ChatWindowHandle,
} from '@/components/Chat';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react';
import type { TraceAnalysisPayload, TraceAnalysisApiResponse } from '@/lib/api';
import { fetchChatSessions, fetchChatHistory } from '@/lib/api/chatHistory';
import type { ChatSession } from '@/lib/api/chatHistory';

interface ChatContainerProps {
  traceId: string | null;
  initialOpen?: boolean;
}

const DEBUG_LOG_PREFIX = '[ChatContainerDebug]';

export const ChatContainer: React.FC<ChatContainerProps> = memo(({ traceId, initialOpen = false }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentMessageRef = useRef<ChatMessage | null>(null);
  const chatWindowRef = useRef<ChatWindowHandle>(null);

  const traceAnalysisMutation = useTraceAnalysisApi();

  const [isChatOpen, setIsChatOpen] = useState<boolean>(initialOpen);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null); // Still useful for non-message errors or global state
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isWaitingForModelResponse, setIsWaitingForModelResponse] = useState<boolean>(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => uuidv4());
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const handleApiError = useCallback((error: any, context?: string) => {
    console.log(DEBUG_LOG_PREFIX, 'handleApiError CALLED. Context:', context, 'Error:', error?.message, 'Timestamp:', new Date().toISOString());
    const errorMsg = error?.message || `Failed to ${context || 'perform action'}.`;
    setChatMessages((prev) => {
      console.log(DEBUG_LOG_PREFIX, 'Adding error message to chatMessages via handleApiError. Message:', errorMsg);
      return [
        ...prev,
        { id: uuidv4(), sender: 'error', text: `Error: ${errorMsg}` },
      ];
    });
    setChatError(errorMsg); // Set general UI error state
    setIsStreaming(false);
    setIsWaitingForModelResponse(false);
    setTimeout(() => {
      chatWindowRef.current?.scrollToBottom(true);
    }, 0);
  }, []);

  // Function to load messages for a specific session
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    if (!userId || !traceId) return;

    setIsLoadingMessages(true);
    try {
      const messages = await fetchChatHistory(userId, traceId, sessionId);
      setChatMessages(messages);
    } catch (error) {
      console.error('Failed to load session messages:', error);
      setChatMessages([]);
      handleApiError(error, 'load session messages');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [userId, traceId, handleApiError]);

  // Function to handle session selection
  const handleSessionSelection = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    loadSessionMessages(sessionId);
  }, [loadSessionMessages]);

  // Function to start a new session
  const handleNewSession = useCallback(() => {
    const newSessionId = uuidv4();
    setCurrentSessionId(newSessionId);
    setChatMessages([]); // Clear messages for new session
  }, []);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    if (isChatOpen && userId && traceId) {
      setChatError(null); // Clear general errors when chat opens/re-focuses

      const channelName = `private-chat-results-${userId}`;
      channel = supabase.channel(channelName, { config: { broadcast: { self: false } } });

      channel.on('broadcast', { event: 'ai_response' }, (message) => {
        const payload = message.payload;
        let forceScroll = true;

        setChatMessages((prevMessages) => {
          const messageId = uuidv4();
          let updatedMessages = [...prevMessages];

          if (payload.type === 'tool_start') {
            const existingMsg = prevMessages.find((msg) => msg.id === payload.toolCallId);
            if (existingMsg) {
              updatedMessages = prevMessages.map((msg) =>
                msg.id === payload.toolCallId
                  ? {
                    ...msg,
                    sender: 'tool',
                    text: payload.message || `Running ${payload.toolName}...`,
                    toolName: payload.toolName,
                    toolStatus: 'running',
                    resultType: undefined,
                    imageUrl: undefined,
                  }
                  : msg
              );
            } else {
              updatedMessages.push({
                id: payload.toolCallId || messageId,
                sender: 'tool',
                text: payload.message || `Running ${payload.toolName}...`,
                toolCallId: payload.toolCallId,
                toolName: payload.toolName,
                toolStatus: 'running',
              });
            }
            setIsStreaming(false);
            setIsWaitingForModelResponse(true);
          } else if (payload.type === 'tool_result') {
            updatedMessages = prevMessages.map((msg) =>
              msg.id === payload.toolCallId
                ? {
                  ...msg,
                  sender: 'tool',
                  text: payload.textContent || `${payload.toolName} completed.`,
                  toolStatus: payload.status as ChatMessage['toolStatus'],
                  resultType: payload.resultType as ChatMessage['resultType'],
                  imageUrl: payload.imageUrl,
                }
                : msg
            );
            if (!prevMessages.some((msg) => msg.id === payload.toolCallId)) {
              updatedMessages.push({
                id: payload.toolCallId || messageId,
                sender: 'tool',
                text: payload.textContent || `${payload.toolName} completed.`,
                toolCallId: payload.toolCallId,
                toolName: payload.toolName,
                toolStatus: payload.status as ChatMessage['toolStatus'],
                resultType: payload.resultType as ChatMessage['resultType'],
                imageUrl: payload.imageUrl,
              });
            }
            setIsStreaming(false);
            setIsWaitingForModelResponse(true);
          } else if (payload.type === 'tool_error') {
            updatedMessages = prevMessages.map((msg) =>
              msg.id === payload.toolCallId
                ? {
                  ...msg,
                  sender: 'tool',
                  text: payload.message || `Error in ${payload.toolName}.`,
                  toolStatus: 'error',
                  resultType: undefined,
                  imageUrl: undefined,
                }
                : msg
            );
            if (!prevMessages.some((msg) => msg.id === payload.toolCallId)) {
              updatedMessages.push({
                id: payload.toolCallId || messageId,
                sender: 'tool',
                text: payload.message || `Error in ${payload.toolName}.`,
                toolCallId: payload.toolCallId,
                toolName: payload.toolName,
                toolStatus: 'error',
              });
            }
            setIsStreaming(false);
            setIsWaitingForModelResponse(true);
          } else if (payload.type === 'model_chunk_start') {
            setIsStreaming(true);
            setIsWaitingForModelResponse(false);

            // Filter out empty chunks or thinking blocks
            if (!payload.chunk || payload.chunk.trim() === '') {
              return updatedMessages; // Don't create a message for empty chunks
            }

            const newMessage: ChatMessage = {
              id: messageId,
              sender: 'model',
              text: payload.chunk,
            };
            currentMessageRef.current = newMessage;
            updatedMessages.push(newMessage);
          } else if (payload.type === 'model_chunk_append' && currentMessageRef.current) {
            setIsStreaming(true);
            setIsWaitingForModelResponse(false);

            // Only append if there's actual content
            if (payload.chunk && payload.chunk.trim() !== '') {
              updatedMessages = updatedMessages.map((msg) =>
                msg.id === currentMessageRef.current!.id
                  ? { ...msg, text: msg.text + payload.chunk }
                  : msg
              );
            }
            forceScroll = false;
          } else if (payload.type === 'model_response_end') {
            setIsStreaming(false);
            setIsWaitingForModelResponse(false);
            currentMessageRef.current = null;
            forceScroll = false;
          } else if (payload.type === 'error') {
            const newError = payload.message ?? 'An unknown error occurred during AI processing.';
            updatedMessages.push({ id: messageId, sender: 'error', text: `Error: ${newError}` });
            setChatError(newError); // Set general UI error state
            setIsStreaming(false);
            setIsWaitingForModelResponse(false);
            currentMessageRef.current = null;
          } else {
            if (payload.type !== 'request_snapshot') {
              Sentry.captureMessage(`Received unknown payload type via Realtime: ${payload.type}`);
            }
          }
          return updatedMessages;
        });

        setTimeout(() => {
          chatWindowRef.current?.scrollToBottom(forceScroll);
        }, 0);
      });

      channel.on('broadcast', { event: 'chat_error' }, (message) => {
        const payload = message.payload as {
          message: string;
          error_code?: string;
          limit_type?: string;
          should_disable_input?: boolean;
        };
        let errorMessageText =
          payload.message || 'A chat limit has been reached or a chat-related error occurred.';
        let errType: string | undefined = payload.error_code;

        if (
          payload.limit_type &&
          ['lifetime_analyses', 'monthly_sessions', 'session_messages'].includes(payload.limit_type)
        ) {
          errType = payload.limit_type;
        }

        setChatMessages((prevMessages) => [
          ...prevMessages,
          {
            id: uuidv4(),
            sender: 'error',
            text: errorMessageText,
            errorType: errType,
          },
        ]);
        setIsStreaming(false);
        setIsWaitingForModelResponse(false);
        if (payload.should_disable_input) {
          Sentry.captureMessage('Server indicated input should be disabled due to chat_error.');
        }
        setTimeout(() => {
          chatWindowRef.current?.scrollToBottom(true);
        }, 0);
      });

      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          // Subscribed to Realtime
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const realtimeErrorMsg = `Realtime connection failed: ${status}`;
          setChatError(realtimeErrorMsg); // Set general UI error state
          setChatMessages((prev) => [
            ...prev,
            { id: uuidv4(), sender: 'error', text: realtimeErrorMsg },
          ]);
          Sentry.captureMessage(`Realtime channel error: ${status}`, { extra: { err } });
          setIsStreaming(false);
          setIsWaitingForModelResponse(false);
        }
      });

      channelRef.current = channel;
    } else {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isChatOpen, userId, traceId, currentSessionId]);

  const handleSendMessage = useCallback(
    async (prompt: string) => {
      console.log(DEBUG_LOG_PREFIX, 'handleSendMessage CALLED. Prompt:', prompt, 'Timestamp:', new Date().toISOString());
      if (prompt.trim() && userId && traceId && currentSessionId) {
        const newUserMessage: ChatMessage = {
          id: uuidv4(),
          sender: 'user',
          text: prompt,
          timestamp: Date.now(),
        };
        setChatMessages((prev) => [...prev, newUserMessage]);
        setChatError(null); // Clear previous general error on new message send
        setIsWaitingForModelResponse(true);

        setTimeout(() => {
          chatWindowRef.current?.scrollToBottom(true);
        }, 0);

        const payload: TraceAnalysisPayload = {
          type: 'user_prompt',
          prompt: prompt,
          userId: userId,
          traceId: traceId,
          sessionId: currentSessionId,
        };
        console.log(DEBUG_LOG_PREFIX, 'Calling mutateAsync with payload:', payload, 'Timestamp:', new Date().toISOString());
        try {
          const response = await traceAnalysisMutation.mutateAsync(payload);
          if (response?.error) {
            handleApiError({ message: response.error }, 'send message (response.error branch)');
          }
        } catch (e) {
          handleApiError(e, 'send message (catch branch)');
        }
      } else if (!userId) {
        const noUserError = 'Cannot send message: User not identified.';
        setChatMessages((prev) => [
          ...prev,
          { id: uuidv4(), sender: 'error', text: noUserError },
        ]);
        setChatError(noUserError);
        setIsWaitingForModelResponse(false);
        Sentry.captureMessage('handleSendMessage: User not identified.');
      } else if (!currentSessionId) {
        const noSessionError = 'Cannot send message: Session not initialized.';
        setChatMessages((prev) => [
          ...prev,
          { id: uuidv4(), sender: 'error', text: noSessionError },
        ]);
        setChatError(noSessionError);
        setIsWaitingForModelResponse(false);
        Sentry.captureMessage('handleSendMessage: Session not initialized.');
      }
    },
    [userId, traceId, currentSessionId, traceAnalysisMutation, handleApiError]
  );

  // Fetch sessions when opening chat
  const handleOpenChat = useCallback(async () => {
    setIsChatOpen(true);
    setIsLoadingSessions(true);
    try {
      const fetchedSessions = await fetchChatSessions(traceId);
      setSessions(fetchedSessions);
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      setSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [traceId]);

  // Function to refetch sessions (for when going back to list)
  const handleRefetchSessions = useCallback(async () => {
    if (!traceId) return;
    setIsLoadingSessions(true);
    try {
      const fetchedSessions = await fetchChatSessions(traceId);
      setSessions(fetchedSessions);
    } catch (error) {
      console.error('Failed to refresh chat sessions:', error);
      setSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [traceId]);

  const handleCloseChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  if (!traceId || !userId) {
    return null;
  }

  const suggestionPrompts = [
    'Analyze this trace',
    'Show me the top 10 slowest functions',
  ];

  return (
    <>
      <FloatingChatButton
        onClick={handleOpenChat}
        isOpen={isChatOpen}
      />
      {isChatOpen && (
        <>
          {/* Mobile backdrop - only visible on mobile */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden" onClick={handleCloseChat} />

          <ChatWindow
            ref={chatWindowRef}
            traceId={traceId}
            onClose={handleCloseChat}
            sessions={sessions}
            isLoadingSessions={isLoadingSessions}
            onSessionsUpdate={(newSessions) => setSessions(newSessions)}
            onSelectSession={handleSessionSelection}
            onStartNewChat={handleNewSession}
            onRefetchSessions={handleRefetchSessions}
            messages={chatMessages}
            sendMessage={handleSendMessage}
            isLoading={traceAnalysisMutation.isPending || isWaitingForModelResponse || isStreaming}
            isStreaming={isStreaming} // Retain for specific stream visual cues if needed beyond general loading
            suggestionPrompts={suggestionPrompts}
          />
        </>
      )}
    </>
  );
});
