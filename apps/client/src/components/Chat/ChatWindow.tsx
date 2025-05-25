import * as React from 'react';
import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X } from 'lucide-react';
import { ToolMessageItem } from './ToolMessageItem';
import { MessageSquareText } from 'lucide-react';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';

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
  isOpen: boolean;
  onClose: () => void;
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

// Use forwardRef to accept a ref from the parent
export const ChatWindow = forwardRef<ChatWindowHandle, ChatWindowProps>(
  (
    { isOpen, onClose, messages, sendMessage, isLoading, isStreaming, suggestionPrompts },
    ref
  ) => {
    const [input, setInput] = useState('');
    const internalScrollAreaRef = useRef<HTMLDivElement>(null);
    const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
    const userHasScrolledUpRef = useRef(userHasScrolledUp); // <-- Ref to track the value
    const { openModal: openUpgradeModal } = useUpgradeModal();

    const SCROLL_THRESHOLD = 50; // Pixels from bottom to consider "at bottom"

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
        if (!force && userHasScrolledUpRef.current) {
          return;
        }
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
                if (force) {
                  setUserHasScrolledUp(false);
                  userHasScrolledUpRef.current = false;
                }
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

    const handleSend = () => {
      if (input.trim() && !isLoading) {
        sendMessage(input.trim());
        setInput('');
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Prevent newline in input
        handleSend();
      }
    };

    if (!isOpen) {
      return null;
    }

    const handleSuggestionClick = (prompt: string) => {
      sendMessage(prompt);
      setInput(''); // Clear input after sending suggestion
    };

    return (
      <div className="fixed bottom-24 right-6 w-[32rem] h-[calc(100vh-15rem)] bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl flex flex-col z-40 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-border/50 bg-gradient-to-r from-background/90 to-background/70 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-r from-red-500 to-yellow-500 rounded-lg">
              <MessageSquareText className="h-4 w-4 text-white" />
            </div>
            <h3 className="font-bold text-foreground">AI Trace Analysis</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close Chat" className="h-8 w-8 p-0 hover:bg-background/80">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Message Area */}
        <ScrollArea className="flex-grow p-4" ref={internalScrollAreaRef}>
          <div className="space-y-4">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="p-4 bg-gradient-to-br from-red-500/10 to-yellow-500/10 border border-red-500/20 rounded-2xl mb-4">
                  <MessageSquareText className="w-8 h-8 text-red-500 mx-auto" />
                </div>
                <p className="text-lg font-bold text-foreground mb-2">
                  Ready to analyze your trace!
                </p>
                <p className="text-sm text-muted-foreground">
                  Ask a question or use one of the suggestions below to get started.
                </p>
              </div>
            )}
            {messages.map((msg) => {
              const isLimitError =
                msg.sender === 'error' &&
                ['limit_exceeded', 'lifetime_analyses'].includes(msg.errorType);

              if (msg.sender === 'tool') {
                return <ToolMessageItem key={msg.id} message={msg} />;
              }
              // Enhanced rendering for user, model, system, error messages
              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-xl text-sm whitespace-pre-wrap break-words shadow-sm ${msg.sender === 'user'
                      ? 'bg-primary text-primary-foreground shadow-primary/25'
                      : msg.sender === 'model'
                        ? 'bg-muted/80 backdrop-blur-sm text-foreground border border-border/50'
                        : msg.sender === 'error'
                          ? isLimitError
                            ? 'bg-gradient-to-br from-red-50/80 to-yellow-50/80 dark:from-red-950/30 dark:to-yellow-950/30 border border-red-200/60 dark:border-red-800/60 text-foreground backdrop-blur-sm'
                            : 'bg-red-50/90 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 backdrop-blur-sm'
                          : 'bg-muted/80 backdrop-blur-sm text-foreground border border-border/50'
                      }`}
                  >
                    {msg.text}
                    {msg.sender === 'error' && isLimitError && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openUpgradeModal();
                        }}
                        className="mt-3 ml-auto block bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                      >
                        Upgrade to Pro
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {isLoading && !isStreaming && (
              <div className="flex justify-start">
                <div className="p-3 rounded-xl text-sm bg-muted/80 backdrop-blur-sm text-foreground border border-border/50 animate-pulse">
                  Thinking...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Suggestion Bubbles Area */}
        {suggestionPrompts && suggestionPrompts.length > 0 && messages.length === 0 && (
          <div className="p-3 border-t border-border/50 flex flex-wrap gap-2 justify-center bg-background/50 backdrop-blur-sm">
            {suggestionPrompts.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                onClick={() => handleSuggestionClick(prompt)}
                className="text-xs bg-background/80 backdrop-blur-sm border-border/60 hover:bg-muted/80 hover:border-border transition-all duration-200 hover:scale-105"
              >
                {prompt}
              </Button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-border/50 bg-background/80 backdrop-blur-sm chat-input-area">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative">
            <div className="flex items-end rounded-xl border border-border/60 bg-background/80 backdrop-blur-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 pr-10">
              <Input
                type="text"
                placeholder="Ask about the trace..."
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="flex-grow border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl"
              />
              <div className="absolute right-1 bottom-1">
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  disabled={isLoading || !input.trim()}
                  aria-label="Send Message"
                  className="h-8 w-8 rounded-full bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground disabled:from-muted disabled:to-muted"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }
);

// Add display name for React DevTools
ChatWindow.displayName = 'ChatWindow';
