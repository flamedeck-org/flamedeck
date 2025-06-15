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
import { getCachedProfile, setCachedProfile } from './profile-cache.js';

const importerDeps: ImporterDependencies = {
  inflate: pako.inflate,
  parseJsonUint8Array: JSON_parse,
  LongType: Long,
};

export async function loadProfileFromTrace(trace: TraceSource): Promise<ProfileLoadResult> {
  // Check cache first
  const cachedResult = await getCachedProfile(trace);
  if (cachedResult) {
    return cachedResult;
  }

  console.log(`🔄 Loading profile from: ${trace.length > 80 ? trace.slice(0, 80) + '...' : trace}`);

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

  const result: ProfileLoadResult = {
    profileGroup,
    arrayBuffer,
  };

  // Cache the result
  await setCachedProfile(trace, result);

  return result;
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
  const apiKey = process.env['FLAMEDECK_API_KEY'];
  if (!apiKey) {
    throw new Error('FLAMEDECK_API_KEY environment variable is required for Flamedeck URLs');
  }

  // Extract trace ID from URL pattern like: https://www.flamedeck.com/traces/{id}
  const traceIdMatch = url.match(/\/traces\/([^/?#]+)/);
  if (!traceIdMatch) {
    throw new Error(
      'Invalid Flamedeck URL format. Expected: https://www.flamedeck.com/traces/{id}'
    );
  }

  const traceId = traceIdMatch[1];

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(traceId)) {
    throw new Error(`Invalid trace ID format: ${traceId}. Expected a valid UUID.`);
  }

  // Determine the API endpoint based on the URL
  let apiBaseUrl: string;
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    // Local development
    apiBaseUrl = 'http://127.0.0.1:54321/functions/v1';
  } else if (url.includes('flamedeck.com')) {
    // Production (handles both www.flamedeck.com and flamedeck.com)
    apiBaseUrl = 'https://jczffinsulwdzhgzggcj.supabase.co/functions/v1';
  } else {
    throw new Error(
      'Unsupported Flamedeck URL domain. Expected www.flamedeck.com, flamedeck.com, or localhost.'
    );
  }

  const downloadUrl = `${apiBaseUrl}/download-trace?traceId=${encodeURIComponent(traceId)}&format=original`;

  try {
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      // Try to get more detailed error info from the response
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Ignore JSON parsing errors, use the default message
      }

      if (response.status === 401) {
        throw new Error(
          `Authentication failed: ${errorMessage}. Please check your FLAMEDECK_API_KEY.`
        );
      } else if (response.status === 403) {
        throw new Error(
          `Access denied: ${errorMessage}. Your API key may not have 'trace:download' permissions.`
        );
      } else if (response.status === 404) {
        throw new Error(
          `Trace not found: ${errorMessage}. The trace ID may be invalid or you may not have access to it.`
        );
      } else {
        throw new Error(`Failed to download trace: ${errorMessage}`);
      }
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      throw new Error('Downloaded trace data is empty');
    }

    return arrayBuffer;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Network error: Unable to connect to Flamedeck API. Please check your internet connection.`
      );
    }

    // Re-throw our custom errors or wrap unexpected errors
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Unexpected error downloading trace: ${String(error)}`);
    }
  }
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

  const importResult = await importProfileGroupFromText(filename, profileJsonText, importerDeps);

  const profileGroup = importResult?.profileGroup;
  if (!profileGroup) {
    throw new Error('Failed to import profile group from processed data');
  }

  return profileGroup;
}
