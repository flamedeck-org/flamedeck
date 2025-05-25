import { type FC, forwardRef, useImperativeHandle, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, ArrowLeft, MessageSquareText } from 'lucide-react';
import { ToolMessageItem } from './ToolMessageItem';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';
import type { ChatMessage, ChatWindowHandle } from './ChatWindow';

interface ActiveChatViewProps {
    messages: ChatMessage[];
    input: string;
    onInputChange: (value: string) => void;
    onSend: () => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    isLoading: boolean;
    isStreaming: boolean;
    suggestionPrompts?: string[];
    onBack: () => void;
    isNewSession: boolean;
    sendMessage: (prompt: string) => void;
}

export const ActiveChatView = forwardRef<ChatWindowHandle, ActiveChatViewProps>(
    (
        {
            messages,
            input,
            onInputChange,
            onSend,
            onKeyDown,
            isLoading,
            isStreaming,
            suggestionPrompts,
            onBack,
            isNewSession,
            sendMessage,
        },
        ref
    ) => {
        const internalScrollAreaRef = useRef<HTMLDivElement>(null);
        const { openModal: openUpgradeModal } = useUpgradeModal();

        useImperativeHandle(ref, () => ({
            scrollToBottom: (force = false) => {
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

        const handleSuggestionClick = (prompt: string) => {
            sendMessage(prompt);
        };

        // Function to format inline code like GitHub
        const formatMessageText = (text: string) => {
            const parts = text.split('`');
            return parts.map((part, index) => {
                if (index % 2 === 1) {
                    return (
                        <code
                            key={index}
                            className="px-1.5 py-0.5 mx-0.5 bg-muted/60 dark:bg-muted/80 border border-border/40 rounded text-xs font-mono text-foreground/90"
                        >
                            {part}
                        </code>
                    );
                }
                return part;
            });
        };

        return (
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="px-4 py-3 border-b border-border/50 bg-gradient-to-r from-background/90 to-background/70 backdrop-blur-sm">
                    <div className="flex items-center justify-between pr-8">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onBack}
                                className="h-8 w-8 p-0 hover:bg-background/80"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-r from-red-500 to-yellow-500 rounded-lg">
                                    <MessageSquareText className="h-4 w-4 text-white" />
                                </div>
                                <h3 className="font-bold text-foreground">
                                    {isNewSession ? 'New Analysis' : 'AI Trace Analysis'}
                                </h3>
                            </div>
                        </div>
                        {!isNewSession && (
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-xs text-muted-foreground">Continuing</span>
                            </div>
                        )}
                    </div>
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
                                ['limit_exceeded', 'lifetime_analyses', 'session_messages'].includes(msg.errorType);

                            if (msg.sender === 'tool') {
                                return <ToolMessageItem key={msg.id} message={msg} />;
                            }
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
                                        {formatMessageText(msg.text)}
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
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            onSend();
                        }}
                        className="relative"
                    >
                        <div className="flex items-end rounded-xl border border-border/60 bg-background/80 backdrop-blur-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 pr-10">
                            <Input
                                type="text"
                                placeholder="Ask about the trace..."
                                value={input}
                                onChange={(e) => onInputChange(e.target.value)}
                                onKeyDown={onKeyDown}
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

ActiveChatView.displayName = 'ActiveChatView'; 