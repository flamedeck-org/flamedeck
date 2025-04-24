import { ApiError, UserProfile } from "@/types";

import { ApiResponse } from "@/types";

import { supabase } from "@/integrations/supabase/client";
import { PostgrestError } from "@supabase/supabase-js";

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