import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TraceCommentWithAuthor } from '@/lib/api';

export function useCommentManagement(traceId?: string) {
  const queryClient = useQueryClient();
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);

  const handleStartReply = useCallback((commentId: string) => {
    setReplyingToCommentId(commentId);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingToCommentId(null);
  }, []);

  const handleCommentUpdate = useCallback((updatedComment: TraceCommentWithAuthor) => {
    if (!traceId) return; // Don't update if traceId is missing
    
    console.log(`[useCommentManagement] Updating cache for trace ${traceId}`, updatedComment);
    
    queryClient.setQueryData<TraceCommentWithAuthor[]>(
      ['traceComments', traceId], 
      (oldData) => {
        if (!oldData) return [];
        // Update the specific comment in the flat array cache
        return oldData.map(comment => 
          comment.id === updatedComment.id ? updatedComment : comment
        );
      }
    );
  }, [queryClient, traceId]); // Depend on queryClient and traceId

  return {
    replyingToCommentId,
    handleStartReply,
    handleCancelReply,
    handleCommentUpdate,
  };
} 