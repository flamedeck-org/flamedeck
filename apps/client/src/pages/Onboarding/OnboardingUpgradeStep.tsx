import { memo, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { subscriptionTiers } from '@/components/PricingTable'; // Adjusted path
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSubscription } from '@/hooks/useUserSubscription'; // Added
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

let stripePromise: Promise<any | null>;
if (STRIPE_PUBLISHABLE_KEY) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
} else {
    console.error('Stripe publishable key is not set. Please set VITE_STRIPE_PUBLISHABLE_KEY.');
}

const proTierDetails = subscriptionTiers.find((tier) => tier.name === 'Pro');

function OnboardingUpgradeStepImpl() {
    const { user } = useAuth();
    const { isProUser, isLoading: isSubscriptionLoading } = useUserSubscription();
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(false); // For upgrade button interaction

    const proPlanId = proTierDetails?.id;

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


    const handleUpgrade = async () => {
        if (!user) {
            // Should not happen if ProtectedRoute is working, but as a safeguard
            navigate('/login');
            return;
        }

        if (!proPlanId) {
            toast({
                title: 'Error',
                description: 'Pro plan details not found. Please contact support.',
                variant: 'destructive',
            });
            console.error('Pro plan ID is missing.');
            return;
        }

        if (!STRIPE_PUBLISHABLE_KEY || !stripePromise) {
            toast({
                title: 'Error',
                description: 'Payment system is not configured correctly. Please contact support.',
                variant: 'destructive',
            });
            console.error('Stripe publishable key missing or Stripe.js failed to load.');
            return;
        }

        setIsLoading(true);
        clearSessionStorageFlag(); // Clear flag before attempting payment

        try {
            const returnPath = '/'; // After successful payment, go to the app root

            const { data, error } = await supabase.functions.invoke('create-stripe-checkout-session', {
                body: { planId: proPlanId, returnPath: returnPath },
            });

            if (error) throw error;

            if (data && data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else if (data && data.sessionId) {
                const stripe = await stripePromise;
                if (stripe) {
                    const { error: stripeError } = await stripe.redirectToCheckout({
                        sessionId: data.sessionId,
                    });
                    if (stripeError) {
                        console.error('Stripe redirectToCheckout error:', stripeError);
                        toast({
                            title: 'Checkout Error',
                            description: stripeError.message || 'Could not redirect to payment.',
                            variant: 'destructive',
                        });
                    }
                }
            } else {
                throw new Error('Invalid response from checkout session creation.');
            }
        } catch (error: any) {
            console.error('Error creating Stripe checkout session:', error);
            toast({
                title: 'Upgrade Error',
                description: error.message || 'Could not initiate the upgrade process. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
            // Modal isn't closed here as Stripe handles redirect. If errors, user stays.
        }
    };

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

    if (!proTierDetails) {
        // Fallback if pro plan details are somehow missing
        console.error('Pro tier details are missing in OnboardingUpgradeStep.');
        return (
            <div className="flex justify-center items-center h-screen">
                <p>Error: Pro plan details could not be loaded. Please contact support.</p>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-background z-10 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center text-2xl font-bold">
                        <Zap className="h-6 w-6 mr-2 text-primary" />
                        Upgrade to Pro
                    </CardTitle>
                    <CardDescription className="pt-2">
                        You're one step away! Supercharge your trace analysis workflow by upgrading to the Pro plan.
                    </CardDescription>
                </CardHeader>

                <CardContent className="py-4 pt-0">
                    <h3 className="text-lg font-semibold mb-3">Pro Plan Includes:</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                        {proTierDetails.features.map((feature) => (
                            <li key={feature} className="flex items-center">
                                <Check className="h-4 w-4 mr-2 text-green-500" />
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="text-center mb-6">
                        <span className="text-3xl font-bold">${proTierDetails.price}</span>
                        <span className="text-muted-foreground">/month</span>
                    </div>
                </CardContent>

                <CardFooter className="flex flex-col sm:flex-row sm:justify-between gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleMaybeLater}
                        disabled={isLoading}
                        className="w-full sm:w-auto"
                    >
                        Maybe Later
                    </Button>
                    <Button
                        type="button"
                        variant="gradient"
                        className="w-full sm:w-auto"
                        onClick={handleUpgrade}
                        disabled={isLoading || !proPlanId || !user}
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Upgrade to Pro
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

export const OnboardingUpgradeStep = memo(OnboardingUpgradeStepImpl); 