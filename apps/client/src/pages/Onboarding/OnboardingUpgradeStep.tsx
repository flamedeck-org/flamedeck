import { memo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { UpgradePrompt } from '@/components/UpgradePrompt';

function OnboardingUpgradeStepImpl() {
    const { user } = useAuth();
    const { isProUser, isLoading: isSubscriptionLoading } = useUserSubscription();
    const navigate = useNavigate();
    const location = useLocation();

    const clearSessionStorageFlag = useCallback(() => {
        try {
            sessionStorage.removeItem('flamedeck_selected_plan');
        } catch (e) {
            console.error('Failed to remove sessionStorage item:', e);
        }
    }, []);

    useEffect(() => {
        if (isSubscriptionLoading) {
            // Wait for subscription status to load
            return;
        }

        const selectedPlan = sessionStorage.getItem('flamedeck_selected_plan');

        if (isProUser || selectedPlan !== 'pro') {
            // If user is already Pro, or didn't intend to upgrade, clear flag and navigate away
            clearSessionStorageFlag();
            const from = location.state?.from?.pathname || '/';
            navigate(from, { replace: true });
        }
        // If selectedPlan is 'pro' and user is not Pro, stay on this page.
    }, [isProUser, isSubscriptionLoading, navigate, clearSessionStorageFlag, location.state]);

    const handleMaybeLater = () => {
        clearSessionStorageFlag();
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
    };

    if (isSubscriptionLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-background z-10 p-4">
            <div className="w-full max-w-md bg-card rounded-lg border p-6 shadow-sm">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold mb-2">You're one step away!</h1>
                    <p className="text-muted-foreground">
                        Complete your upgrade to unlock all Pro features.
                    </p>
                </div>

                <UpgradePrompt
                    onMaybeLater={handleMaybeLater}
                    returnPath="/"
                    clearSessionOnUpgrade={true}
                />
            </div>
        </div>
    );
}

export const OnboardingUpgradeStep = memo(OnboardingUpgradeStepImpl); 