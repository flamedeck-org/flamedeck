import { ApiError, ApiResponse, TraceMetadata } from "@/types";

import { PostgrestError, PostgrestMaybeSingleResponse, PostgrestResponse } from "@supabase/supabase-js";
import { DirectoryListingOptions, DirectoryListingResponse, Folder } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { getFolderPath } from "./utils";
import { listUserTraces } from "./storage";

// TODO: This is slow, need to optimize
export async function getDirectoryListing(
    folderId: string | null = null, // null for root
    options: DirectoryListingOptions // Use options object
): Promise<ApiResponse<DirectoryListingResponse>> {
    // Default options
    const {
        userId,
        page = 0,
        limit = 50, // Note: Limit primarily applies to traces due to pagination
        searchQuery = null,
        itemTypeFilter = 'all',
        // searchScope = 'current' // Default to current scope for now
    } = options;

    try {

         // --- Fetch Path (Breadcrumbs) & Current Folder Details ---
         let path: Folder[] = [];
         let currentFolderData: Folder | null = null;
         if (folderId) {
              // Fetch current folder details separately
              // RLS should handle access control based on the authenticated user
              const { data: folderData, error: currentFolderError }: PostgrestMaybeSingleResponse<Folder> = await supabase
                  .from('folders')
                  .select('*')
                  .eq('id', folderId)
                  .eq('user_id', userId) // RLS should handle, but good practice
                  .maybeSingle(); // Use maybeSingle

              if (currentFolderError) {
                  console.error(`Error fetching current folder details (ID: ${folderId}):`, currentFolderError);
                  throw new Error(`Failed to fetch details for folder ${folderId}`);
              }
              if (!folderData) {
                  throw new Error(`Folder not found or not accessible: ${folderId}`);
              }
              currentFolderData = folderData as Folder;
              path = await getFolderPath(folderId); // Fetch path only if folder exists
         } else {
             // Root directory
             path = [];
             currentFolderData = null;
         }


        // --- Fetch Folders ---
        let foldersData: Folder[] = [];
        if (itemTypeFilter === 'folder' || itemTypeFilter === 'all') {
            console.log(`[API] Fetching folders for folder: ${folderId || 'root'}, search: '${searchQuery || ''}'`);
            let folderQuery = supabase
                .from('folders')
                .select('*')
                .eq('user_id', userId); // Ensure user owns the folders

            // Filter by parent folder
            if (folderId) {
                folderQuery = folderQuery.eq('parent_folder_id', folderId);
            } else {
                folderQuery = folderQuery.is('parent_folder_id', null); // Root level folders
            }

            // Apply search query (scoped to current directory)
            if (searchQuery && searchQuery.trim().length > 0) {
                // Using 'ilike' for case-insensitive search
                folderQuery = folderQuery.ilike('name', `%${searchQuery.trim()}%`);
            }

            // Ordering (always order folders by name)
            folderQuery = folderQuery.order('name', { ascending: true });

            // Execute folder query
            const { data: fetchedFolders, error: foldersError }: PostgrestResponse<Folder> = await folderQuery;
            if (foldersError) {
              console.error("Error fetching folders:", foldersError);
              throw foldersError; // Propagate error
            }
            foldersData = fetchedFolders || [];
        } else {
            console.log(`[API] Skipping folder fetch due to itemTypeFilter: ${itemTypeFilter}`);
        }


        // --- Fetch Traces ---
        let tracesData: TraceMetadata[] = [];
        let tracesCount: number | null = 0;

        // Fetch traces only if filter allows AND we are not searching specifically for folders
        // (Avoids fetching traces when user is searching within FolderSelect)
        // OR if searching globally (which currently defaults to traces)
        // TODO: Refine trace search scoping later if needed
        const shouldFetchTraces = (itemTypeFilter === 'trace' || itemTypeFilter === 'all');

        if (shouldFetchTraces) {
              console.log(`[API] Fetching traces for folder: ${folderId || 'root'}, search: '${searchQuery || ''}', page: ${page}, limit: ${limit}`);
              // Fetch traces within the current directory, applying search if provided
              // Assuming listUserTraces now implicitly uses the authenticated user via RLS
              // And assuming its return type is { data: TraceMetadata[] | null, count: number | null }
              // We need to handle potential errors or null data if listUserTraces doesn't conform to ApiResponse
              const { data: fetchedTraces, count: fetchedCount } = await listUserTraces(
                  page,
                  limit,
                  searchQuery, // Pass search query for trace search
                  folderId    // Pass current folderId to scope trace listing
              );
              // listUserTraces handles its own errors/returns structured response
              tracesData = fetchedTraces || []; // Default to empty array if null
              tracesCount = fetchedCount; // Keep count as number | null
              console.log(`[API] Fetched ${tracesData.length} traces, total count: ${tracesCount}`);
        } else {
             console.log(`[API] Skipping trace fetch. Filter: ${itemTypeFilter}`);
        }

        // --- Combine results ---
        const totalTraceCount = tracesCount ?? 0; // Primarily for trace pagination

        return {
            data: {
                folders: foldersData,
                traces: tracesData,
                path: path,
                currentFolder: currentFolderData, // Include current folder info
                totalCount: totalTraceCount
            },
            error: null
        };
    } catch (error) {
        console.error("Error fetching directory listing:", error);
        const apiError: ApiError = {
              message: error instanceof Error ? error.message : "Failed to fetch directory contents",
              code: (error as PostgrestError)?.code,
              details: (error as PostgrestError)?.details,
              hint: (error as PostgrestError)?.hint,
        };
        return { data: null, error: apiError };
    }
}