import { useQuery } from '@tanstack/react-query';
import type { TraceCommentWithAuthor } from '@/lib/api';
import { traceApi } from '@/lib/api';
import { useMemo, useCallback } from 'react';

// Helper function to extract unique commented cell IDs for a given type
const getCommentedCellIdsByType = (
  comments: TraceCommentWithAuthor[] | undefined,
  type: string
): string[] => {
  if (!comments) return [];
  return comments.reduce<string[]>((ids, comment) => {
    if (
      comment.comment_type === type &&
      comment.comment_identifier &&
      !ids.includes(comment.comment_identifier)
    ) {
      ids.push(comment.comment_identifier);
    }
    return ids;
  }, []);
};

/**
 * Custom hook to fetch trace comments and provide derived data
 */
export function useTraceComments(traceId?: string) {
  const {
    data: comments,
    isLoading,
    error,
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

  const commentedChronoCellIds = useMemo(() => {
    return getCommentedCellIdsByType(comments, 'chrono');
  }, [comments]);

  // Derive left_heavy-specific cell identifiers for highlighting
  const commentedLeftHeavyCellIds = useMemo(() => {
    return getCommentedCellIdsByType(comments, 'left_heavy');
  }, [comments]);

  // Derive sandwich-specific cell identifiers (if needed later)
  const commentedSandwichCellIds = useMemo(() => {
    return getCommentedCellIdsByType(comments, 'sandwich');
  }, [comments]);

  // Optional: Function to get all comments for a specific chrono cell
  const getCommentsForChronoCell = useCallback(
    (cellIdentifier: string) => {
      return (
        comments?.filter(
          (comment) =>
            comment.comment_type === 'chrono' && comment.comment_identifier === cellIdentifier
        ) || []
      );
    },
    [comments]
  );

  // Optional: Get general/overview comments
  const overviewComments = useMemo(() => {
    return comments?.filter((comment) => comment.comment_type === 'overview') || [];
  }, [comments]);

  return useMemo(
    () => ({
      allComments: comments,
      isLoading,
      error,
      commentedChronoCellIds,
      commentedLeftHeavyCellIds,
      commentedSandwichCellIds,
      getCommentsForChronoCell,
      overviewComments,
    }),
    [
      comments,
      isLoading,
      error,
      commentedChronoCellIds,
      commentedLeftHeavyCellIds,
      commentedSandwichCellIds,
      getCommentsForChronoCell,
      overviewComments,
    ]
  );
}
