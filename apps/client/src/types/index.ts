import { ProfileType } from "@trace-view-pilot/shared-importer";
import { User } from "@supabase/supabase-js";

export interface UserProfile {
  id: string; // uuid
  username: string | null;
  avatar_url: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export interface TraceMetadata {
  id: string;
  user_id: string;
  uploaded_at: string;
  commit_sha: string | null;
  branch: string | null;
  scenario: string | null;
  device_model: string | null;
  duration_ms: number | null;
  blob_path: string;
  file_size_bytes: number | null;
  notes?: string | null;
  profile_type?: ProfileType | string | null;
  owner?: UserProfile | null;
  updated_at?: string | null;
}

export interface TraceUpload {
  commit_sha: string;
  branch: string;
  scenario: string;
  device_model: string;
  blob_path: string;
  duration_ms: number;
  profile_type: ProfileType | string;
  notes?: string;
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
