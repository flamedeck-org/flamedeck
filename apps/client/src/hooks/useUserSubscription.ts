import { useQuery } from '@tanstack/react-query';
import { getUserActiveSubscription, type UserActiveSubscription } from '@/lib/api/subscription';
import { useAuth } from '@/contexts/AuthContext';

export function useUserSubscription() {
    const { user, loading: isAuthLoading } = useAuth();

    const { data: subscription, isLoading: isSubscriptionLoading, error, refetch } = useQuery<UserActiveSubscription | null, Error>({
        queryKey: ['userActiveSubscription', user?.id], // Query key includes user ID
        queryFn: async () => {
            if (!user?.id) return null; // Don't fetch if no user
            return getUserActiveSubscription();
        },
        enabled: !!user && !isAuthLoading, // Only run query if user is loaded and authenticated
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
        gcTime: 1000 * 60 * 10, // Renamed from cacheTime for v5+ (garbage collection time)
    });

    // Derived boolean to easily check if the user is on a Pro plan
    // Adjust 'pro' if your Pro plan has a different name in the database `subscription_plans.name`
    const isProUser = !!subscription && subscription.plan_name?.toLowerCase() === 'pro';
    // You can add other checks here, e.g., isFreeUser, isTrialing
    const isFreeUser = !!subscription && subscription.plan_name?.toLowerCase() === 'free';

    return {
        subscription,
        isLoading: isAuthLoading || isSubscriptionLoading,
        isProUser,
        isFreeUser, // Added for potential use
        error,
        refetchSubscription: refetch,
    };
} 