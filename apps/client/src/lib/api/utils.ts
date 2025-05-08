import { supabase } from "@/integrations/supabase/client";
import type { Folder } from "./types";

// Helper function to get breadcrumb path (iterative approach)
export async function getFolderPath(startFolderId: string): Promise<Folder[]> {
    const path: Folder[] = [];
    let currentId: string | null = startFolderId;
    const MAX_DEPTH = 10; // Prevent infinite loops
    let depth = 0;

    while (currentId && depth < MAX_DEPTH) {
        try {
            const { data: folder, error } = await supabase
                .from('folders')
                .select('*')
                .eq('id', currentId)
                .maybeSingle(); // Use maybeSingle to handle potential nulls/errors gracefully

            if (error) {
                console.error(`Error fetching folder path segment (ID: ${currentId}):`, error);
                // Depending on requirements, you might want to return the partial path or throw
                break; // Stop if there's an error
            }
            if (!folder) {
                 console.warn(`Folder not found during path construction: ${currentId}`);
                // This could happen if a folder was deleted while iterating
                break; // Stop if a folder in the path isn't found
            }

            // Type assertion needed because Supabase types might not perfectly infer FolderRow here
            path.unshift(folder as Folder);
            currentId = folder.parent_folder_id;
            depth++;
        } catch (iterError) {
             console.error(`Unexpected error fetching path segment (ID: ${currentId}):`, iterError);
            break;
        }
    }
     if (depth === MAX_DEPTH) {
       console.warn(`Reached max depth (${MAX_DEPTH}) fetching folder path starting from ${startFolderId}. Path might be incomplete.`);
     }

    return path;
 }

/**
 * Attempts to delete an object from Supabase storage.
 * Logs errors but does not re-throw them by default.
 */
export async function deleteStorageObject(bucket: string, path: string): Promise<void> {
    console.log(`Attempting to delete storage object: bucket=${bucket}, path=${path}`);
    try {
        const { error } = await supabase.storage
            .from(bucket)
            .remove([path]);
        if (error) {
            console.error(`Failed to delete storage object ${path} from bucket ${bucket}:`, error);
            // Decide if this should throw - for cleanup, maybe not?
        } else {
            console.log(`Successfully deleted storage object: bucket=${bucket}, path=${path}`);
        }
    } catch (cleanupError) {
        console.error(`Error during storage object deletion for ${path} in bucket ${bucket}:`, cleanupError);
    }
}
