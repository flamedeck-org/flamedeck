import type { Database } from '@/integrations/supabase/types';
import type { TraceComment, TraceMetadata } from '@/types';

// Define the profile type using the generated table type
export type UserProfileType = Database['public']['Tables']['user_profiles']['Row'];

// Define types for comment data
export interface TraceCommentWithAuthor extends TraceComment {
  author: Pick<
    UserProfileType,
    'id' | 'username' | 'avatar_url' | 'first_name' | 'last_name'
  > | null;
  comment_type: string;
  comment_identifier: string | null;
  updated_at: string;
  is_edited: boolean;
  last_edited_at: string | null;
  is_deleted: boolean;
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
  currentFolder: Folder | null; // Add current folder details
}

// --- NEW: Response type for fetching folder context (path and current folder) ---
export interface FolderContextResponse {
  path: Folder[];
  currentFolder: Folder | null;
}

// --- NEW: Response type for fetching ONLY the contents of a directory ---
export interface DirectoryListingContentsResponse {
  folders: Folder[];
  traces: TraceMetadata[];
  totalCount: number; // Primarily for trace pagination
}

// --- Options for getDirectoryListing ---
export interface DirectoryListingOptions {
  userId: string;
  page?: number;
  limit?: number;
  searchQuery?: string | null;
  itemTypeFilter?: 'folder' | 'trace' | 'all';
  // searchScope?: 'current' | 'global'; // Future enhancement: Allow global search
}
