import { supabase } from '@/integrations/supabase/client';

const API_BASE_URL = import.meta.env.VITE_SUPABASE_URL;
const TRACE_ANALYSIS_FUNCTION_ENDPOINT = `${API_BASE_URL}/functions/v1/trace-analysis`;

export interface TraceAnalysisPayload {
  type: 'start_analysis' | 'user_prompt';
  userId: string;
  traceId: string;
  sessionId: string;
  prompt?: string; // Optional for start_analysis, required for user_prompt
}

export interface TraceAnalysisApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Calls the trace analysis Edge Function.
 * @param payload - The data to send for trace analysis.
 * @param accessToken - Optional Supabase access token for authenticated requests if RLS is configured.
 * @returns The response from the API.
 * @throws Will throw an error if the request fails or the server returns a non-ok response.
 */
export async function callTraceAnalysisApi(
  payload: TraceAnalysisPayload
): Promise<TraceAnalysisApiResponse> {
  // Get the current session to get the access token
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error('No active session');

  if (!payload.userId || !payload.traceId || !payload.sessionId) {
    throw new Error(
      'User ID, Trace ID, and Session ID are required in the payload for trace analysis.'
    );
  }
  if (payload.type === 'user_prompt' && typeof payload.prompt !== 'string') {
    // Allow empty string for prompt, but it must be a string if type is user_prompt
    throw new Error('Prompt is required and must be a string for user_prompt type.');
  }

  const response = await fetch(TRACE_ANALYSIS_FUNCTION_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  let responseData;
  try {
    responseData = await response.json();
  } catch (e) {
    // If response is not JSON, or empty, but status might still be an error
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}. Failed to parse JSON response.`);
    }
    // If response.ok but not JSON (e.g. 204 No Content, though not expected here)
    // Or if it's a 202 Accepted with no body (though flamechart-server sends one)
    // This case needs careful handling based on expected non-JSON success responses.
    // For now, assuming success implies JSON based on flamechart-server's 202 behavior.
    console.warn('[callTraceAnalysisApi] Response was not JSON, but status was ok.', response);
    // Simulate an expected success structure if appropriate, or handle as error/unexpected
    // Based on current knowledge, flamechart-server sends JSON on 202, so this path is less likely for success.
    throw new Error(
      `HTTP error! Status: ${response.status}. Response was not valid JSON but status was ok.`
    );
  }

  if (!response.ok) {
    const errorMsg =
      responseData?.error || responseData?.message || `HTTP error! Status: ${response.status}`;
    console.error(
      '[callTraceAnalysisApi] API request failed:',
      errorMsg,
      'Full response:',
      responseData
    );
    throw new Error(errorMsg);
  }

  console.log('[callTraceAnalysisApi] API request successful:', responseData);
  return responseData as TraceAnalysisApiResponse;
}
