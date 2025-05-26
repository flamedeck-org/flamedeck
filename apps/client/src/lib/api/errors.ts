import type { ApiError } from '@/types';
import type { PostgrestError } from '@supabase/supabase-js';

// Standardized API Error class that can be thrown and caught by React Query
export class StandardApiError extends Error {
    public readonly code?: string;
    public readonly details?: string;
    public readonly hint?: string;

    constructor(message: string, code?: string, details?: string, hint?: string) {
        super(message);
        this.name = 'StandardApiError';
        this.code = code;
        this.details = details;
        this.hint = hint;
    }

    // Convert to the ApiError type for backwards compatibility
    toApiError(): ApiError {
        return {
            message: this.message,
            code: this.code,
            details: this.details,
            hint: this.hint,
        };
    }
}

// Helper function to convert various error types to StandardApiError
export function createStandardApiError(error: unknown, defaultMessage = 'An error occurred'): StandardApiError {
    if (error instanceof StandardApiError) {
        return error;
    }

    if (error && typeof error === 'object') {
        const pgError = error as PostgrestError;
        if (pgError.message) {
            return new StandardApiError(
                pgError.message,
                pgError.code,
                pgError.details,
                pgError.hint
            );
        }
    }

    if (error instanceof Error) {
        return new StandardApiError(error.message);
    }

    return new StandardApiError(defaultMessage);
}

// Helper function to parse edge function errors and extract structured error details
export async function parseEdgeFunctionError(error: any, defaultMessage = 'Edge function error'): Promise<StandardApiError> {
    let errorMessage = error.message || defaultMessage;
    let errorCode = null;
    let errorHint = null;

    // Parse the actual error response from the edge function
    try {
        if (error.context?.body) {
            const errorResponse = await new Response(error.context.body).json();
            console.log('Parsed edge function error response:', errorResponse);

            if (errorResponse.error) errorMessage = errorResponse.error;
            if (errorResponse.code) errorCode = errorResponse.code;
            if (errorResponse.hint) errorHint = errorResponse.hint;
        }
    } catch (parseError) {
        console.warn('Failed to parse edge function error response body:', parseError);
        // Fall back to checking error.context object structure
        if (error.context && typeof error.context === 'object') {
            const context = error.context as any;
            if (context.error) errorMessage = context.error;
            if (context.code) errorCode = context.code;
            if (context.hint) errorHint = context.hint;
        }
    }

    return new StandardApiError(errorMessage, errorCode, null, errorHint);
} 