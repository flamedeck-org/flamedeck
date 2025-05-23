import { supabase } from '@/integrations/supabase/client';
import type { ApiError, ApiResponse } from '@/types';
import type { PostgrestError } from '@supabase/supabase-js';
import { type Database } from '@flamedeck/supabase-integration';

export interface SubscriptionUsage {
  monthly_uploads_used: number | null;
  monthly_upload_limit: number | null;
  current_period_end: string | null; // Comes as string from DB
  plan_name: string | null;
  total_trace_limit: number | null;
  current_total_traces: number | null;
}

export async function getUserSubscriptionUsage(
  userId: string
): Promise<ApiResponse<SubscriptionUsage>> {
  if (!userId) {
    return { data: null, error: { message: 'User ID is required' } };
  }

  try {
    const { data, error } = await supabase.rpc('get_user_subscription_usage', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error fetching subscription usage:', error);
      throw error;
    }

    // RPC functions often return an array, even if just one row is expected
    // Or they might return an empty array if no matching subscription was found
    const usageData = data && Array.isArray(data) && data.length > 0 ? data[0] : null;

    return { data: usageData as SubscriptionUsage | null, error: null };
  } catch (error) {
    console.error(`Error calling get_user_subscription_usage RPC for ${userId}:`, error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : 'Failed to fetch subscription usage',
      code: (error as PostgrestError)?.code,
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
    };
    return { data: null, error: apiError };
  }
}

// Define a type for the expected RPC response structure based on your SQL function
// This should align with what get_user_active_subscription() returns.
export type UserActiveSubscription = Database['public']['Functions']['get_user_active_subscription']['Returns'] extends (infer T)[] ? T : never;

/**
 * Fetches the current authenticated user's active subscription details.
 */
export async function getUserActiveSubscription(): Promise<UserActiveSubscription | null> {
  const { data, error } = await supabase.rpc('get_user_active_subscription');

  if (error) {
    console.error('Error fetching user active subscription:', error);
    // Depending on how you want to handle errors, you might throw it or return null/specific error object
    throw error;
  }

  // The RPC function is designed to return a single row (or no row) as it queries by auth.uid()
  // If data is an array and has an element, return it, otherwise null.
  return data && data.length > 0 ? data[0] : null;
}
