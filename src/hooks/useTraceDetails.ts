import { useQuery } from '@tanstack/react-query';
import { traceApi } from '@/lib/api';
import { TraceMetadata } from '@/types';

/**
 * Custom hook to fetch trace metadata.
 * @param traceId The ID of the trace to fetch.
 * @returns The react-query query result for the trace metadata.
 */
export function useTraceDetails(traceId: string | null | undefined) {
  return useQuery<
    TraceMetadata | null, // Type for successful data
    Error // Type for error
  >({
    queryKey: ['traceDetails', traceId], // Unique query key including the traceId
    queryFn: async () => {
      if (!traceId) {
        // Return null or throw an error if traceId is not provided, consistent with enabled flag
        return null;
      }
      const response = await traceApi.getTrace(traceId);
      if (response.error) {
        // Throw an error to be caught by react-query
        throw new Error(response.error);
      }
      // Return the data on success
      return response.data;
    },
    enabled: !!traceId, // Only run the query if traceId is truthy
    staleTime: 5 * 60 * 1000, // Cache data for 5 minutes
    refetchOnWindowFocus: false, // Optional: prevent refetch on window focus for potentially static data
  });
} 