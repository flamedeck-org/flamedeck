// Default Supabase function URL (can be overridden)
const DEFAULT_SUPABASE_FUNCTIONS_URL = 'https://jczffinsulwdzhgzggcj.supabase.co/functions/v1';
// Default Flamedeck application URL
const DEFAULT_FLAMEDECK_URL = 'https://www.flamedeck.com';

/**
 * Optional metadata fields for the trace upload.
 */
export interface TraceMetadata {
  scenario: string;
  commitSha?: string | null;
  branch?: string | null;
  notes?: string | null;
  folderId?: string | null; // UUID
  /** Optional: JSON metadata to store alongside the trace. Can be an object or a pre-stringified JSON. */
  metadata?: Record<string, unknown> | string | null;
}

/**
 * Options for uploading a trace.
 */
export interface UploadOptions extends TraceMetadata {
  /** The Flamedeck API key with trace:upload scope. */
  apiKey: string;
  /** The trace data to upload (Blob or ArrayBuffer). */
  traceData: Blob | ArrayBuffer;
  /** The original filename of the trace. */
  fileName: string;
  /** Optional: Whether the trace should be publicly viewable. Defaults to false. */
  public?: boolean;
  /** Optional: Override the base URL for the Supabase functions endpoint. */
  supabaseFunctionsUrl?: string;
}

/**
 * Result of a successful trace upload.
 */
export interface UploadResult {
  /** The unique ID (UUID) of the uploaded trace record. */
  id: string;
  /** The full URL to view the uploaded trace in Flamedeck. */
  viewUrl: string;
}

/**
 * Custom error class for upload failures.
 */
export class UploadError extends Error {
  public status: number;
  public details?: unknown; // Use unknown instead of any for better type safety

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'UploadError';
    this.status = status;
    this.details = details;
    // Set the prototype explicitly for correct instanceof checks
    Object.setPrototypeOf(this, UploadError.prototype);
  }
}

/**
 * Uploads a trace file to the Flamedeck API endpoint.
 *
 * @param options - The upload options including API key, trace data, filename, and metadata.
 * @returns A promise that resolves with the ID and view URL of the uploaded trace.
 * @throws {UploadError} If the upload fails due to network issues, API errors, or invalid input.
 */
export async function uploadTraceToApi(options: UploadOptions): Promise<UploadResult> {
  const {
    apiKey,
    traceData,
    fileName,
    scenario,
    commitSha,
    branch,
    notes,
    folderId,
    metadata,
    supabaseFunctionsUrl = DEFAULT_SUPABASE_FUNCTIONS_URL,
    public: isPublic,
  } = options;

  if (!apiKey) {
    throw new UploadError('API key is required', 401);
  }
  if (!traceData) {
    throw new UploadError('Trace data is required', 400);
  }
  if (!fileName) {
    throw new UploadError('File name is required', 400);
  }
  if (!scenario) {
    throw new UploadError('Scenario is required', 400);
  }

  const params = new URLSearchParams();
  params.set('fileName', fileName);
  params.set('scenario', scenario);
  if (commitSha) params.set('commitSha', commitSha);
  if (branch) params.set('branch', branch);
  if (notes) params.set('notes', notes);
  if (folderId) params.set('folderId', folderId);
  if (metadata !== null && metadata !== undefined) {
    let metadataString: string;
    if (typeof metadata === 'string') {
      metadataString = metadata;
    } else {
      try {
        metadataString = JSON.stringify(metadata);
      } catch (e) {
        throw new UploadError('Invalid metadata object: failed to stringify', 400, e);
      }
    }
    if (metadataString) {
      params.set('metadata', metadataString);
    }
  }
  if (isPublic === true) {
    params.set('public', 'true');
  }

  const apiUrl = `${supabaseFunctionsUrl}/api-upload-trace?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/octet-stream',
      },
      body: traceData,
      // Note: 'duplex: half' might be needed for streams in some environments (like Node < 18 or specific fetch impls),
      // but standard fetch with Blob/ArrayBuffer usually doesn't require it.
      // duplex: 'half'
    });
  } catch (networkError) {
    console.error('Network error during trace upload:', networkError);
    throw new UploadError(`Network error: ${(networkError as Error).message}`, 0); // Status 0 for network errors
  }

  let responseBody: unknown; // Use unknown for initial parsing
  try {
    responseBody = await response.json();
  } catch (jsonError) {
    // Handle cases where the response is not valid JSON (e.g., plain text error from proxy)
    console.error('Failed to parse API response JSON:', jsonError);
    const textBody = await response.text().catch(() => 'Invalid response body'); // Try reading as text
    throw new UploadError(
      `Failed to parse API response (status ${response.status}): ${textBody}`,
      response.status
    );
  }

  if (!response.ok) {
    // Type assertion after checking response.ok is false
    const errorPayload = responseBody as { error?: string; issues?: unknown };
    const errorMessage = errorPayload?.error || `API Error (status ${response.status})`;
    const errorDetails = errorPayload?.issues;
    console.error(`API Error ${response.status}:`, errorMessage, errorDetails || '');
    throw new UploadError(errorMessage, response.status, errorDetails);
  }

  // Type assertion/validation for success payload
  const successPayload = responseBody as { id?: string; [key: string]: unknown };

  if (typeof successPayload?.id !== 'string' || !successPayload.id) {
    console.error('Invalid success response format from API:', responseBody);
    throw new UploadError('Invalid success response format from API', 500);
  }

  const traceId = successPayload.id;
  // Construct the view URL using the hardcoded default
  const viewUrl = `${DEFAULT_FLAMEDECK_URL}/traces/${traceId}/view`;

  // Return ID and the constructed view URL
  return {
    id: traceId,
    viewUrl: viewUrl,
  };
}
