import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from 'react-router-dom';
import { toast } from "@/components/ui/use-toast";
import { traceApi, DirectoryListingResponse, ApiError, Folder } from "@/lib/api";

const TRACE_LIST_PAGE_SIZE = 10;

export function useTraces() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const queryClient = useQueryClient();

  const { folderId: folderIdFromParams } = useParams<{ folderId?: string }>();

  const currentFolderId = useMemo(() => folderIdFromParams || null, [folderIdFromParams]);

  const { data: queryData, isLoading, error } = useQuery<DirectoryListingResponse, ApiError>({
    queryKey: ["directoryListing", currentFolderId, page, searchQuery],
    queryFn: async () => {
      console.log(`Fetching listing for folder: ${currentFolderId || 'root'}, page: ${page}, search: ${searchQuery}`);
      const response = await traceApi.getDirectoryListing(
          currentFolderId,
          page, 
          TRACE_LIST_PAGE_SIZE, 
          searchQuery
      );
      if (response.error) {
        toast({
          title: "Error loading folder contents",
          description: response.error.message,
          variant: "destructive",
        });
        throw response.error;
      }
      return response.data || { folders: [], traces: [], path: [], totalCount: 0 };
    },
    placeholderData: (previousData) => previousData,
  });

  const deleteTraceMutation = useMutation({
    mutationFn: (traceId: string) => traceApi.deleteTrace(traceId),
    onSuccess: (data, traceId) => {
      toast({
        title: "Trace deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['directoryListing', currentFolderId] });
    },
    onError: (error: ApiError, traceId) => {
      toast({
        title: "Error deleting trace",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: ({ name, parentFolderId }: { name: string; parentFolderId: string | null }) => 
      traceApi.createFolder(name, parentFolderId),
    onSuccess: (data, variables) => {
      toast({
        title: `Folder "${variables.name}" created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['directoryListing', variables.parentFolderId] });
    },
    onError: (error: ApiError, variables) => {
      toast({
        title: "Error creating folder",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const folders = queryData?.folders || [];
  const traces = queryData?.traces || [];
  const path = queryData?.path || [];
  const totalCount = queryData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / TRACE_LIST_PAGE_SIZE);

  return {
    folders,
    traces,
    path,
    currentFolderId,
    totalCount,
    totalPages,
    page,
    setPage,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    deleteTrace: deleteTraceMutation.mutate,
    isDeleting: deleteTraceMutation.isPending,
    createFolder: createFolderMutation.mutate,
    isCreatingFolder: createFolderMutation.isPending,
    TRACE_LIST_PAGE_SIZE,
  };
} 