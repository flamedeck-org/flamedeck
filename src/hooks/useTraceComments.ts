import { useQuery } from '@tanstack/react-query';
import { traceApi, TraceCommentWithAuthor } from '@/lib/api';

/**
 * Custom hook to fetch trace comments and provide derived data like commented frame keys
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
      if (response.error) throw new Error(response.error.message);
      return response.data || [];
    },
    enabled: !!traceId,
  });

  // Extract all unique frame keys that have comments
  const commentedFrameKeys = comments?.reduce<(string | number)[]>((keys, comment) => {
    if (comment.frame_key && !keys.includes(comment.frame_key)) {
      keys.push(comment.frame_key);
    }
    return keys;
  }, []) || [];

  // Get frame comments by key
  const getCommentsForFrame = (frameKey: string | number) => {
    return comments?.filter(comment => comment.frame_key === frameKey) || [];
  };

  return {
    comments,
    isLoading,
    error,
    commentedFrameKeys,
    getCommentsForFrame
  };
} 