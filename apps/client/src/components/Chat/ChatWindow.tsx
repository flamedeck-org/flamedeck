import * as React from 'react';
import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X } from 'lucide-react';
import { ToolMessageItem } from './ToolMessageItem';
import { MessageSquareText } from 'lucide-react';

import { ConversationListView } from './ConversationListView';
import { ActiveChatView } from './ActiveChatView';
import type { ChatSession } from '@/lib/api/chatHistory';

// Define message types for clarity
export interface ChatMessage {
  id: string; // Use unique IDs for keys
  sender: 'user' | 'model' | 'system' | 'error' | 'tool'; // Added 'tool' sender
  text: string; // Primary textual content, or placeholder like "Running tool..."

  // Optional fields for 'tool' sender messages
  toolName?: string;
  toolCallId?: string; // Store the original tool_call_id from the LLM
  toolStatus?: 'running' | 'success' | 'error' | 'success_with_warning';
  resultType?: 'text' | 'image'; // If it's a result message
  imageUrl?: string; // If resultType is 'image'
  timestamp?: number; // Keep existing optional timestamp
  errorType?: string; // To categorize errors, e.g., 'limit_exceeded', 'internal_error'
}

interface ChatWindowProps {
  traceId: string;
  onClose: () => void;
  sessions: ChatSession[];
  isLoadingSessions: boolean;
  onSessionsUpdate: (sessions: ChatSession[]) => void;
  onSelectSession: (sessionId: string) => void;
  onStartNewChat: () => void;
  onRefetchSessions: () => Promise<void>;
  messages: ChatMessage[];
  sendMessage: (prompt: string) => void; // Function to send a user prompt
  isLoading: boolean; // To indicate if the model is processing
  isStreaming: boolean; // Indicates if chunks are actively arriving
  suggestionPrompts?: string[]; // <-- Add new prop for suggestion prompts
}

// Define handle type for the ref
export interface ChatWindowHandle {
  scrollToBottom: (force?: boolean) => void;
}

type ViewState =
  | { type: 'conversation-list' }
  | { type: 'active-chat'; sessionId: string; isNewSession: boolean };

// Use forwardRef to accept a ref from the parent
export const ChatWindow = forwardRef<ChatWindowHandle, ChatWindowProps>(
  (
    {
      traceId,
      onClose,
      sessions,
      isLoadingSessions,
      onSessionsUpdate,
      onSelectSession,
      onStartNewChat,
      onRefetchSessions,
      messages,
      sendMessage,
      isLoading,
      isStreaming,
      suggestionPrompts
    },
    ref
  ) => {
    const [input, setInput] = useState('');
    const [currentView, setCurrentView] = useState<ViewState>({ type: 'conversation-list' });
    const internalScrollAreaRef = useRef<HTMLDivElement>(null);
    const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
    const userHasScrolledUpRef = useRef(userHasScrolledUp); // <-- Ref to track the value


    const SCROLL_THRESHOLD = 50; // Pixels from bottom to consider "at bottom"

    // Determine initial view based on sessions
    useEffect(() => {
      if (!isLoadingSessions && sessions.length === 0) {
        // No existing sessions, start a new chat immediately
        setCurrentView({ type: 'active-chat', sessionId: 'new', isNewSession: true });
      }
    }, [isLoadingSessions, sessions.length]);

    // --- Scroll Handler ---
    const handleScroll = useCallback(() => {
      const viewport = internalScrollAreaRef.current?.querySelector(
        ':scope > [data-radix-scroll-area-viewport]'
      ) as HTMLElement | null;
      if (viewport) {
        const { scrollTop, scrollHeight, clientHeight } = viewport;
        const isAtBottom = scrollHeight - scrollTop - clientHeight <= SCROLL_THRESHOLD;
        const newUserScrolledUpState = !isAtBottom;
        if (userHasScrolledUpRef.current !== newUserScrolledUpState) {
          setUserHasScrolledUp(newUserScrolledUpState);
          userHasScrolledUpRef.current = newUserScrolledUpState;
        }
      }
    }, []);

    // --- Imperative Handle ---
    useImperativeHandle(ref, () => ({
      scrollToBottom: (force = false) => {
        // This will be handled by the ActiveChatView when it's active
        // For now, we'll implement a basic version
        if (internalScrollAreaRef.current) {
          const viewport = internalScrollAreaRef.current.querySelector(
            ':scope > [data-radix-scroll-area-viewport]'
          ) as HTMLElement;
          if (viewport) {
            setTimeout(() => {
              const vp = internalScrollAreaRef.current?.querySelector(
                ':scope > [data-radix-scroll-area-viewport]'
              ) as HTMLElement | null;
              if (vp) {
                vp.scrollTo({ top: vp.scrollHeight, behavior: force ? 'auto' : 'smooth' });
              }
            }, 0);
          }
        }
      },
    }));

    // Existing useEffect to scroll on major message array changes (optional, but can help)
    useEffect(() => {
      if (internalScrollAreaRef.current) {
        setTimeout(() => {
          if (internalScrollAreaRef.current) {
            internalScrollAreaRef.current.scrollTo({
              top: internalScrollAreaRef.current.scrollHeight,
              behavior: 'smooth',
            });
          }
        }, 0);
      }
    }, [messages]); // Keep dependency on messages array ref

    // --- Effect to attach scroll listener manually ---
    useEffect(() => {
      const viewport = internalScrollAreaRef.current?.querySelector(
        ':scope > [data-radix-scroll-area-viewport]'
      ) as HTMLElement | null;

      if (viewport) {
        viewport.addEventListener('scroll', handleScroll);

        // Cleanup function to remove listener
        return () => {
          viewport.removeEventListener('scroll', handleScroll);
        };
      }
    }, [handleScroll]); // Rerun if handleScroll identity changes (it shouldn't with useCallback)

    const handleSelectSession = (sessionId: string) => {
      setCurrentView({ type: 'active-chat', sessionId, isNewSession: false });
      onSelectSession(sessionId); // Call the parent's session handler
    };

    const handleStartNewChat = () => {
      const newSessionId = 'new';
      setCurrentView({ type: 'active-chat', sessionId: newSessionId, isNewSession: true });
      onStartNewChat(); // Call the parent's new session handler
    };

    const handleBackToList = () => {
      setCurrentView({ type: 'conversation-list' });
      // Refetch sessions to ensure we have the latest conversations
      onRefetchSessions();
    };

    const handleSend = () => {
      if (input.trim() && !isLoading) {
        sendMessage(input.trim());
        setInput('');
      }
    };

    const handleInputChange = (value: string) => {
      setInput(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Prevent newline in input
        handleSend();
      }
    };

    return (
      <div className="fixed top-16 left-0 right-0 bottom-0 md:bottom-24 md:right-6 md:top-auto md:left-auto w-full h-[calc(100vh-4rem)] md:w-[32rem] md:h-[calc(100vh-15rem)] bg-background/95 backdrop-blur-xl border-0 md:border border-border/50 md:rounded-2xl shadow-2xl flex flex-col z-40 overflow-hidden">
        {currentView.type === 'conversation-list' ? (
          <ConversationListView
            sessions={sessions}
            isLoading={isLoadingSessions}
            onSelectSession={handleSelectSession}
            onStartNewChat={handleStartNewChat}
          />
        ) : (
          <ActiveChatView
            ref={ref}
            messages={messages}
            input={input}
            onInputChange={handleInputChange}
            onSend={handleSend}
            onKeyDown={handleKeyDown}
            isLoading={isLoading}
            isStreaming={isStreaming}
            suggestionPrompts={suggestionPrompts}
            onBack={handleBackToList}
            isNewSession={currentView.isNewSession}
            sendMessage={sendMessage}
          />
        )}

        {/* Close button - positioned differently for mobile vs desktop */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close Chat"
          className="absolute top-4 right-4 md:top-2 md:right-2 h-8 w-8 md:h-6 md:w-6 p-0 hover:bg-background/80 z-50 text-muted-foreground hover:text-foreground"
        >
          ✕
        </Button>
      </div>
    );
  }
);

// Add display name for React DevTools
ChatWindow.displayName = 'ChatWindow';
