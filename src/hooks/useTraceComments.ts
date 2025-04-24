import { useQuery } from '@tanstack/react-query';
import { traceApi, TraceCommentWithAuthor } from '@/lib/api';
import { useMemo, useCallback } from 'react';

/**
 * Custom hook to fetch trace comments and provide derived data
 */
export function useTraceComments(traceId?: string) {
  const { 
    data: comments,
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['traceComments', traceId],
    queryFn: async () => {
      if (!traceId) return [];
      const response = await traceApi.getTraceComments(traceId);
      if (response.error) throw response.error;
      return response.data || [];
    },
    enabled: !!traceId,
  });

  // Derive chrono-specific cell identifiers for highlighting
  const commentedChronoCellIds = useMemo(() => {
    return comments?.reduce<string[]>((ids, comment) => {
      if (comment.comment_type === 'chrono' && comment.comment_identifier && !ids.includes(comment.comment_identifier)) {
        ids.push(comment.comment_identifier);
      }
      return ids;
    }, []) || [];
  }, [comments]);

  // Optional: Function to get all comments for a specific chrono cell
  const getCommentsForChronoCell = useCallback((cellIdentifier: string) => {
    return comments?.filter(comment => 
      comment.comment_type === 'chrono' && comment.comment_identifier === cellIdentifier
    ) || [];
  }, [comments]);
  
  // Optional: Get general/overview comments
  const overviewComments = useMemo(() => {
    return comments?.filter(comment => comment.comment_type === 'overview') || [];
  }, [comments]);

  return useMemo(() => ({
    allComments: comments,
    isLoading,
    error,
    commentedChronoCellIds,
    getCommentsForChronoCell,
    overviewComments,
  }), [comments, isLoading, error, commentedChronoCellIds, getCommentsForChronoCell, overviewComments]);
} 