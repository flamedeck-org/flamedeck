import { supabase } from '@/integrations/supabase/client';
import type { PostgrestError } from '@supabase/supabase-js';
import type { ApiError, ApiResponse } from '@/types';
// import * as bcrypt from "bcrypt-ts"; // No longer needed, hashing done in RPC

// Type for displaying API key info (excluding the hash and preview)
export interface ApiKeyDisplayData {
  id: string;
  description: string | null;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

// --- List User API Keys ---
export async function listUserApiKeys(userId: string): Promise<ApiResponse<ApiKeyDisplayData[]>> {
  if (!userId) {
    return { data: null, error: { message: 'User ID is required' } };
  }

  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, description, scopes, created_at, last_used_at, is_active')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Return the data directly (it no longer contains key_hash)
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error listing API keys:', error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : 'Failed to list API keys',
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
      code: (error as PostgrestError)?.code,
    };
    return { data: null, error: apiError };
  }
}

// --- Revoke API Key ---
export async function revokeApiKey(keyId: string): Promise<ApiResponse<null>> {
  if (!keyId) {
    return { data: null, error: { message: 'Key ID is required' } };
  }

  try {
    const { error } = await supabase.rpc('revoke_api_key', { p_key_id: keyId });

    if (error) {
      // The RPC function raises specific exceptions, which might come back in error.message
      // You can parse error.message if needed, or use a generic message.
      // Example: if (error.message.includes('API key not found or permission denied'))
      return {
        data: null,
        error: {
          message: error.message || 'Failed to revoke API key via RPC',
          code: error.code, // Keep original code if available
        },
      };
    }

    return { data: null, error: null }; // Success
  } catch (error) {
    // This catch block might be redundant if supabase.rpc already captures errors well,
    // but good for unexpected issues.
    console.error(`Error calling revoke_api_key RPC for key ${keyId}:`, error);
    const apiError: ApiError = {
      message:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while revoking the API key',
    };
    return { data: null, error: apiError };
  }
}

// --- Client-side function to CALL the RPC ---
export async function createApiKeyViaRpc(
  description: string | null,
  scopes: string[]
): Promise<ApiResponse<{ apiKeyId: string; plainTextKey: string }>> {
  try {
    // Call RPC without p_user_id
    const { data, error } = await supabase
      .rpc('create_api_key', {
        // p_user_id: userId, // REMOVED
        p_description: description,
        p_scopes: scopes,
      })
      .single(); // We expect a single row result

    if (error) {
      // Check if the error is due to the user not being authenticated (raised by the function)
      if (error.message.includes('User must be authenticated')) {
        return { data: null, error: { message: 'User not authenticated', code: '401' } };
      }
      throw error; // Re-throw other errors
    }

    if (!data || !data.api_key_id || !data.api_key_plaintext) {
      throw new Error('RPC function did not return expected data.');
    }

    return {
      data: {
        apiKeyId: data.api_key_id,
        plainTextKey: data.api_key_plaintext,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error creating API key via RPC:', error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : 'Failed to create API key',
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
      code: (error as PostgrestError)?.code,
    };
    return { data: null, error: apiError };
  }
}
