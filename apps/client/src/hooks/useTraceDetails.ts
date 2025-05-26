import { useQuery } from '@tanstack/react-query';
import { traceApi } from '@/lib/api';
import type { TraceMetadata, ApiError } from '@/types';

export function getTraceDetailsQueryKey(traceId: string | null | undefined) {
  return ['traceDetails', traceId];
}

/**
 * Custom hook to fetch trace metadata.
 * Handles specific error cases like not found/permission errors.
 * @param traceId The ID of the trace to fetch.
 * @returns The react-query query result for the trace metadata.
 */
export function useTraceDetails(traceId: string | null | undefined) {
  return useQuery<
    TraceMetadata | null, // Type for successful data
    ApiError // Type for error - use our structured error type
  >({
    queryKey: getTraceDetailsQueryKey(traceId), // Use the custom query key function
    queryFn: async () => {
      if (!traceId) {
        // Return null if traceId is not provided, consistent with enabled flag
        return null;
      }
      // getTrace now throws errors directly and returns TraceMetadata directly
      return await traceApi.getTrace(traceId);
    },
    enabled: !!traceId, // Only run the query if traceId is truthy
    staleTime: 5 * 60 * 1000, // Cache data for 5 minutes
    refetchOnWindowFocus: false, // Optional: prevent refetch on window focus
    retry: (failureCount, error) => {
      // Prevent retrying if the error indicates not found/no permission (PGRST116)
      if (error.code === 'PGRST116') {
        return false;
      }
      // Default retry behavior for other errors (e.g., network issues)
      return failureCount < 3;
    },
  });
}
