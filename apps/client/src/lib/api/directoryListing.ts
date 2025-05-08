import type { ApiError, ApiResponse, TraceMetadata } from "@/types";

import type {
  PostgrestError,
  PostgrestMaybeSingleResponse,
  PostgrestResponse,
} from "@supabase/supabase-js";
import type {
  DirectoryListingOptions,
  Folder,
  DirectoryListingContentsResponse,
  FolderContextResponse,
} from "./types";
import { DirectoryListingResponse } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { getFolderPath } from "./utils";
import { listUserTraces } from "./storage";

// --- New Function: Fetch Folder Context (Path & Current Folder) ---
export async function getFolderContext(
  folderId: string | null,
  userId: string | undefined // User ID is needed for folder lookup
): Promise<ApiResponse<FolderContextResponse>> {
  if (!userId) {
    return { data: null, error: { message: "User ID is required" } };
  }
  try {
    let path: Folder[] = [];
    let currentFolderData: Folder | null = null;

    if (folderId) {
      // Fetch current folder details separately
      const { data: folderData, error: currentFolderError }: PostgrestMaybeSingleResponse<Folder> =
        await supabase
          .from("folders")
          .select("*")
          .eq("id", folderId)
          .eq("user_id", userId) // Ensure user owns or has access (RLS helps)
          .maybeSingle();

      if (currentFolderError) {
        console.error(
          `Error fetching current folder details (ID: ${folderId}):`,
          currentFolderError
        );
        throw new Error(`Failed to fetch details for folder ${folderId}`);
      }
      if (!folderData) {
        // It's possible the folder doesn't exist or the user doesn't have access
        // Return an empty path and null folder, let the UI handle 'not found'
        console.warn(`Folder not found or not accessible: ${folderId}`);
        // Consider returning a specific error code if needed
        return { data: { path: [], currentFolder: null }, error: null };
        // throw new Error(`Folder not found or not accessible: ${folderId}`);
      }
      currentFolderData = folderData as Folder;
      // Fetch path only if folder exists and is accessible
      path = await getFolderPath(folderId);
    } else {
      // Root directory
      path = [];
      currentFolderData = null;
    }

    return {
      data: {
        path,
        currentFolder: currentFolderData,
      },
      error: null,
    };
  } catch (error) {
    console.error("Error fetching folder context:", error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : "Failed to fetch folder context",
      code: (error as PostgrestError)?.code,
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
    };
    return { data: null, error: apiError };
  }
}

// --- Modified Function: Fetch Directory Contents (Folders & Traces) ---
// TODO: This is slow, need to optimize <- This comment might be less relevant now or needs update
export async function getDirectoryListing(
  folderId: string | null = null, // null for root
  options: DirectoryListingOptions // Use options object
): Promise<ApiResponse<DirectoryListingContentsResponse>> {
  // Updated Response Type
  // Default options
  const {
    userId,
    page = 0,
    limit = 50, // Note: Limit primarily applies to traces due to pagination
    searchQuery = null,
    itemTypeFilter = "all",
    // searchScope = 'current' // Default to current scope for now
  } = options;

  if (!userId) {
    return { data: null, error: { message: "User ID is required for listing" } };
  }

  try {
    // --- Fetch Folders ---
    let foldersData: Folder[] = [];
    // Fetch folders if filter allows, regardless of search (search only applies to name)
    if (itemTypeFilter === "folder" || itemTypeFilter === "all") {
      console.log(
        `[API Contents] Fetching folders for parent: ${folderId || "root"}, search: '${searchQuery || ""}'`
      );
      let folderQuery = supabase.from("folders").select("*").eq("user_id", userId); // RLS should handle access, but explicit is safer

      // Filter by parent folder
      if (folderId) {
        folderQuery = folderQuery.eq("parent_folder_id", folderId);
      } else {
        folderQuery = folderQuery.is("parent_folder_id", null); // Root level folders
      }

      // Apply search query to folder names
      if (searchQuery && searchQuery.trim().length > 0) {
        folderQuery = folderQuery.ilike("name", `%${searchQuery.trim()}%`);
      }

      // Ordering (always order folders by name)
      folderQuery = folderQuery.order("name", { ascending: true });

      // Execute folder query
      const { data: fetchedFolders, error: foldersError }: PostgrestResponse<Folder> =
        await folderQuery;
      if (foldersError) {
        console.error("Error fetching folders:", foldersError);
        throw foldersError; // Propagate error
      }
      foldersData = fetchedFolders || [];
      console.log(`[API Contents] Fetched ${foldersData.length} folders.`);
    } else {
      console.log(`[API Contents] Skipping folder fetch due to itemTypeFilter: ${itemTypeFilter}`);
    }

    // --- Fetch Traces ---
    let tracesData: TraceMetadata[] = [];
    let tracesCount: number | null = 0;

    // Fetch traces if filter allows. The underlying RPC handles folder vs search logic.
    const shouldFetchTraces = itemTypeFilter === "trace" || itemTypeFilter === "all";

    if (shouldFetchTraces) {
      // When searching, the RPC ignores the folderId and searches globally (as per SQL provided)
      // When not searching, the RPC uses folderId for filtering
      console.log(
        `[API Contents] Fetching traces. Parent: ${folderId || "root"}, Search: '${searchQuery || ""}', Page: ${page}, Limit: ${limit}`
      );

      // Pass folderId even when searching; the RPC function decides whether to use it
      const { data: fetchedTraces, count: fetchedCount } = await listUserTraces(
        page,
        limit,
        searchQuery, // Pass search query for trace search
        folderId // Pass current folderId (RPC ignores if searchQuery is present)
      );

      tracesData = fetchedTraces || []; // Default to empty array if null
      tracesCount = fetchedCount; // Keep count as number | null
      console.log(
        `[API Contents] Fetched ${tracesData.length} traces, total count: ${tracesCount}`
      );
    } else {
      console.log(`[API Contents] Skipping trace fetch. Filter: ${itemTypeFilter}`);
    }

    // --- Combine results ---
    // Note: totalCount currently only reflects TRACES because folders aren't paginated here.
    // If folder pagination were added, this count would need adjustment.
    const totalTraceCount = tracesCount ?? 0;

    return {
      data: {
        folders: foldersData,
        traces: tracesData,
        // path: path, // REMOVED
        // currentFolder: currentFolderData, // REMOVED
        totalCount: totalTraceCount, // Primarily for trace pagination
      },
      error: null,
    };
  } catch (error) {
    console.error("Error fetching directory listing contents:", error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : "Failed to fetch directory contents",
      code: (error as PostgrestError)?.code,
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
    };
    return { data: null, error: apiError };
  }
}
