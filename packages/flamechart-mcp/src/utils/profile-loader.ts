import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
    importProfileGroupFromText,
    type ImporterDependencies,
} from '@flamedeck/speedscope-import';
import pako from 'pako';
import Long from 'long';
import { JSON_parse } from 'uint8array-json-parser';
import type { ProfileLoadResult, TraceSource } from '../types.js';

const importerDeps: ImporterDependencies = {
    inflate: pako.inflate,
    parseJsonUint8Array: JSON_parse,
    LongType: Long,
};

export async function loadProfileFromTrace(trace: TraceSource): Promise<ProfileLoadResult> {
    let arrayBuffer: ArrayBuffer;

    if (trace.startsWith('http://') || trace.startsWith('https://')) {
        // URL case
        if (trace.includes('flamedeck.com')) {
            arrayBuffer = await loadFromFlamdeckUrl(trace);
        } else {
            throw new Error('Only Flamedeck URLs are supported for remote traces');
        }
    } else {
        // Local file path case
        arrayBuffer = await loadFromLocalFile(trace);
    }

    // Process the raw buffer into a profile group
    const profileGroup = await processArrayBufferToProfileGroup(arrayBuffer, trace);

    return {
        profileGroup,
        arrayBuffer,
    };
}

async function loadFromLocalFile(filePath: string): Promise<ArrayBuffer> {
    if (!existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
    }

    try {
        const buffer = await readFile(filePath);
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read file '${filePath}': ${errorMsg}`);
    }
}

async function loadFromFlamdeckUrl(url: string): Promise<ArrayBuffer> {
    const apiKey = process.env.FLAMEDECK_API_KEY;
    if (!apiKey) {
        throw new Error('FLAMEDECK_API_KEY environment variable is required for Flamedeck URLs');
    }

    // TODO: Implement when API endpoint is available
    // Extract trace ID from URL pattern like: https://flamedeck.com/trace/{id}
    const traceIdMatch = url.match(/\/trace\/([^/?#]+)/);
    if (!traceIdMatch) {
        throw new Error('Invalid Flamedeck URL format. Expected: https://flamedeck.com/trace/{id}');
    }

    const traceId = traceIdMatch[1];

    // Placeholder for future API implementation
    throw new Error(
        `Flamedeck URL support is not yet implemented - API endpoint needed for trace ID: ${traceId}. ` +
        'Please provide a local file path instead.'
    );
}

async function processArrayBufferToProfileGroup(
    arrayBuffer: ArrayBuffer,
    filename: string
): Promise<import('@flamedeck/speedscope-core/profile').ProfileGroup> {
    let profileJsonText: string;
    const bodyBuffer = new Uint8Array(arrayBuffer);

    // Check for gzip magic bytes (0x1f, 0x8b)
    if (bodyBuffer.length > 2 && bodyBuffer[0] === 0x1f && bodyBuffer[1] === 0x8b) {
        try {
            profileJsonText = pako.inflate(bodyBuffer, { to: 'string' });
        } catch (e: any) {
            throw new Error(`Invalid gzipped data: ${e.message}`);
        }
    } else {
        profileJsonText = Buffer.from(bodyBuffer).toString('utf-8');
    }

    if (profileJsonText.length === 0) {
        throw new Error('Processed profile data is empty');
    }

    const importResult = await importProfileGroupFromText(
        filename,
        profileJsonText,
        importerDeps
    );

    const profileGroup = importResult?.profileGroup;
    if (!profileGroup) {
        throw new Error('Failed to import profile group from processed data');
    }

    return profileGroup;
} 