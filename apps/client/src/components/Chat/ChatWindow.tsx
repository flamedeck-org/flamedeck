import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X } from "lucide-react";

// Define message types for clarity
export interface ChatMessage {
  id: string; // Use unique IDs for keys
  sender: "user" | "model" | "system" | "error";
  text: string;
}

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  sendMessage: (prompt: string) => void; // Function to send a user prompt
  isLoading: boolean; // To indicate if the model is processing
  isStreaming: boolean; // Indicates if chunks are actively arriving
  error: string | null; // To display any connection/processing errors
}

// Define handle type for the ref
export interface ChatWindowHandle {
  scrollToBottom: (force?: boolean) => void;
}

// Use forwardRef to accept a ref from the parent
export const ChatWindow = forwardRef<ChatWindowHandle, ChatWindowProps>(
  ({ isOpen, onClose, messages, sendMessage, isLoading, isStreaming, error }, ref) => {
    const [input, setInput] = useState("");
    const internalScrollAreaRef = useRef<HTMLDivElement>(null);
    const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
    const userHasScrolledUpRef = useRef(userHasScrolledUp); // <-- Ref to track the value

    const SCROLL_THRESHOLD = 50; // Pixels from bottom to consider "at bottom"

    // --- Scroll Handler ---
    const handleScroll = useCallback(() => {
      const viewport = internalScrollAreaRef.current?.querySelector(
        ":scope > [data-radix-scroll-area-viewport]"
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
            ":scope > [data-radix-scroll-area-viewport]"
          ) as HTMLElement;
          if (viewport) {
            setTimeout(() => {
              const vp = internalScrollAreaRef.current?.querySelector(
                ":scope > [data-radix-scroll-area-viewport]"
              ) as HTMLElement | null;
              if (vp) {
                vp.scrollTo({ top: vp.scrollHeight, behavior: force ? "auto" : "smooth" });
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
              behavior: "smooth",
            });
          }
        }, 0);
      }
    }, [messages]); // Keep dependency on messages array ref

    // --- Effect to attach scroll listener manually ---
    useEffect(() => {
      const viewport = internalScrollAreaRef.current?.querySelector(
        ":scope > [data-radix-scroll-area-viewport]"
      ) as HTMLElement | null;

      if (viewport) {
        viewport.addEventListener("scroll", handleScroll);

        // Cleanup function to remove listener
        return () => {
          viewport.removeEventListener("scroll", handleScroll);
        };
      }
    }, [handleScroll]); // Rerun if handleScroll identity changes (it shouldn't with useCallback)

    const handleSend = () => {
      if (input.trim() && !isLoading) {
        sendMessage(input.trim());
        setInput("");
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault(); // Prevent newline in input
        handleSend();
      }
    };

    if (!isOpen) {
      return null;
    }

    return (
      <div className="fixed bottom-24 right-6 w-96 h-[32rem] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl flex flex-col z-40 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">AI Trace Analysis</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close Chat">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Message Area */}
        <ScrollArea className="flex-grow p-3" ref={internalScrollAreaRef}>
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-2 rounded-lg text-sm whitespace-pre-wrap ${
                    msg.sender === "user"
                      ? "bg-blue-500 text-white"
                      : msg.sender === "error"
                        ? "bg-red-100 text-red-700 border border-red-300"
                        : "bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
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

        {/* Input Area */}
        <div className="p-3 border-t dark:border-gray-700 flex items-center space-x-2 bg-gray-50 dark:bg-gray-700 chat-input-area">
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
ChatWindow.displayName = "ChatWindow";
