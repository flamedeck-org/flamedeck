import * as React from 'react';
import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X } from 'lucide-react';
import { ToolMessageItem } from './ToolMessageItem';
import { MessageSquareText } from 'lucide-react';

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
}

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  sendMessage: (prompt: string) => void; // Function to send a user prompt
  isLoading: boolean; // To indicate if the model is processing
  isStreaming: boolean; // Indicates if chunks are actively arriving
  error: string | null; // To display any connection/processing errors
  suggestionPrompts?: string[]; // <-- Add new prop for suggestion prompts
}

// Define handle type for the ref
export interface ChatWindowHandle {
  scrollToBottom: (force?: boolean) => void;
}

// Use forwardRef to accept a ref from the parent
export const ChatWindow = forwardRef<ChatWindowHandle, ChatWindowProps>(
  ({ isOpen, onClose, messages, sendMessage, isLoading, isStreaming, error, suggestionPrompts }, ref) => {
    const [input, setInput] = useState('');
    const internalScrollAreaRef = useRef<HTMLDivElement>(null);
    const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
    const userHasScrolledUpRef = useRef(userHasScrolledUp); // <-- Ref to track the value

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
      <div className="fixed bottom-24 right-6 w-[32rem] h-[calc(100vh-15rem)] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl flex flex-col z-40 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center pl-3 pr-3 pt-1 pb-1 border-b dark:border-gray-700 bg-background">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">AI Trace Analysis</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close Chat">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Message Area */}
        <ScrollArea className="flex-grow p-3" ref={internalScrollAreaRef}>
          <div className="space-y-3">
            {messages.length === 0 && !isLoading && !error && (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <MessageSquareText className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  Ready to analyze your trace!
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Ask a question or use one of the suggestions below to get started.
                </p>
              </div>
            )}
            {messages.map((msg) => {
              if (msg.sender === 'tool') {
                return <ToolMessageItem key={msg.id} message={msg} />;
              }
              // Existing rendering for user, model, system, error messages
              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-2 rounded-lg text-sm whitespace-pre-wrap ${msg.sender === 'user'
                      ? 'bg-blue-500 text-white'
                      : msg.sender === 'error'
                        ? 'bg-red-100 text-red-700 border border-red-300'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                      }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
            {isLoading && !isStreaming && (
              <div className="flex justify-start">
                <div className="p-2 rounded-lg text-sm bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100 animate-pulse">
                  Thinking...
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-2 rounded-lg text-sm bg-red-100 text-red-700 border border-red-300">
                  Error: {error}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Suggestion Bubbles Area */}
        {suggestionPrompts && suggestionPrompts.length > 0 && messages.length === 0 && (
          <div className="p-2 border-t dark:border-gray-700 flex flex-wrap gap-2 justify-center bg-background">
            {suggestionPrompts.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                onClick={() => handleSuggestionClick(prompt)}
                className="dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                {prompt}
              </Button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="p-3 border-t dark:border-gray-700 flex items-center space-x-2 bg-background chat-input-area">
          <Input
            type="text"
            placeholder="Ask about the trace..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-grow dark:bg-gray-600 dark:border-gray-500 dark:text-white"
          />
          <Button
            onClick={handleSend}
            size="icon"
            disabled={isLoading || !input.trim()}
            aria-label="Send Message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }
);

// Add display name for React DevTools
ChatWindow.displayName = 'ChatWindow';
