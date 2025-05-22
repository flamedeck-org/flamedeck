import * as pako from 'https://esm.sh/pako@2.1.0';
import { JSON_parse } from 'npm:uint8array-json-parser';
import Long from 'https://esm.sh/long@5.2.3';
import {
  type ImporterDependencies,
  importProfilesFromArrayBuffer,
  type ProfileType,
} from '../../../packages/speedscope-import/src/index.ts';
import { ProfileGroup } from '../../../packages/speedscope-core/src/profile.ts';

// Define the expected return type
export type ProfileLoadResult = {
  profileGroup: ProfileGroup;
  profileType: ProfileType;
} | null;

// New function to parse an already fetched ArrayBuffer
export async function parseProfileBuffer(
  profileArrayBuffer: ArrayBuffer,
  fileName: string
): Promise<ProfileLoadResult> {
  console.log('[Shared Loader] Decompressing profile buffer...');
  const decompressed = pako.inflate(new Uint8Array(profileArrayBuffer));
  console.log('[Shared Loader] Profile buffer decompressed.');

  // Ensure Long is imported correctly from CDN
  if (!Long || !Long.isLong) {
    throw new Error('[Shared Loader] Failed to import Long library from CDN.');
  }

  // Construct dependencies, now including LongType
  const importerDeps: ImporterDependencies = {
    inflate: pako.inflate,
    parseJsonUint8Array: JSON_parse,
    LongType: Long, // <-- Provide the Long class imported from CDN
  };

  console.log('[Shared Loader] Importing profile group from buffer...');
  const importResult = await importProfilesFromArrayBuffer(
    fileName, // Use the provided filename
    decompressed.buffer,
    importerDeps // Pass the complete deps object
  );

  if (!importResult?.profileGroup) {
    throw new Error(
      `Failed to import profile group from trace data (File: ${fileName}). Importer returned null/empty.`
    );
  }

  console.log('[Shared Loader] Profile group imported successfully from buffer.');
  return importResult; // Return the full importResult object
}