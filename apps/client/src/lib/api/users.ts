import { ApiError, UserProfile } from "@/types";

import { ApiResponse } from "@/types";

import { supabase } from "@/integrations/supabase/client";
import { PostgrestError } from "@supabase/supabase-js";

export interface UserProfileData {
  username?: string;
  first_name?: string;
  last_name?: string;
}

export async function searchUsers(query: string): Promise<ApiResponse<UserProfile[]>> {
    try {
      if (!query || query.trim().length < 2) {
        // Avoid searching for very short/empty strings
        return { data: [], error: null };
      }
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, first_name, last_name')
        .or(`username.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`) // Basic search
        .limit(10);

      if (error) throw error;
      return { data: data as UserProfile[], error: null };
    } catch (error) {
      console.error('Error searching users:', error);
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Failed to search users",
        code: (error as PostgrestError)?.code,
        details: (error as PostgrestError)?.details,
        hint: (error as PostgrestError)?.hint,
      };
      return { data: null, error: apiError };
    }
  }

/**
 * Fetch user profile data
 */
export async function fetchUserProfile(userId: string): Promise<ApiResponse<UserProfileData>> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('username, first_name, last_name')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : "Failed to fetch user profile",
      code: (error as PostgrestError)?.code,
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
    };
    return { data: null, error: apiError };
  }
}

/**
 * Update user profile data
 */
export async function updateUserProfile(userId: string, profileData: UserProfileData): Promise<ApiResponse<null>> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        username: profileData.username,
        first_name: profileData.first_name,
        last_name: profileData.last_name
      })
      .eq('id', userId);
      
    if (error) throw error;
    return { data: null, error: null };
  } catch (error) {
    console.error('Error updating user profile:', error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : "Failed to update user profile",
      code: (error as PostgrestError)?.code,
      details: (error as PostgrestError)?.details,
      hint: (error as PostgrestError)?.hint,
    };
    return { data: null, error: apiError };
  }
}

/**
 * Delete user account using edge function
 */
export async function deleteUserAccount(): Promise<ApiResponse<null>> {
  try {
    // Get the current session to get the access token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) throw new Error('No active session');
    
    // Call the delete-user edge function
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete account');
    }
    
    return { data: null, error: null };
  } catch (error) {
    console.error('Error deleting user account:', error);
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : "Failed to delete user account",
      code: typeof error === 'object' && error !== null && 'code' in error ? (error as any).code : undefined,
      details: typeof error === 'object' && error !== null && 'details' in error ? (error as any).details : undefined,
      hint: typeof error === 'object' && error !== null && 'hint' in error ? (error as any).hint : undefined,
    };
    return { data: null, error: apiError };
  }
}