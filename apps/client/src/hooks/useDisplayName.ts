import { useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "../integrations/supabase/types"; // Adjust path if needed

type UserProfile = Tables<"user_profiles"> | null | undefined;

/**
 * Custom hook to determine the best display name for a user.
 * Prioritizes username (with @), then first name, then email.
 * @param profile - The user's profile data from the database.
 * @param user - The Supabase auth user object.
 * @returns The calculated display name string.
 */
export function useDisplayName(profile: UserProfile, user: User | null | undefined): string {
  const displayName = useMemo(() => {
    // Use username with @ prefix if available
    if (profile?.username) {
      return `@${profile.username}`;
    }
    // Fallback to first name if available
    if (profile?.first_name) {
      return profile.first_name;
    }
    // Fallback to email if available
    if (user?.email) {
      return user.email;
    }
    // Final fallback
    return "User";
  }, [profile, user]); // Dependencies: profile and user objects

  return displayName;
}
