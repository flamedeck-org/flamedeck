import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import TextareaAutosize from 'react-textarea-autosize';
import { useToast } from '@/components/ui/use-toast';
import { traceApi, NewTraceComment } from '@/lib/api';
import { Loader2, Send, Paperclip } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from "@/lib/utils";

interface CommentFormProps {
  traceId: string;
  parentId?: string | null; // Optional: for replies
  commentType: string; // Type of comment (e.g., 'trace', 'frame')
  commentIdentifier?: string | null; // Identifier for the specific item (e.g., frame key), null for general
  onCommentPosted?: () => void; // Optional: callback after success
  placeholder?: string;
  autoFocus?: boolean;
  className?: string; // Allow passing additional classes
}

const CommentForm: React.FC<CommentFormProps> = ({
  traceId,
  parentId = null,
  commentType,
  commentIdentifier = null,
  onCommentPosted,
  placeholder = "Leave a comment...",
  autoFocus = false,
  className,
}) => {
  const [content, setContent] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const commentMutation = useMutation({
    mutationFn: (newComment: NewTraceComment & { trace_id: string }) => traceApi.createTraceComment(newComment, user.id),
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['traceComments', traceId] });
      onCommentPosted?.();
    },
    onError: (error) => {
      toast({
        title: 'Error posting comment',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() || !user || commentMutation.isPending) return;

    commentMutation.mutate({
      trace_id: traceId,
      content: content.trim(),
      parent_comment_id: parentId,
      trace_timestamp_ms: null,
      comment_type: commentType,
      comment_identifier: commentIdentifier,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!user) {
    return <p className="text-sm text-muted-foreground">Please log in to comment.</p>;
  }

  const canSubmit = content.trim().length > 0 && !commentMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div className="flex items-end space-x-2 rounded-md border border-input bg-transparent pr-10 ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <TextareaAutosize
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={commentMutation.isPending}
          minRows={parentId ? 2 : 3}
          maxRows={10}
          autoFocus={autoFocus}
          required
          className="flex-grow resize-none appearance-none bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="absolute bottom-1 right-1 flex items-center">
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full",
              canSubmit ? "text-foreground bg-primary/10 hover:bg-primary/20" : "text-muted-foreground"
            )}
            disabled={!canSubmit}
            aria-label="Post comment"
          >
            {commentMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default React.memo(CommentForm); 