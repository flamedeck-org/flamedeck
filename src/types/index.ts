export interface TraceMetadata {
  id: string;
  user_id: string;
  uploaded_at: string;
  commit_sha: string;
  branch: string;
  scenario: string;
  device_model: string;
  duration_ms: number;
  blob_path: string;
  file_size_bytes: number;
  notes?: string;
}

export interface TraceUpload {
  commit_sha: string;
  branch: string;
  scenario: string;
  device_model: string;
  blob_path: string;
  duration_ms: number;
  notes?: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// Add or ensure this UserProfile type is exported
export interface UserProfile {
  id: string; // uuid
  username: string | null;
  avatar_url: string | null;
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
}
