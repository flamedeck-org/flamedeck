import { ProfileType } from "@trace-view-pilot/shared-importer";
import { User } from "@supabase/supabase-js";

export interface UserProfile {
  id: string; // uuid
  username: string | null;
  avatar_url: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

// Shared type for trace metadata used across the app
export interface TraceMetadata {
  id: string; // UUID
  user_id: string; // UUID of the owner
  commit_sha: string | null;
  branch: string | null;
  scenario: string;
  duration_ms: number;
  blob_path: string; // Path in Supabase Storage
  file_size_bytes: number;
  uploaded_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  profile_type: ProfileType | 'unknown';
  notes: string | null;
  owner: UserProfile | null; // Joined user profile data
  folder_id: string | null; // UUID of the parent folder
  upload_source: 'web' | 'api'; // Source of the upload
}

// Type for uploading new traces (subset of TraceMetadata)
export interface TraceUpload {
  commit_sha: string | null;
  branch: string | null;
  scenario: string;
  duration_ms: number;
  file_size_bytes: number;
  profile_type: ProfileType | 'unknown';
  notes: string | null;
  blob_path: string; // Added temporarily during upload, then becomes part of TraceMetadata
}

// Define a structure for API errors
export interface ApiError {
  message: string;
  code?: string; // e.g., Supabase error code like PGRST116
  details?: string; // e.g., Supabase error details
  hint?: string; // e.g., Supabase error hint
  // Add other relevant fields if needed
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null; // Use the structured error type
}

// Type for the trace_comments table row
export interface TraceComment {
  id: string; // uuid
  trace_id: string; // uuid
  user_id: string; // uuid
  parent_comment_id: string | null; // uuid
  content: string; // text
  trace_timestamp_ms: number | null; // integer or bigint
  created_at: string; // timestamptz
  updated_at: string; // timestamptz - Added
  comment_type: string; // Added
  comment_identifier: string | null; // Added
}

// --- NEW: Type for folder contents returned by RPC ---
export interface RecursiveFolderContents {
  folder_ids: string[];
  trace_ids: string[];
  blob_paths: string[];
}
