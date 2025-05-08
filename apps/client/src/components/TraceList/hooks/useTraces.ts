import { useState, useMemo } from 'react';
import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useParams } from 'react-router-dom';
import { toast } from "@/components/ui/use-toast";
import type { Folder} from "@/lib/api";
import { traceApi } from "@/lib/api";
import type { TraceMetadata } from "@/types";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { PostgrestError } from '@supabase/supabase-js';

type ExplicitFolderViewData = {
  path: Pick<Folder, 'id' | 'name'>[];
  currentFolder: Folder | null;
  childFolders: Folder[];
  childTraces: TraceMetadata[];
}

const TRACE_LIST_PAGE_SIZE = 10;
export const FOLDER_VIEW_QUERY_KEY = "folderView";

export function getFolderViewQueryKey(folderId: string | null, searchQuery: string) {
  return [FOLDER_VIEW_QUERY_KEY, folderId || 'root', searchQuery];
}

export function useTraces() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const queryClient = useQueryClient();

  const { folderId: folderIdFromParams } = useParams<{ folderId?: string }>();
  const currentFolderId = useMemo(() => folderIdFromParams || null, [folderIdFromParams]);

  const { user } = useAuth();

  const { 
    data: infiniteData, 
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery<
      ExplicitFolderViewData,
      PostgrestError,
      InfiniteData<ExplicitFolderViewData>,
      string[],
      number
    >({
    queryKey: getFolderViewQueryKey(currentFolderId, searchQuery),
    queryFn: async ({ pageParam = 0 }) => {
        if (!user?.id) throw new Error("User not authenticated");

        console.log(`[RPC] Fetching view for folder: ${currentFolderId || 'root'}, page: ${pageParam}, search: ${searchQuery}`);
        
        const { data, error } = await supabase.rpc('get_folder_view_data', {
            p_user_id: user.id,
            p_folder_id: currentFolderId,
            p_page: pageParam,
            p_limit: TRACE_LIST_PAGE_SIZE,
            p_search_query: searchQuery || null
        });

        if (error) {
            console.error("Error fetching folder view data:", error);
            toast({
                title: "Error loading folder contents",
                description: error.message,
                variant: "destructive",
            });
            throw error;
        }

        const responseData = data as unknown as ExplicitFolderViewData;
        return {
            path: responseData?.path || [],
            currentFolder: responseData?.currentFolder || null,
            childFolders: responseData?.childFolders || [],
            childTraces: responseData?.childTraces || [],
        };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const lastTraceCount = lastPage.childTraces.length;
      if (lastTraceCount < TRACE_LIST_PAGE_SIZE) {
        return undefined;
      }
      return allPages.length;
    },
    enabled: !!user,
  });

  const deleteTraceMutation = useMutation({
    mutationFn: (traceId: string) => traceApi.deleteTrace(traceId),
    onSuccess: (data, traceId) => {
      toast({ title: "Trace deleted successfully" });
      queryClient.invalidateQueries({ 
        queryKey: [FOLDER_VIEW_QUERY_KEY, currentFolderId || 'root', searchQuery]
      });
    },
    onError: (error: PostgrestError, traceId) => {
      toast({ title: "Error deleting trace", description: error.message, variant: "destructive" });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: ({ name, parentFolderId }: { name: string; parentFolderId: string | null }) => 
      traceApi.createFolder(name, user?.id, parentFolderId),
    onSuccess: (data, variables) => {
      toast({ title: `Folder "${variables.name}" created successfully` });
      queryClient.invalidateQueries({ 
        queryKey: [FOLDER_VIEW_QUERY_KEY, variables.parentFolderId || 'root', searchQuery]
      });
    },
    onError: (error: PostgrestError, variables) => {
      toast({ title: "Error creating folder", description: error.message, variant: "destructive" });
    },
  });

  const allPagesData = useMemo(() => infiniteData?.pages || [], [infiniteData]);

  const path = useMemo(() => (allPagesData[0]?.path || []).slice().reverse(), [allPagesData]);
  const currentFolder = useMemo(() => allPagesData[0]?.currentFolder || null, [allPagesData]);

  const folders = useMemo(() => allPagesData[0]?.childFolders || [], [allPagesData]);

  const traces = useMemo(() => allPagesData.flatMap(page => page.childTraces), [allPagesData]);

  return {
    folders,
    traces,
    path,
    currentFolder,
    currentFolderId,
    TRACE_LIST_PAGE_SIZE,
    fetchNextPage,
    hasNextPage,
    isLoading: status === 'pending',
    isFetchingNextPage,
    searchQuery,
    setSearchQuery,
    error,
    deleteTrace: deleteTraceMutation.mutate,
    isDeleting: deleteTraceMutation.isPending,
    createFolder: createFolderMutation.mutate,
    isCreatingFolder: createFolderMutation.isPending,
  };
} 