import { useCallback } from 'react';
import { useMutation, type UseMutationResult } from '@tanstack/react-query'; // Assuming @tanstack/react-query
import * as Sentry from '@sentry/react';
import {
  callTraceAnalysisApi,
  type TraceAnalysisPayload,
  type TraceAnalysisApiResponse,
} from '../lib/api/trace-analysis'; // Adjusted path

// Construct API URL from the project URL
// Example: https://jczffinsulwdzhgzggcj.supabase.co -> https://jczffinsulwdzhgzggcj.supabase.co/functions/v1/trace-analysis-socket
const SUPABASE_PROJECT_URL = import.meta.env.VITE_SUPABASE_URL;
const API_URL = SUPABASE_PROJECT_URL
  ? `${SUPABASE_PROJECT_URL}/functions/v1/trace-analysis-socket`
  : 'http://127.0.0.1:54321/functions/v1/trace-analysis-socket'; // Fallback for local dev, note HTTP

interface ProcessTurnPayload {
  type: 'start_analysis' | 'user_prompt';
  userId: string;
  traceId: string;
  sessionId: string;
  prompt?: string; // Optional for start_analysis, required for user_prompt
}

interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  // Potentially other fields if flamechart-server returns more details on success/error
}

export function useTraceAnalysisApi(): UseMutationResult<
  TraceAnalysisApiResponse,
  Error, // Error type Sentry will capture
  TraceAnalysisPayload
> {
  return useMutation({
    mutationFn: async (payload: TraceAnalysisPayload): Promise<TraceAnalysisApiResponse> => {
      // Basic validation remains useful here before calling the actual API function
      if (!payload.userId || !payload.traceId || !payload.sessionId) {
        const validationError = new Error(
          'User ID, Trace ID, and Session ID are required to process the turn.'
        );
        throw validationError;
      }
      if (payload.type === 'user_prompt' && typeof payload.prompt !== 'string') {
        const validationError = new Error(
          'Prompt is required and must be a string for user_prompt type.'
        );
        throw validationError;
      }
      return callTraceAnalysisApi(payload);
    },
    onError: (error: Error, variables: TraceAnalysisPayload, context: unknown) => {
      Sentry.withScope((scope) => {
        scope.setTag('api_operation', 'processTurn');
        // Ensure variables is an object before trying to spread or access its properties
        const safeVariables = typeof variables === 'object' && variables !== null ? variables : {};
        scope.setContext('api_variables', safeVariables as any); // Be mindful of PII
        if (context) {
          scope.setContext('react_query_context', context as any);
        }
        Sentry.captureException(error);
      });
    },
  });
}
