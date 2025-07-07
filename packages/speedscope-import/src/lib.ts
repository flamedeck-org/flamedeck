import * as pako from 'pako';
import { JSON_parse } from 'uint8array-json-parser';
import Long from 'long';
import {
    importProfileGroupFromText,
    importProfilesFromArrayBuffer,
    type ProfileType,
} from './speedscope-import/index.js';
import type { ImporterDependencies } from './speedscope-import/importer-utils.js';
import type { ProfileGroup } from '@flamedeck/speedscope-core/profile.js';

// Define the result type locally since it's not exported
export interface ImportResult {
    profileGroup: ProfileGroup | null;
    profileType: ProfileType;
}

// Set up dependencies for Node.js environment
const nodeDependencies: ImporterDependencies = {
    inflate: pako.inflate,
    parseJsonUint8Array: JSON_parse,
    LongType: Long,
};

/**
 * Import a performance profile from various formats.
 * Automatically detects input type and uses appropriate parsing method.
 * 
 * @param input - Profile data as string, ArrayBuffer, or Buffer
 * @param fileName - Name of the profile file (used for format detection)
 * @returns Promise resolving to profile data in Speedscope format
 */
export async function importProfile(
    input: string | ArrayBuffer | Buffer,
    fileName: string
): Promise<ImportResult> {
    if (typeof input === 'string') {
        // Handle text input (JSON profiles like Chrome DevTools)
        return await importProfileGroupFromText(fileName, input, nodeDependencies);
    } else {
        // Handle binary input (ArrayBuffer or Buffer)
        let arrayBuffer: ArrayBuffer;

        if (Buffer.isBuffer(input)) {
            // Convert Buffer to ArrayBuffer
            arrayBuffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
        } else {
            // Already an ArrayBuffer
            arrayBuffer = input;
        }

        return await importProfilesFromArrayBuffer(fileName, arrayBuffer, nodeDependencies);
    }
}

// Re-export useful types for consumers  
export type { ProfileType } from './speedscope-import/index.js';
export type { ProfileGroup, Profile } from '@flamedeck/speedscope-core/profile.js'; 