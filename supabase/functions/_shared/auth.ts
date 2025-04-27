import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts'; // Assuming corsHeaders is in the same _shared dir

/**
 * Authenticates an incoming request using an API key header by calling a secure RPC.
 * Validates the key against hashed keys in the database and checks required scopes.
 *
 * @param req The incoming Request object.
 * @param supabaseAdmin An admin-level Supabase client.
 * @param requiredScopes An array of scope strings required for this endpoint.
 * @returns On success: { userId: string }. On failure: A Response object to be returned immediately.
 */
export async function authenticateRequest(
  req: Request,
  supabaseAdmin: SupabaseClient,
  requiredScopes: string[]
): Promise<{ userId: string } | Response> {
  // Extract API key from common headers
  const apiKeyHeader = req.headers.get('authorization');
  const apiKey = apiKeyHeader?.startsWith('Bearer ')
    ? apiKeyHeader.substring(7) // Remove 'Bearer '
    : req.headers.get('x-api-key'); // Fallback to x-api-key

  if (!apiKey) {
    console.log("Auth Helper: API key could not be extracted from headers.");
    return new Response(JSON.stringify({ error: 'API key required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Call the RPC function to verify the key
    console.log("Auth Helper: Calling verify_api_key RPC...");
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('verify_api_key', {
        p_plaintext_key: apiKey
    }).single();

    if (rpcError) {
      console.error("Auth Helper: Error calling verify_api_key RPC:", rpcError);
      return new Response(JSON.stringify({ error: 'Error validating API key' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("Auth Helper: RPC response:", rpcData); 

    // Check if the RPC returned a valid user and the key is valid
    if (!rpcData || !rpcData.o_is_valid || !rpcData.o_user_id) {
      console.log("Auth Helper: API key is invalid or inactive according to RPC.");
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Key is valid, now check scopes returned by the RPC
    const { o_user_id: userIdFromRpc, o_scopes: keyScopes } = rpcData;
    const hasAllScopes = requiredScopes.every(scope => keyScopes?.includes(scope));

    if (!hasAllScopes) {
      console.warn(`Auth Helper: API Key validated for user ${userIdFromRpc} but missing required scope(s). Required: ${requiredScopes}, Found: ${keyScopes}`);
      return new Response(JSON.stringify({ error: 'Insufficient permissions for this key' }), {
        status: 403, // Forbidden
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Authentication and Authorization successful
    console.log(`Auth Helper: Authentication successful for user: ${userIdFromRpc}`);
    return { userId: userIdFromRpc };

  } catch (error) {
    console.error("Auth Helper: Unhandled error during authentication:", error);
    return new Response(JSON.stringify({ error: 'Internal server error during authentication' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
} 