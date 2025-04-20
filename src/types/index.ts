
export interface TraceMetadata {
  id: string;
  user_id: string;
  uploaded_at: string;
  commit_sha: string;
  branch: string;
  scenario: string;
  device_model: string;
  duration_ms: number;
  notes: string;
  blob_path: string;
}

export interface TraceUpload {
  commit_sha: string;
  branch: string;
  scenario: string;
  device_model: string;
  notes: string;
  duration_ms: number;
  blob_path: string;
}

export interface User {
  id: string;
  email: string;
  avatar_url?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
