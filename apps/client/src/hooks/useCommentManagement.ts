import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TraceCommentWithAuthor } from '@/lib/api';

// Define a no-op function for unauthenticated state
const noOp = () => {};

export function useCommentManagement(traceId: string | undefined, isAuthenticated: boolean) {
  const queryClient = useQueryClient();
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);

  const handleStartReply = useCallback((commentId: string) => {
    if (!isAuthenticated) return; // Do nothing if not authenticated
    setReplyingToCommentId(commentId);
  }, [isAuthenticated]);

  const handleCancelReply = useCallback(() => {
    if (!isAuthenticated) return; // Do nothing if not authenticated
    setReplyingToCommentId(null);
  }, [isAuthenticated]);

  const handleCommentUpdate = useCallback((updatedComment: TraceCommentWithAuthor) => {
    // Only run logic if authenticated and traceId is present
    if (!isAuthenticated || !traceId) return; 

    console.log(`[useCommentManagement] Updating cache for trace ${traceId}`, updatedComment);

    queryClient.setQueryData<TraceCommentWithAuthor[]>(
      ['traceComments', traceId],
      (oldData) => {
        if (!oldData) return [];
        return oldData.map(comment =>
          comment.id === updatedComment.id ? updatedComment : comment
        );
      }
    );
  }, [queryClient, traceId, isAuthenticated]); // Add isAuthenticated to dependencies

  // Return actual handlers only if authenticated
  return {
    replyingToCommentId: isAuthenticated ? replyingToCommentId : null,
    handleStartReply: isAuthenticated ? handleStartReply : noOp,
    handleCancelReply: isAuthenticated ? handleCancelReply : noOp,
    handleCommentUpdate: isAuthenticated ? handleCommentUpdate : noOp,
  };
} 