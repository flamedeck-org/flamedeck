import { supabase } from "@/integrations/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ApiError, ApiResponse } from "./types";
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
    return { data: null, error: { message: "User ID is required" } };
  }

  try {
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, description, scopes, created_at, last_used_at, is_active")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Return the data directly (it no longer contains key_hash)
    return { data: data || [], error: null };
  } catch (error) {
    console.error("Error listing API keys:", error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : "Failed to list API keys",
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
      code: (error as PostgrestError)?.code,
    };
    return { data: null, error: apiError };
  }
}

// --- Create API Key ---
// IMPORTANT: This function needs elevated privileges (service_role) because it handles hashing
// and inserts directly. It should ideally be called from a secure backend context
// (like an Edge Function or server backend), NOT directly from the client if possible.
// For simplicity in this example, we might call it via RPC from the client, but be aware of security implications.
// We will create an RPC function for this.

// --- Revoke API Key ---
export async function revokeApiKey(keyId: string, userId: string): Promise<ApiResponse<null>> {
  if (!keyId || !userId) {
    return { data: null, error: { message: "Key ID and User ID are required" } };
  }

  try {
    // RLS policy should ensure user can only update their own keys
    const { error } = await supabase
      .from("api_keys")
      .update({ is_active: false })
      .eq("id", keyId)
      .eq("user_id", userId); // Ensure ownership

    if (error) {
      // Handle specific errors, e.g., key not found or permission denied by RLS
      if (error.code === "PGRST116") {
        // Not found
        return {
          data: null,
          error: {
            message: "API key not found or you don't have permission to revoke it.",
            code: "404",
          },
        };
      }
      throw error;
    }

    return { data: null, error: null }; // Success
  } catch (error) {
    console.error(`Error revoking API key ${keyId}:`, error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : "Failed to revoke API key",
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
      code: (error as PostgrestError)?.code,
    };
    return { data: null, error: apiError };
  }
}

// --- Helper: Generate Secure API Key String (Example) ---
// You might want a more robust generation method
// function generateApiKeyString(prefix = "sk_"): string { ... } // No longer needed here

// --- RPC Function Creation (SQL) ---
/*
-- SQL to create the RPC function in Supabase SQL Editor

CREATE OR REPLACE FUNCTION create_api_key(
    p_user_id UUID,
    p_description TEXT,
    p_scopes TEXT[]
)
RETURNS TABLE (api_key_id UUID, api_key_plaintext TEXT)
LANGUAGE plpgsql
SECURITY DEFINER -- Executes with the privileges of the user who defined it (postgres)
SET search_path = public
AS $$
DECLARE
    v_plaintext_key TEXT;
    v_hashed_key TEXT;
    v_key_id UUID;
BEGIN
    -- 1. Generate the plaintext key
    -- Note: Using a simple pseudo-random approach here. Consider more robust generation.
    v_plaintext_key := 'sk_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

    -- 2. Hash the key using pg_bcrypt
    -- Ensure the bcrypt extension is enabled: CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS pg_bcrypt;
    -- Using default rounds (usually 10)
    v_hashed_key := crypt(v_plaintext_key, gen_salt('bf'));

    -- 3. Insert into the api_keys table
    INSERT INTO api_keys (user_id, description, scopes, key_hash, is_active)
    VALUES (p_user_id, p_description, p_scopes, v_hashed_key, true)
    RETURNING id INTO v_key_id;

    -- 4. Return the new key ID and the PLAINTEXT key (this is the only time it's available)
    RETURN QUERY SELECT v_key_id, v_plaintext_key;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_api_key(UUID, TEXT, TEXT[]) TO authenticated;

*/

// --- Client-side function to CALL the RPC ---
export async function createApiKeyViaRpc(
  description: string | null,
  scopes: string[]
): Promise<ApiResponse<{ apiKeyId: string; plainTextKey: string }>> {
  // No longer need to get userId here, the function gets it from auth context
  // const { data: { session } } = await supabase.auth.getSession();
  // const userId = session?.user?.id;
  //
  // if (!userId) {
  //     return { data: null, error: { message: "User not authenticated" } };
  // }

  try {
    // Call RPC without p_user_id
    const { data, error } = await supabase
      .rpc("create_api_key", {
        // p_user_id: userId, // REMOVED
        p_description: description,
        p_scopes: scopes,
      })
      .single(); // We expect a single row result

    if (error) {
      // Check if the error is due to the user not being authenticated (raised by the function)
      if (error.message.includes("User must be authenticated")) {
        return { data: null, error: { message: "User not authenticated", code: "401" } };
      }
      throw error; // Re-throw other errors
    }

    if (!data || !data.api_key_id || !data.api_key_plaintext) {
      throw new Error("RPC function did not return expected data.");
    }

    return {
      data: {
        apiKeyId: data.api_key_id,
        plainTextKey: data.api_key_plaintext,
      },
      error: null,
    };
  } catch (error) {
    console.error("Error creating API key via RPC:", error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : "Failed to create API key",
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
      code: (error as PostgrestError)?.code,
    };
    return { data: null, error: apiError };
  }
}
