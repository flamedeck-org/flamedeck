
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
