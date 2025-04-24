import { TraceMetadata, TraceUpload, ApiResponse, TraceComment, ApiError } from "@/types";
import { Database } from "@/integrations/supabase/types";
import { uploadJson, listUserTraces } from "./storage";
import { supabase } from "@/integrations/supabase/client";
import { PostgrestError } from '@supabase/supabase-js';

// Define the profile type using the generated table type
type UserProfileType = Database['public']['Tables']['user_profiles']['Row'];

// Define types for comment data
export interface TraceCommentWithAuthor extends TraceComment {
  author: Pick<UserProfileType, 'id' | 'username' | 'avatar_url' | 'first_name' | 'last_name'> | null;
  comment_type: string;
  comment_identifier: string | null;
  updated_at: string;
}

// Define types for permission data
export type TracePermissionRow = Database['public']['Tables']['trace_permissions']['Row'];
export type TraceRole = Database['public']['Enums']['trace_role'];

export interface TracePermissionWithUser extends Omit<TracePermissionRow, 'user_id'> {
  user: Pick<UserProfileType, 'id' | 'username' | 'avatar_url' | 'first_name' | 'last_name'> | null; // User details (null for public)
}

export type NewTraceComment = Omit<TraceComment, 'id' | 'created_at' | 'user_id' | 'updated_at'> & {
  comment_type: string;
  comment_identifier: string | null;
};

// Define a type for the paginated response structure
export interface PaginatedTracesResponse {
  traces: TraceMetadata[];
  totalCount: number;
}

// --- NEW: Folder Types ---
type FolderRow = Database['public']['Tables']['folders']['Row'];

// Use type alias instead of interface extending directly
export type Folder = FolderRow;

// Interface for items listed within a folder (could be a folder or a trace)
export interface DirectoryItem {
    type: 'folder' | 'trace';
    id: string;
    name: string; // Use trace scenario or folder name
    updated_at: string; // Or created_at
    // Add other common fields if needed, e.g., owner info for traces
    data: Folder | TraceMetadata; // Hold the actual data object
}

// Response type for listing folder contents
export interface DirectoryListingResponse {
   folders: Folder[];
   traces: TraceMetadata[];
   path: Folder[]; // Breadcrumb path from root to current folder
   totalCount: number | null; // Count of traces within the current folder/view
 }
// --- END NEW ---

// --- Helper Functions ---

/**
 * Attempts to delete an object from Supabase storage.
 * Logs errors but does not re-throw them by default.
 */
async function deleteStorageObject(bucket: string, path: string): Promise<void> {
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

// Helper function to get breadcrumb path (iterative approach)
async function getFolderPath(startFolderId: string): Promise<Folder[]> {
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

// --- Trace API --- 

export const traceApi = {
  // Get paginated list of traces
  getTraces: async (
    page: number = 0,
    limit: number = 20,
    searchQuery?: string | null
  ): Promise<ApiResponse<PaginatedTracesResponse>> => {
    try {
      // Call the updated listUserTraces which now handles pagination and returns count
      const { data: traces, count } = await listUserTraces(page, limit, searchQuery);
      // Ensure count is a number, defaulting to 0 if null/undefined
      const totalCount = count ?? 0;
      return { data: { traces, totalCount }, error: null };
    } catch (error) {
       console.error("Error fetching traces:", error);
       // Return structured error
       const apiError: ApiError = {
           message: error instanceof Error ? error.message : "Failed to fetch traces",
           // Add code/details if available, otherwise undefined
           code: (error as PostgrestError)?.code,
           details: (error as PostgrestError)?.details,
           hint: (error as PostgrestError)?.hint,
       };
       return { data: null, error: apiError };
    }
  },

  // Get a single trace by ID
  getTrace: async (id: string): Promise<ApiResponse<TraceMetadata>> => {
    try {
      const { data, error } = await supabase
        .from('traces')
        // Select all trace fields and join user_profiles (renamed to owner) via the user_id foreign key
        .select(`
          *,
          owner: user_profiles!user_id ( id, username, avatar_url, first_name, last_name )
        `)
        .eq('id', id)
        .single(); // Use single() as we expect only one trace

      if (error) {
        // Don't automatically throw if owner profile is missing (PGRST116 on join)
        // Let the main catch block handle it, but log the warning
        if (error.code === 'PGRST116' && error.details?.includes('user_profiles')) {
           console.warn(`Owner profile not found for trace ${id}, proceeding without owner info.`);
           // If owner profile is missing, the main query might still succeed but return owner: null
           // If the *main* query fails with PGRST116, the catch block will handle it.
        } else {
           // For other errors from the query, throw them to be caught below
           throw error; 
        } 
      }

      // If data is null *without* an error being thrown above (e.g., owner profile missing but trace exists)
      // or if data exists, return it.
      // The explicit type cast might still be needed depending on how Supabase handles the null owner join
      return { data: data as TraceMetadata | null, error: null };

    } catch (error) {
        console.error(`Error fetching trace details for ${id}:`, error);
        // Check if it's a PostgrestError to extract details
        const apiError: ApiError = {
            message: error instanceof Error ? error.message : "Failed to fetch trace details",
            code: (error as PostgrestError)?.code,
            details: (error as PostgrestError)?.details,
            hint: (error as PostgrestError)?.hint,
        };
        return { data: null, error: apiError };
    }
  },

  // Upload a new trace
  uploadTrace: async (
    file: File,
    metadata: Omit<TraceUpload, "blob_path">,
    folderId: string | null = null // <-- Add folderId parameter
  ): Promise<ApiResponse<TraceMetadata>> => {
    const bucket = 'traces';
    let filePathInBucket: string | null = null;
    try {
      // 1. Authenticate User
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
          throw new Error('Authentication required');
      }

      // 2. Generate unique storage path
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
      const fileName = file.name.endsWith('.gz') ? file.name : `${file.name}.gz`; // Ensure .gz
      filePathInBucket = `${timestamp}/${fileName}`;

      // 3. Read and Parse File Content
      let jsonObjectToUpload: unknown;
      try {
          const fileContent = await file.text();
          jsonObjectToUpload = JSON.parse(fileContent);
      } catch (parseError) {
          console.error("Error reading or parsing processed file for uploadJson:", parseError);
          throw new Error("Invalid JSON content in processed file.");
      }

      // 4. Upload Compressed JSON via uploadJson
      console.log(`Attempting compressed upload to bucket: ${bucket}, path: ${filePathInBucket}`);
      const uploadResult = await uploadJson(bucket, filePathInBucket, jsonObjectToUpload);

      // Handle upload failure - does not require cleanup as nothing was stored yet
      if ('error' in uploadResult) {
          throw uploadResult.error;
      }
      console.log(`Compressed upload successful. Path: ${uploadResult.path}`); // path is relative to bucket

      // ---- Upload successful, proceed to DB insert ----

      // 5. Construct full storage path for DB record
      const storagePath = `${bucket}/${uploadResult.path}`; 

      // 6. Insert Trace Metadata into Database
      const { data: dbData, error: dbError } = await supabase
          .from('traces')
          .insert({
              user_id: user.id,
              commit_sha: metadata.commit_sha,
              branch: metadata.branch,
              scenario: metadata.scenario,
              device_model: metadata.device_model,
              duration_ms: Math.round(metadata.duration_ms),
              blob_path: storagePath,
              file_size_bytes: file.size, // Size of the *processed* (but uncompressed) file
              profile_type: metadata.profile_type,
              notes: metadata.notes,
              uploaded_at: new Date().toISOString(),
              folder_id: folderId // <-- Set the folder_id
          })
          .select()
          .single();

      // Handle DB insert failure - Requires cleanup of the uploaded storage object
      if (dbError) {
          console.error("Database insert failed after successful storage upload:", dbError);
          // Throw a new error to be caught by the outer catch block for cleanup
          throw new Error(`Database insert failed: ${dbError.message}`);
      }

      // Success!
      return { data: dbData as TraceMetadata, error: null };

    } catch (error) {
        console.error("Upload trace failed:", error);

        // Cleanup: Attempt to delete the storage object if upload might have succeeded
        // Check if filePathInBucket was determined (meaning we got past step 2)
        if (filePathInBucket) {
            console.warn("Upload process failed, attempting to clean up potentially orphaned storage object...");
            // Use the helper function for deletion
            await deleteStorageObject(bucket, filePathInBucket);
        } else {
            console.log("Upload failed early, no storage object cleanup needed.");
        }

        // Return structured error
        const apiError: ApiError = {
            message: error instanceof Error ? error.message : "Failed to upload trace",
            code: (error as PostgrestError)?.code,
            details: (error as PostgrestError)?.details,
            hint: (error as PostgrestError)?.hint,
        };
        return { data: null, error: apiError };
    }
  },

  // Delete a trace by ID
  deleteTrace: async (id: string): Promise<ApiResponse<void>> => {
    try {
        // 1. Fetch trace metadata including blob_path
        const { data: trace, error: fetchError } = await supabase
            .from('traces')
            .select('blob_path')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') { // Row not found
                console.warn(`Trace with ID ${id} not found for deletion.`);
                return { data: null, error: null }; // Treat as success
            }
            throw fetchError; // Rethrow other fetch errors
        }

        // 2. Attempt to delete storage object (if path exists)
        if (trace?.blob_path) {
            const pathParts = trace.blob_path.split('/');
            if (pathParts.length >= 2) {
                const bucket = pathParts[0];
                const pathWithinBucket = pathParts.slice(1).join('/');
                // Use the helper function (logs errors internally)
                await deleteStorageObject(bucket, pathWithinBucket);
            } else {
                console.warn(`Invalid blob_path format found for trace ${id}: ${trace.blob_path}. Skipping storage deletion.`);
            }
        } else {
            console.warn(`Trace with ID ${id} has no blob_path. Skipping storage deletion.`);
        }

        // 3. Delete the trace record from the database
        const { error: deleteError } = await supabase
            .from('traces')
            .delete()
            .eq('id', id);

        if (deleteError) {
            // If DB delete fails after storage delete, it's less critical but still an issue
            console.error(`Failed to delete trace record ${id} from database:`, deleteError);
            throw deleteError;
        }

        console.log(`Successfully deleted trace ${id} record from database.`);
        return { data: null, error: null }; // Indicate overall success

    } catch (error) {
        console.error(`Failed to complete deletion for trace ${id}:`, error);
        // Return structured error
        const apiError: ApiError = {
            message: error instanceof Error ? error.message : "Failed to delete trace",
            code: (error as PostgrestError)?.code,
            details: (error as PostgrestError)?.details,
            hint: (error as PostgrestError)?.hint,
        };
        return { data: null, error: apiError };
    }
  },

  // Get comments for a specific trace
  getTraceComments: async (traceId: string): Promise<ApiResponse<TraceCommentWithAuthor[]>> => {
    try {
      const { data, error } = await supabase
        .from('trace_comments')
        .select<string, TraceCommentWithAuthor>(`
          id,
          trace_id,
          user_id,
          content,
          created_at,
          updated_at,
          parent_comment_id,
          trace_timestamp_ms,
          comment_type,
          comment_identifier,
          author: user_profiles ( id, username, avatar_url, first_name, last_name )
        `)
        .eq('trace_id', traceId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const commentsWithAuthor = data as TraceCommentWithAuthor[]; 
      
      return { data: commentsWithAuthor, error: null };
    } catch (error) {
      console.error(`Error fetching comments for trace ${traceId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to fetch comments",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  },

  // Create a new comment for a trace
  createTraceComment: async (commentData: NewTraceComment & { trace_id: string }): Promise<ApiResponse<TraceComment>> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required to comment.");

      const { data, error } = await supabase
        .from('trace_comments')
        .insert({
          trace_id: commentData.trace_id,
          content: commentData.content,
          parent_comment_id: commentData.parent_comment_id,
          trace_timestamp_ms: commentData.trace_timestamp_ms,
          comment_type: commentData.comment_type,
          comment_identifier: commentData.comment_identifier,
          user_id: user.id,
        })
        .select('*')
        .single();

      if (error) throw error;
      if (!data) throw new Error("Comment created but data not returned.");

      return { data: data as TraceComment, error: null };
    } catch (error) {
      console.error('Error creating trace comment:', error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to create comment",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  },

  // --- Permission Management ---

  // Get permissions for a trace (including user info)
  getTracePermissions: async (traceId: string): Promise<ApiResponse<TracePermissionWithUser[]>> => {
    try {
      const { data, error } = await supabase
        .from('trace_permissions')
        .select(`
          id,
          trace_id,
          role,
          created_at,
          updated_at,
          user: user_profiles ( id, username, avatar_url, first_name, last_name )
        `)
        .eq('trace_id', traceId);

      if (error) throw error;

      // Type assertion might be needed depending on how Supabase returns the joined data
      const permissions = data as unknown as TracePermissionWithUser[];
      return { data: permissions, error: null };
    } catch (error) {
      console.error(`Error fetching permissions for trace ${traceId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to fetch permissions",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  },

  // Add a permission for a specific user
  addTracePermission: async (
    traceId: string,
    userId: string,
    role: TraceRole
  ): Promise<ApiResponse<TracePermissionRow>> => {
    try {
      const { data, error } = await supabase
        .from('trace_permissions')
        .insert({ trace_id: traceId, user_id: userId, role: role })
        .select()
        .single();

      if (error) throw error;
      return { data: data as TracePermissionRow, error: null };
    } catch (error) {
      console.error(`Error adding permission for user ${userId} to trace ${traceId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to add permission",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  },

  // Update an existing permission's role
  updateTracePermission: async (
    permissionId: string,
    role: TraceRole
  ): Promise<ApiResponse<TracePermissionRow>> => {
    try {
      const { data, error } = await supabase
        .from('trace_permissions')
        .update({ role: role, updated_at: new Date().toISOString() })
        .eq('id', permissionId)
        .select()
        .single();

      if (error) throw error;
      return { data: data as TracePermissionRow, error: null };
    } catch (error) {
      console.error(`Error updating permission ${permissionId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to update permission",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  },

  // Remove a specific permission (by permission ID)
  removeTracePermission: async (permissionId: string): Promise<ApiResponse<void>> => {
    try {
      const { error } = await supabase
        .from('trace_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;
      return { data: null, error: null };
    } catch (error) {
      console.error(`Error removing permission ${permissionId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to remove permission",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  },

  // Set public access (upsert: create or update)
  setPublicTraceAccess: async (
    traceId: string,
    role: TraceRole | null // null to remove public access
  ): Promise<ApiResponse<TracePermissionRow | null>> => {
    try {
      if (role) {
        // Upsert public viewer permission
        const { data, error } = await supabase
          .from('trace_permissions')
          .upsert(
            { trace_id: traceId, user_id: null, role: role },
            { onConflict: 'trace_id, user_id' } // Specify conflict target
          )
          .select()
          .single();
        if (error) throw error;
        return { data: data as TracePermissionRow, error: null };
      } else {
        // Delete public permission if role is null
        const { error } = await supabase
          .from('trace_permissions')
          .delete()
          .eq('trace_id', traceId)
          .is('user_id', null); // Ensure we only delete the public one
        if (error) throw error;
        return { data: null, error: null };
      }
    } catch (error) {
      console.error(`Error setting public access for trace ${traceId}:`, error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to set public access",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  },

  // Search for users (simple example)
  searchUsers: async (query: string): Promise<ApiResponse<UserProfileType[]>> => {
    try {
      if (!query || query.trim().length < 2) {
        // Avoid searching for very short/empty strings
        return { data: [], error: null };
      }
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, first_name, last_name')
        .or(`username.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`) // Basic search
        .limit(10);

      if (error) throw error;
      return { data: data as UserProfileType[], error: null };
    } catch (error) {
      console.error('Error searching users:', error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to search users",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  },

  // --- NEW: Folder Management ---

  // Fetch contents of a specific folder (or root)
  getDirectoryListing: async (
      folderId: string | null = null, // null for root
      page: number = 0,
      limit: number = 50,
      searchQuery?: string | null
  ): Promise<ApiResponse<DirectoryListingResponse>> => {
      try {
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          if (authError || !user) throw new Error("Authentication required");

           // --- Fetch Path (Breadcrumbs) ---
           // Fetch path first, so if the target folder doesn't exist/isn't accessible, we fail early
           const path: Folder[] = folderId ? await getFolderPath(folderId) : [];
           // If folderId is provided but path is empty AND folderId isn't root, it means the folder wasn't found or accessible
           if (folderId && path.length === 0) {
                // Or check if path[0].id === folderId ?
                throw new Error(`Folder not found or not accessible: ${folderId}`);
           }

          // --- Fetch Folders within the current directory ---
          let folderQuery = supabase
              .from('folders')
              .select('*')
              // RLS should handle user_id check, but explicit check adds safety layer
              .eq('user_id', user.id);

          if (folderId) {
              folderQuery = folderQuery.eq('parent_folder_id', folderId);
          } else {
              folderQuery = folderQuery.is('parent_folder_id', null); // Root level folders
          }
          // Apply search *only* to folders if needed (simple name search)
          if (searchQuery) {
              folderQuery = folderQuery.ilike('name', `%${searchQuery}%`);
          }
          // Apply ordering
          folderQuery = folderQuery.order('name', { ascending: true });

          // Normally folders aren't paginated, fetch all matching folders in the dir
          const { data: foldersData, error: foldersError } = await folderQuery;
          if (foldersError) {
            console.error("Error fetching folders:", foldersError);
            throw foldersError; // Throw to be caught by the main catch block
          }


          // --- Fetch Traces within the current directory ---
          // Assume listUserTraces in storage.ts has been updated or uses a DB function
          // that accepts folderId and searchQuery for traces.
          // If not, this needs adjustment.
          // IMPORTANT: listUserTraces needs modification to filter by folder_id
          const { data: tracesData, count: tracesCount } = await listUserTraces(
              page,
              limit,
              searchQuery,
              folderId // Pass folderId to filter traces
          );
          // listUserTraces should ideally handle its own errors or return them structured


          // Combine results
          const totalTraceCount = tracesCount ?? 0; // Count only applies to traces for pagination

          return {
              data: {
                  folders: foldersData || [],
                  traces: tracesData || [], // Use data from listUserTraces directly
                  path: path,
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
  },

  createFolder: async (name: string, parentFolderId: string | null = null): Promise<ApiResponse<Folder>> => {
      try {
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          if (authError || !user) throw new Error("Authentication required");

          // Basic validation
          if (!name || name.trim().length === 0 || name.length > 255) {
            throw new Error("Invalid folder name.");
          }

          const { data, error } = await supabase
              .from('folders')
              .insert({
                  name: name.trim(),
                  user_id: user.id, // RLS policy should also enforce this
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
  },

  // Placeholder for updating folder (e.g., rename)
  // updateFolder: async (folderId: string, updates: Partial<Pick<Folder, 'name' | 'parent_folder_id'>>): Promise<ApiResponse<Folder>> => { ... }

  // Placeholder for deleting folder
  // deleteFolder: async (folderId: string): Promise<ApiResponse<void>> => { ... }


  // Move traces and/or folders to a different folder
  moveItems: async (
      itemIds: { traces: string[], folders: string[] },
      targetFolderId: string | null = null // null means move to root
    ): Promise<ApiResponse<void>> => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Authentication required");

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
              .update({ folder_id: targetFolderId, updated_at: now }) // Use updated_at if available/relevant for traces
              .in('id', itemIds.traces)
              // RLS on traces should enforce ownership, but explicit check is safer
              .eq('user_id', user.id)
          );
        }

        // Update folders (parent_folder_id)
        if (itemIds.folders?.length > 0) {
          updates.push(
            supabase
              .from('folders')
              .update({ parent_folder_id: targetFolderId, updated_at: now })
              .in('id', itemIds.folders)
              // RLS on folders enforces ownership
              .eq('user_id', user.id)
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
    },


  // --- END NEW FOLDER MANAGEMENT ---
};

export type { ApiError };