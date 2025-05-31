import type { ProfileGroup } from '@flamedeck/speedscope-core/profile';

export interface ProfileLoadResult {
    profileGroup: ProfileGroup;
    arrayBuffer: ArrayBuffer;
}

export interface FlamegraphSnapshotResult {
    status: 'success' | 'error' | 'success_with_warning';
    publicUrl: string | null;
    base64Image: string | null;
    message: string;
}

export type TraceSource = string; // Either local file path or Flamedeck URL 