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
export type UserActiveSubscription =
  Database['public']['Functions']['get_user_active_subscription']['Returns'] extends (infer T)[]
    ? T
    : never;

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

/**
 * Calls the backend to create a Stripe Customer Portal session.
 * @returns {Promise<{ portalUrl: string } | null>} The session URL or null if an error occurs.
 */
export async function createStripePortalSession(): Promise<{ portalUrl: string } | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    console.error('Error getting user session or no active session:', sessionError);
    // Optionally, you could throw an error or return a more specific error object
    // For simplicity, returning null, but consider how you want to handle this in your UI.
    throw new Error('User not authenticated. Please log in.');
  }

  try {
    const { data, error } = await supabase.functions.invoke('manage-stripe-subscription', {
      // No specific body needed for this function call as it operates on the authenticated user
      // The Edge Function retrieves the user via the Authorization header (JWT)
    });

    if (error) {
      console.error('Error calling manage-stripe-subscription function:', error);
      // Extract a more user-friendly message if possible from the error object
      const message =
        error.context?.message || error.message || 'Failed to create billing portal session.';
      throw new Error(message);
    }

    if (!data || !data.portalUrl) {
      console.error('No portalUrl received from manage-stripe-subscription function:', data);
      throw new Error('Failed to retrieve billing portal URL.');
    }

    return data as { portalUrl: string };
  } catch (e) {
    console.error('Exception when trying to create Stripe Portal session:', e);
    // Re-throw the error so it can be caught by the calling UI component
    // This allows the UI to display a specific error message
    if (e instanceof Error) {
      throw e;
    } else {
      throw new Error('An unexpected error occurred while creating the billing portal session.');
    }
  }
}
