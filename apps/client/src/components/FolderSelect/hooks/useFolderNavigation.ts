import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Folder, ApiError } from "@/lib/api";
import { traceApi } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/contexts/AuthContext";

interface UseFolderNavigationResult {
  currentFolderId: string | null;
  currentFolder: Folder | null | undefined; // Can be undefined while loading
  folders: Folder[] | undefined;
  path: Folder[] | undefined;
  isLoading: boolean;
  isFetching: boolean; // Add isFetching for background updates
  error: ApiError | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  navigateToFolder: (folderId: string | null) => void;
  refetch: () => void; // Expose refetch
}

const FOLDER_QUERY_KEY = "folderListing";

export function useFolderNavigation(
  initialFolderId: string | null = null
): UseFolderNavigationResult {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialFolderId);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(localSearchQuery, 300);
  const { user } = useAuth();

  const { data, isLoading, isFetching, error, refetch } = useQuery<
    { folders: Folder[]; path: Folder[]; currentFolder: Folder | null }, // Success data type
    ApiError // Error type
  >({
    // Pass ApiError as the error type
    queryKey: [FOLDER_QUERY_KEY, currentFolderId, debouncedSearchQuery],
    queryFn: async () => {
      console.log(
        `[useFolderNavigation Query] Fetching for folder: ${currentFolderId || "root"}, search: '${debouncedSearchQuery}'`
      );
      const response = await traceApi.getDirectoryListing(currentFolderId, {
        searchQuery: debouncedSearchQuery || null,
        itemTypeFilter: "folder",
        userId: user?.id,
      });
      if (response.error) {
        console.error("[useFolderNavigation Query] API Error:", response.error);
        throw response.error; // Throw error for react-query to handle
      }
      if (!response.data) {
        console.error("[useFolderNavigation Query] API returned no data.");
        // Throw an error or return a default state if appropriate
        throw new Error("No data returned from API");
      }
      console.log("[useFolderNavigation Query] Data received:", response.data);
      // Return only the necessary parts for the query data
      return {
        folders: response.data.folders,
        path: response.data.path,
        currentFolder: response.data.currentFolder,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const navigateToFolder = useCallback((folderId: string | null) => {
    console.log(`[useFolderNavigation] Navigating to folder: ${folderId || "root"}`);
    // Set the new folder ID
    setCurrentFolderId(folderId);
    // Clear the search query when navigating to a new folder
    setLocalSearchQuery("");
    // Optionally, you might want to immediately invalidate or reset the query
    // if you don't want to rely solely on the queryKey change.
    // queryClient.invalidateQueries([FOLDER_QUERY_KEY]);
  }, []);

  const handleSetSearchQuery = useCallback((query: string) => {
    setLocalSearchQuery(query);
    // Query automatically refetches due to debouncedSearchQuery in queryKey
  }, []);

  return {
    currentFolderId,
    currentFolder: data?.currentFolder,
    folders: data?.folders,
    path: data?.path,
    isLoading, // Represents initial load or hard refresh
    isFetching, // Represents background fetching or fetching due to param change
    error: error as ApiError | null, // Cast error back to ApiError or null
    searchQuery: localSearchQuery,
    setSearchQuery: handleSetSearchQuery,
    navigateToFolder,
    refetch,
  };
}
