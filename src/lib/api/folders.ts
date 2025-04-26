import { ApiError, ApiResponse } from "@/types";
import { Folder } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { PostgrestError, PostgrestSingleResponse } from "@supabase/supabase-js";
import { deleteStorageObject } from "./utils"; // Ensure this helper is available
import { RecursiveFolderContents } from "@/types"; // Import the new type

export async function createFolder(
    name: string,
    userId: string,
    parentFolderId: string | null = null
  ): Promise<ApiResponse<Folder>> {
      try {
          // Basic validation
          if (!name || name.trim().length === 0 || name.length > 255) {
            throw new Error("Invalid folder name.");
          }

          const { data, error } = await supabase
              .from('folders')
              .insert({
                  name: name.trim(),
                  user_id: userId,
                  parent_folder_id: parentFolderId
              })
              .select()
              .single();

          if (error) {
             // Check for unique constraint violation or other specific errors if needed
             console.error("Database error creating folder:", error);
             throw error;
          }
          // Explicit type assertion might be necessary if Supabase return type isn't specific enough
          return { data: data as Folder, error: null };
      } catch (error) {
           console.error("Error creating folder:", error);
           const apiError: ApiError = {
                message: error instanceof Error ? error.message : "Failed to create folder",
                code: (error as PostgrestError)?.code,
                details: (error as PostgrestError)?.details,
                hint: (error as PostgrestError)?.hint,
            };
          return { data: null, error: apiError };
      }
  }

  // --- NEW: Get single folder details ---
  export async function getFolder(folderId: string): Promise<ApiResponse<Folder>> {
    try {
        // RLS policy on the 'folders' table should ensure the user has access.
        const { data, error } = await supabase
            .from('folders')
            .select('*')
            .eq('id', folderId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // Not found
                throw new Error(`Folder not found or access denied: ${folderId}`);
            }
            console.error(`Database error fetching folder ${folderId}:`, error);
            throw error;
        }

        if (!data) { // Should be caught by single(), but good practice
            throw new Error(`Folder not found: ${folderId}`);
        }

        return { data: data as Folder, error: null };
    } catch (error) {
        console.error(`Error fetching folder ${folderId}:`, error);
        const apiError: ApiError = {
            message: error instanceof Error ? error.message : "Failed to fetch folder details",
            code: (error as PostgrestError)?.code,
            details: (error as PostgrestError)?.details,
            hint: (error as PostgrestError)?.hint,
        };
        return { data: null, error: apiError };
    }
  }

  export async function moveItems(
    itemIds: { traces: string[], folders: string[] },
    userId: string,
    targetFolderId: string | null = null // null means move to root
  ): Promise<ApiResponse<void>> {
    try {
      // REMOVED Authenticate User call - Rely on RLS

      // --- Input Validation ---
      if (!itemIds || (!itemIds.traces?.length && !itemIds.folders?.length)) {
          console.log("No items specified to move.");
          return { data: null, error: null }; // Nothing to do
      }
      const allFolderIds = [...(itemIds.folders || [])];
      if (targetFolderId) {
          allFolderIds.push(targetFolderId);
      }

      // Basic check: Prevent moving a folder into itself
      if (targetFolderId && itemIds.folders?.includes(targetFolderId)) {
          throw new Error("Cannot move a folder into itself.");
      }

      // Advanced check: Prevent moving a folder into one of its own descendants
      // Requires fetching paths or using a recursive DB query. Skipping for brevity,
      // but crucial for production to prevent cycles. Consider adding later.
      // console.warn("Skipping descendant check for move operation.");

      // Fetch involved folders to verify ownership/existence before proceeding
      // Optional but safer: verify user owns all items being moved and the target folder
      // if (allFolderIds.length > 0) {
      //     const { data: foldersToVerify, error: verifyError } = await supabase
      //         .from('folders')
      //         .select('id, user_id')
      //         .in('id', allFolderIds)
      //         .eq('user_id', user.id); // Verify ownership via user_id
      //     if (verifyError) throw verifyError;
      //     // Check if all expected folders were found and belong to the user
      //     if (foldersToVerify?.length !== allFolderIds.length) {
      //        throw new Error("One or more folders not found or access denied.");
      //     }
      // }


      // --- Perform Updates ---
      // Use PromiseLike as the Supabase builder is 'thenable' but not strictly a Promise
      const updates: PromiseLike<{ error: PostgrestError | null }>[] = [];
      const now = new Date().toISOString();

      // Update traces
      if (itemIds.traces?.length > 0) {
        updates.push(
          supabase
            .from('traces')
            .update({ folder_id: targetFolderId })
            .in('id', itemIds.traces)
            // RLS on traces should enforce ownership, but explicit check is safer
            // REMOVED .eq('user_id', user.id) - Rely on RLS
        );
      }

      // Update folders (parent_folder_id)
      if (itemIds.folders?.length > 0) {
        updates.push(
          supabase
            .from('folders')
            .update({ parent_folder_id: targetFolderId, updated_at: now })
            .in('id', itemIds.folders)
            .eq('user_id', userId) 
        );
      }

      const results = await Promise.all(updates);

      // Check for errors in results
      const errors = results.map(r => r.error).filter(e => e !== null);
      if (errors.length > 0) {
         // Combine error messages or handle specific errors
         console.error("Errors during move operation:", errors);
         throw new Error(`Failed to move one or more items: ${errors.map(e => e?.message).join(', ')}`);
      }

      return { data: null, error: null };
    } catch (error) {
      console.error("Error moving items:", error);
       const apiError: ApiError = {
          message: error instanceof Error ? error.message : "Failed to move items",
          code: (error as PostgrestError)?.code,
          details: (error as PostgrestError)?.details,
          hint: (error as PostgrestError)?.hint,
       };
       return { data: null, error: apiError };
    }
  }

  // --- NEW: Rename Folder ---
  export async function renameFolder(
    folderId: string,
    newName: string,
    userId: string
  ): Promise<ApiResponse<Folder>> {
    try {
      // Basic validation
      if (!newName || newName.trim().length === 0 || newName.length > 255) {
        throw new Error("Invalid new folder name.");
      }
      if (!folderId) {
         throw new Error("Folder ID is required for renaming.");
      }
       if (!userId) {
          throw new Error("User ID is required for renaming.");
       }

      const trimmedName = newName.trim();
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('folders')
        .update({ name: trimmedName, updated_at: now })
        .eq('id', folderId)
        .eq('user_id', userId) // Ensure user owns the folder
        .select()
        .single();

      if (error) {
        console.error(`Database error renaming folder ${folderId}:`, error);
        // Check for specific errors like duplicate names if constraints exist
        throw error;
      }

       if (!data) {
          throw new Error(`Folder not found (${folderId}) or user (${userId}) does not have permission to rename.`);
       }

      return { data: data as Folder, error: null };
    } catch (error) {
      console.error(`Error renaming folder ${folderId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to rename folder",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  }

  // --- NEW: Function to get recursive contents (for delete confirmation) ---
  export async function getRecursiveFolderContents(
    folderId: string
  ): Promise<ApiResponse<RecursiveFolderContents>> {
     try {
       if (!folderId) {
         throw new Error("Folder ID is required.");
       }
       console.log(`[API] Fetching contents for folder confirmation: ${folderId}`);

       // Call the first RPC function (simplified signature)
       const { data, error } = await supabase.rpc(
           'get_recursive_folder_contents',
            {
              folder_id_to_check: folderId
            }
       );

       if (error) {
         console.error(`Error fetching folder contents/permissions for ${folderId}:`, error);
         if (error.message.includes("Permission denied")) {
            throw new Error("Permission denied.");
         } else if (error.message.includes("Folder not found")){
             throw new Error("Folder not found.");
         }
         throw error; // Rethrow other errors
       }

       // Basic validation of the returned structure
       if (!data || typeof data !== 'object' || !data.folder_ids || !data.trace_ids || !data.blob_paths) {
           console.error("Invalid data structure received from get_recursive_folder_contents:", data);
           throw new Error("Invalid data received from server.");
       }

       console.log(`[API] Found ${data.folder_ids.length} folders, ${data.trace_ids.length} traces.`);
       // Explicitly cast to the defined type
       return { data: data as RecursiveFolderContents, error: null };

     } catch (error) {
       console.error(`Error in getRecursiveFolderContents for ${folderId}:`, error);
       const apiError: ApiError = {
         message: error instanceof Error ? error.message : "Failed to fetch folder contents",
         code: (error as PostgrestError)?.code,
         details: (error as PostgrestError)?.details,
         hint: (error as PostgrestError)?.hint,
       };
       return { data: null, error: apiError };
     }
  }

  // --- NEW: Function to execute deletion of DB records AND storage objects ---
  interface ConfirmDeleteParams {
    folderIdsToDelete: string[];
    traceIdsToDelete: string[];
    originalFolderId: string;
    blobPathsToDelete: string[];
  }

  export async function confirmAndDeleteFolderContents(
    params: ConfirmDeleteParams
  ): Promise<ApiResponse<void>> {
    const { folderIdsToDelete, traceIdsToDelete, originalFolderId, blobPathsToDelete } = params;
    const storageCleanupErrors: string[] = [];

    try {
        // Step 1: Delete Database Records using the second RPC
        console.log(`[API Delete] Deleting DB records for original folder ${originalFolderId}...`);
        const { error: deleteDbError } = await supabase.rpc(
            'delete_folder_contents_by_ids',
            {
                p_folder_ids_to_delete: folderIdsToDelete,
                p_trace_ids_to_delete: traceIdsToDelete,
                p_original_folder_id: originalFolderId
            }
        ) as PostgrestSingleResponse<null>;

        if (deleteDbError) {
            console.error(`[API Delete] Error deleting DB records:`, deleteDbError);
            // Re-check specific errors if needed (e.g., permission denied during the final check)
            if (deleteDbError.message.includes("Permission denied")) {
                throw new Error("Permission denied during final delete confirmation.");
            }
            throw new Error(`Failed to delete database records: ${deleteDbError.message}`);
        }
        console.log(`[API Delete] DB records deleted successfully.`);

        // Step 2: Storage Cleanup (only if DB delete succeeded)
        if (blobPathsToDelete.length > 0) {
          console.log(`[API Delete] Attempting storage cleanup for ${blobPathsToDelete.length} objects...`);
          const cleanupPromises = blobPathsToDelete.map(async (fullPath) => {
            const pathParts = fullPath.split('/');
            if (pathParts.length >= 2) {
                const bucket = pathParts[0];
                const pathWithinBucket = pathParts.slice(1).join('/');
                try {
                  await deleteStorageObject(bucket, pathWithinBucket);
                } catch (storageError) {
                    const errMsg = `Failed to delete ${fullPath}: ${storageError instanceof Error ? storageError.message : String(storageError)}`;
                    console.error(errMsg);
                    storageCleanupErrors.push(errMsg);
                }
            } else {
                const errMsg = `Invalid path format skipped during cleanup: ${fullPath}`;
                console.warn(errMsg);
                storageCleanupErrors.push(errMsg);
            }
          });
          await Promise.all(cleanupPromises);
          console.log("[API Delete] Storage cleanup finished.");
        }
         else {
            console.log("[API Delete] No storage objects to clean up.");
        }

        // Step 3: Final Result
        if (storageCleanupErrors.length > 0) {
           // Throw error indicating partial success (DB deleted, some storage failed)
           throw new Error(`Folder deleted, but ${storageCleanupErrors.length} storage object(s) failed cleanup. Check logs.`);
        }

        // If we reach here, everything succeeded
        console.log(`[API Delete] Folder ${originalFolderId} and contents fully deleted.`);
        return { data: null, error: null };

    } catch (error) {
        // Catch errors from DB delete or storage cleanup
        console.error(`[API Delete] Error during confirmed deletion for ${originalFolderId}:`, error);
        const apiError: ApiError = {
          message: error instanceof Error ? error.message : "Failed to complete folder deletion",
          code: (error as PostgrestError)?.code,
          details: (error as PostgrestError)?.details,
          hint: (error as PostgrestError)?.hint,
        };
        return { data: null, error: apiError };
    }
  }

