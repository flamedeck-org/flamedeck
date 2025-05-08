import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import TextareaAutosize from 'react-textarea-autosize';
import { useToast } from '@/components/ui/use-toast';
import type { NewTraceComment } from '@/lib/api';
import { traceApi } from '@/lib/api';
import { Loader2, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

interface CommentFormProps {
  traceId: string;
  parentId?: string | null;
  commentType?: string;
  commentIdentifier?: string | null;
  onCommentPosted?: (newContent?: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  initialContent?: string;
  submitButtonText?: string;
  mode?: 'create' | 'edit';
}

const CommentForm: React.FC<CommentFormProps> = ({
  traceId,
  parentId = null,
  commentType,
  commentIdentifier = null,
  onCommentPosted,
  onCancel,
  placeholder = 'Leave a comment...',
  autoFocus = false,
  className,
  initialContent = '',
  submitButtonText = 'Post Comment',
  mode = 'create',
}) => {
  const [content, setContent] = useState(initialContent);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const commentMutation = useMutation({
    mutationFn: (newComment: NewTraceComment & { trace_id: string }) =>
      traceApi.createTraceComment(newComment, user?.id || ''),
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
    if (!content.trim() || !user) return;

    if (mode === 'edit') {
      onCommentPosted?.(content);
    } else {
      if (commentMutation.isPending) return;
      commentMutation.mutate({
        trace_id: traceId,
        content: content.trim(),
        parent_comment_id: parentId,
        trace_timestamp_ms: null,
        comment_type: commentType,
        comment_identifier: commentIdentifier,
      });
    }
  };

  const handleCancel = () => {
    setContent(mode === 'edit' ? initialContent : '');
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!user) {
    return null;
  }

  const canSubmit = content.trim().length > 0 && !commentMutation.isPending;
  const isReply = parentId !== null;

  return (
    <form onSubmit={handleSubmit} className={cn('relative', className)}>
      <div
        className={cn(
          'flex items-end space-x-2 rounded-md border border-input bg-transparent ring-offset-background',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          isReply ? 'pr-1' : 'pr-10'
        )}
      >
        <TextareaAutosize
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={commentMutation.isPending}
          minRows={isReply ? 1 : 2}
          maxRows={10}
          autoFocus={autoFocus}
          required
          className="flex-grow resize-none appearance-none bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div
          className={cn('absolute right-1 flex items-center', isReply ? 'bottom-1.5' : 'bottom-1')}
        >
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 rounded-full',
              canSubmit
                ? 'text-foreground bg-primary/10 hover:bg-primary/20'
                : 'text-muted-foreground'
            )}
            disabled={!canSubmit}
            aria-label={submitButtonText}
          >
            {mode === 'create' && commentMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
      {isReply && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="mt-1 text-xs text-muted-foreground h-auto px-2 py-0.5"
          disabled={commentMutation.isPending}
        >
          Cancel
        </Button>
      )}
    </form>
  );
};

export default React.memo(CommentForm);
