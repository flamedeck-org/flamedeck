import type { ApiError } from '@/types';

import { supabase } from '@/integrations/supabase/client';
import type { TraceMetadata } from '@/types';
import type { ApiResponse } from '@/types';
import type { PostgrestError } from '@supabase/supabase-js';
import { deleteStorageObject } from './utils';
import { StandardApiError, createStandardApiError, parseEdgeFunctionError } from './errors';

// Basic metadata needed for trace upload (server will handle processing)
type TraceUploadMetadata = {
  scenario: string;
  commit_sha?: string | null;
  branch?: string | null;
  notes?: string | null;
};

// Get a single trace by ID
export async function getTrace(id: string): Promise<TraceMetadata> {
  try {
    const { data, error } = await supabase
      .from('traces')
      // Select all trace fields and join user_profiles (renamed to owner) via the user_id foreign key
      .select(
        `
          *,
          owner: user_profiles!user_id ( id, username, avatar_url, first_name, last_name )
        `
      )
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

    if (!data) {
      throw new StandardApiError('Trace not found', 'TRACE_NOT_FOUND');
    }

    // If data is null *without* an error being thrown above (e.g., owner profile missing but trace exists)
    // or if data exists, return it.
    // The explicit type cast might still be needed depending on how Supabase handles the null owner join
    return data as TraceMetadata;
  } catch (error) {
    console.error(`Error fetching trace details for ${id}:`, error);
    throw createStandardApiError(error, 'Failed to fetch trace details');
  }
}

// --- NEW: Get Public Trace by ID (using RPC) ---
export async function getPublicTrace(
  id: string
): Promise<ApiResponse<{ id: string; blob_path: string }>> {
  try {
    // Call the RPC function which enforces RLS for the 'anon' role
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_trace_details', {
      trace_uuid: id,
    });

    if (rpcError) {
      console.error(`RPC error fetching public trace details for ${id}:`, rpcError);
      // Handle potential errors, like function not found, etc.
      throw rpcError;
    }

    // rpcData is an array. If it's empty or null, the trace wasn't found or wasn't public (due to RLS)
    if (!rpcData || rpcData.length === 0) {
      return { data: null, error: { message: 'Trace not found or is not public', code: '404' } };
    }

    // The RPC function returns an array, we expect at most one result
    const traceDetails = rpcData[0];

    // Explicitly check if blob_path is present, as it's crucial
    if (!traceDetails.blob_path) {
      console.error(`Public trace details for ${id} received null blob_path from RPC.`);
      return {
        data: null,
        error: { message: 'Public trace data is incomplete (missing blob path)', code: '500' },
      };
    }

    // Return only the id and blob_path provided by the RPC
    return { data: { id: traceDetails.id, blob_path: traceDetails.blob_path }, error: null };
  } catch (error) {
    console.error(`Error fetching public trace details for ${id}:`, error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : 'Failed to fetch public trace details',
      code: (error as PostgrestError)?.code,
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
    };
    return { data: null, error: apiError };
  }
}

// Upload a new trace
export async function uploadTrace(
  file: File,
  metadata: TraceUploadMetadata,
  userId: string,
  folderId: string | null = null,
  makePublic?: boolean
): Promise<TraceMetadata> {
  // Check if userId is provided (basic sanity check, RLS is the main guard)
  if (!userId) {
    throw new StandardApiError('User ID is required');
  }

  // Get the current session for authentication
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new StandardApiError('Authentication required to upload files');
  }

  // Prepare FormData for the unified endpoint
  const formData = new FormData();
  formData.append('file', file);
  formData.append('scenario', metadata.scenario);

  if (metadata.commit_sha) formData.append('commitSha', metadata.commit_sha);
  if (metadata.branch) formData.append('branch', metadata.branch);
  if (metadata.notes) formData.append('notes', metadata.notes);
  if (folderId) formData.append('folderId', folderId);
  if (makePublic) formData.append('public', 'true');

  console.log(`Uploading raw file "${file.name}" to unified endpoint`);

  // Call the unified edge function
  const { data, error } = await supabase.functions.invoke('upload-trace', {
    body: formData,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('Unified upload function error:', error);
    throw await parseEdgeFunctionError(error, 'Failed to upload trace via unified function');
  }

  if (!data) {
    throw new StandardApiError('No data returned from upload function');
  }

  console.log('Unified upload successful:', data);

  // The RPC function returns the trace data, but we need to add owner info for the client
  // Since we're the uploader, we can construct the owner info from the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const traceWithOwner = {
    ...data,
    owner: user
      ? {
          id: user.id,
          username: user.user_metadata?.username || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          first_name: user.user_metadata?.first_name || null,
          last_name: user.user_metadata?.last_name || null,
        }
      : null,
  };

  return traceWithOwner as TraceMetadata;
}

// --- NEW: Rename Trace ---
export async function renameTrace(
  traceId: string,
  newScenario: string,
  userId: string
): Promise<ApiResponse<TraceMetadata>> {
  try {
    // Basic validation
    if (!newScenario || newScenario.trim().length === 0 || newScenario.length > 255) {
      throw new Error('Invalid new scenario name.');
    }
    if (!traceId) {
      throw new Error('Trace ID is required for renaming.');
    }
    if (!userId) {
      throw new Error('User ID is required for renaming.');
    }

    const trimmedScenario = newScenario.trim();

    // Update the scenario field ONLY. RLS should handle ownership check.
    const { data, error } = await supabase
      .from('traces')
      // Remove updated_at from the update payload
      .update({ scenario: trimmedScenario })
      .eq('id', traceId)
      .eq('user_id', userId) // Explicit ownership check for safety
      // Fetch owner details along with the updated trace
      .select(`*, owner:user_profiles!user_id ( id, username, avatar_url, first_name, last_name )`)
      .single();

    if (error) {
      console.error(`Database error renaming trace ${traceId}:`, error);
      throw error;
    }

    if (!data) {
      // This could mean trace not found OR user doesn't own it
      throw new Error(
        `Trace not found (${traceId}) or user (${userId}) does not have permission to rename.`
      );
    }

    // We need to potentially re-process the owner field similar to listUserTraces
    const traceData = data as TraceMetadata;

    return { data: traceData, error: null };
  } catch (error) {
    console.error(`Error renaming trace ${traceId}:`, error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : 'Failed to rename trace',
      code: (error as PostgrestError)?.code,
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
    };
    return { data: null, error: apiError };
  }
}

// Delete a trace by ID
export async function deleteTrace(id: string): Promise<ApiResponse<void>> {
  try {
    // 1. Fetch trace metadata including blob_path
    const { data: trace, error: fetchError } = await supabase
      .from('traces')
      .select('blob_path')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // Row not found
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
        console.warn(
          `Invalid blob_path format found for trace ${id}: ${trace.blob_path}. Skipping storage deletion.`
        );
      }
    } else {
      console.warn(`Trace with ID ${id} has no blob_path. Skipping storage deletion.`);
    }

    // 3. Delete the trace record from the database
    const { error: deleteError } = await supabase.from('traces').delete().eq('id', id);

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
      message: error instanceof Error ? error.message : 'Failed to delete trace',
      code: (error as PostgrestError)?.code,
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
    };
    return { data: null, error: apiError };
  }
}
