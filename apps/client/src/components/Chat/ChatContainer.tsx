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

interface ChatContainerProps {
  traceId: string | null;
}

const DEBUG_LOG_PREFIX = '[ChatContainerDebug]';

export const ChatContainer: React.FC<ChatContainerProps> = memo(({ traceId }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentMessageRef = useRef<ChatMessage | null>(null);
  const chatWindowRef = useRef<ChatWindowHandle>(null);

  const traceAnalysisMutation = useTraceAnalysisApi();

  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null); // Still useful for non-message errors or global state
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isWaitingForModelResponse, setIsWaitingForModelResponse] = useState<boolean>(false);

  const currentSessionId = useMemo(() => uuidv4(), []);

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
            updatedMessages = updatedMessages.map((msg) =>
              msg.id === currentMessageRef.current!.id
                ? { ...msg, text: msg.text + payload.chunk }
                : msg
            );
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

  if (!traceId || !userId) {
    return null;
  }

  const suggestionPrompts = [
    'Analyze this trace',
    'Show me the top 10 slowest functions',
  ];

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
          isLoading={traceAnalysisMutation.isPending || isWaitingForModelResponse || isStreaming}
          isStreaming={isStreaming} // Retain for specific stream visual cues if needed beyond general loading
          suggestionPrompts={suggestionPrompts}
        />
      )}
    </>
  );
});
