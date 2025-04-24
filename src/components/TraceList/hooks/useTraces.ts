import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { traceApi, PaginatedTracesResponse } from "@/lib/api";

const TRACE_LIST_PAGE_SIZE = 10;

export function useTraces() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: queryData, isLoading, error } = useQuery<PaginatedTracesResponse, Error>({
    queryKey: ["traces", page, searchQuery],
    queryFn: async () => {
      const response = await traceApi.getTraces(page, TRACE_LIST_PAGE_SIZE, searchQuery);
      if (response.error) {
        toast({
          title: "Error loading traces",
          description: response.error.message,
          variant: "destructive",
        });
        // Re-throw the error to be caught by the useQuery error state
        throw response.error;
      }
      // Ensure we return a default structure even if data is null/undefined
      return response.data || { traces: [], totalCount: 0 };
    },
    placeholderData: (previousData) => previousData, // Keep previous data while loading new page
  });

  const deleteMutation = useMutation({
    mutationFn: (traceId: string) => traceApi.deleteTrace(traceId),
    onSuccess: () => {
      toast({
        title: "Trace deleted successfully",
      });
      // Invalidate queries to refetch the list after deletion
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      // Optional: Consider resetting to page 0 or staying on the current page
      // setPage(0);
    },
    onError: (error) => {
      toast({
        title: "Error deleting trace",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const traces = queryData?.traces || [];
  const totalCount = queryData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / TRACE_LIST_PAGE_SIZE);

  return {
    traces,
    totalCount,
    totalPages,
    page,
    setPage,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    deleteTrace: deleteMutation.mutate, // Expose the mutate function directly
    isDeleting: deleteMutation.isPending, // Expose the loading state of the mutation
    TRACE_LIST_PAGE_SIZE, // Expose page size if needed elsewhere
  };
} 