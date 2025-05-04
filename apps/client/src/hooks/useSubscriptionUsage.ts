import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getUserSubscriptionUsage, SubscriptionUsage } from "@/lib/api/subscription";

// Define a constant for the base query key
export const SUBSCRIPTION_USAGE_QUERY_KEY = 'subscriptionUsage';

/**
 * Generates the React Query key for fetching user subscription usage.
 * @param userId - The ID of the user, or null/undefined if no user is logged in.
 * @returns The query key array.
 */
export function getSubscriptionUsageQueryKey(userId: string | null | undefined) {
  // Use a placeholder like 'guest' or null if no user ID is present,
  // matching the behavior in the useQuery hook itself.
  return [SUBSCRIPTION_USAGE_QUERY_KEY, userId ?? null];
}

export const useSubscriptionUsage = () => {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<SubscriptionUsage | null, Error>({ // Specify types
        queryKey: getSubscriptionUsageQueryKey(userId), // Use the generator function
        queryFn: async () => {
            if (!userId) {
                return null; // No user, no usage data
            }
            const { data, error } = await getUserSubscriptionUsage(userId);
            if (error) {
                // Don't necessarily throw, component can handle null data + error state
                console.error("Failed to fetch subscription usage:", error);
                return null; 
            }
            return data;
        },
        enabled: !!userId, // Only run the query if userId exists
        staleTime: 1 * 60 * 1000, // Cache for 1 minute (adjust as needed)
        refetchOnWindowFocus: true, // Refetch on focus to get latest count
    });
}; 