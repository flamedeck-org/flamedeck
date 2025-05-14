import pako from 'pako'; // Use npm import for pako
import { JSON_parse } from 'uint8array-json-parser'; // Use npm import
import Long from 'long'; // Use npm import for Long

// Import from speedscope-import (workspace import should work)
import {
  type ImporterDependencies,
  importProfilesFromArrayBuffer,
  type ProfileType,
} from '@flamedeck/speedscope-import'; // Adjusted for typical monorepo workspace pathing
import { ProfileGroup } from '@flamedeck/speedscope-core/profile'; // Adjusted for typical monorepo workspace pathing

// Define the expected return type
export type ProfileLoadResult = {
  profileGroup: ProfileGroup;
  profileType: ProfileType;
} | null;

// Function to parse an already fetched ArrayBuffer
export async function parseProfileBuffer(
  profileArrayBuffer: ArrayBuffer,
  fileName: string
): Promise<ProfileLoadResult> {
  console.log('[Node Profile Loader] Decompressing profile buffer...');
  // pako.inflate in Node typically expects a Buffer or Uint8Array
  // The input profileArrayBuffer might already be a Uint8Array if it came from a Buffer.from(arrayBuffer)
  // or if it was directly an ArrayBuffer from fetch, pako can handle it.
  const decompressed = pako.inflate(new Uint8Array(profileArrayBuffer));
  console.log('[Node Profile Loader] Profile buffer decompressed.');

  if (!Long || !Long.isLong) {
    // This check might be less critical if Long is a direct npm dependency,
    // but doesn't hurt.
    throw new Error('[Node Profile Loader] Failed to import Long library.');
  }

  const importerDeps: ImporterDependencies = {
    inflate: pako.inflate, // pako.inflate itself can be passed
    parseJsonUint8Array: JSON_parse,
    LongType: Long,
  };

  console.log('[Node Profile Loader] Importing profile group from buffer...');
  const importResult = await importProfilesFromArrayBuffer(
    fileName,
    decompressed.buffer, // Pass the ArrayBuffer view of the decompressed data
    importerDeps
  );

  if (!importResult?.profileGroup) {
    throw new Error(
      `Failed to import profile group from trace data (File: ${fileName}). Importer returned null/empty.`
    );
  }

  console.log('[Node Profile Loader] Profile group imported successfully from buffer.');
  return importResult;
}
