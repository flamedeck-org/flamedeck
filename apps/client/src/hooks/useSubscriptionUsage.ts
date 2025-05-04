import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getUserSubscriptionUsage, SubscriptionUsage } from "@/lib/api/subscription";

export const useSubscriptionUsage = () => {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<SubscriptionUsage | null, Error>({ // Specify types
        queryKey: ['subscriptionUsage', userId], // Query key includes userId
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