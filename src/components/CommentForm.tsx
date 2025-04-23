import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { traceApi, NewTraceComment } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface CommentFormProps {
  traceId: string;
  parentId?: string | null; // Optional: for replies
  frameKey?: string | number | null; // Optional: Identifier for the frame being commented on
  onCommentPosted?: () => void; // Optional: callback after success
  placeholder?: string;
  autoFocus?: boolean;
}

const CommentForm: React.FC<CommentFormProps> = ({
  traceId,
  parentId = null,
  frameKey = null, // Default to null
  onCommentPosted,
  placeholder = "Add a comment...",
  autoFocus = false,
}) => {
  const [content, setContent] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const commentMutation = useMutation({
    mutationFn: (newComment: NewTraceComment & { trace_id: string }) => traceApi.createTraceComment(newComment),
    onSuccess: () => {
      setContent(''); // Clear form
      queryClient.invalidateQueries({ queryKey: ['traceComments', traceId] });
      toast({ title: 'Comment posted!' });
      onCommentPosted?.(); // Call callback if provided
    },
    onError: (error) => {
      toast({
        title: 'Error posting comment',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;

    commentMutation.mutate({
      trace_id: traceId,
      content: content.trim(),
      parent_comment_id: parentId,
      trace_timestamp_ms: null, // TODO: Add ability to link timestamp
      frame_key: frameKey, // Pass the frameKey here
    });
  };

  if (!user) {
    return <p className="text-sm text-muted-foreground">Please log in to comment.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        disabled={commentMutation.isPending}
        rows={parentId ? 2 : 3} // Smaller for replies
        autoFocus={autoFocus}
        required
        className="resize-none"
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={commentMutation.isPending || !content.trim()} size="sm">
          {commentMutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting...</>
          ) : (
            'Post Comment'
          )}
        </Button>
      </div>
    </form>
  );
};

export default CommentForm; 