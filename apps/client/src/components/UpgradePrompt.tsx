import { memo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, Crown, Loader2 } from 'lucide-react';
import { subscriptionTiers } from '@/components/PricingTable';
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

let stripePromise: Promise<any | null>;
if (STRIPE_PUBLISHABLE_KEY) {
  stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
} else {
  console.error('Stripe publishable key is not set. Please set VITE_STRIPE_PUBLISHABLE_KEY.');
}

const proTierDetails = subscriptionTiers.find((tier) => tier.name === 'Pro');

interface UpgradePromptProps {
  onMaybeLater?: () => void;
  returnPath?: string;
  showMaybeLater?: boolean;
  className?: string;
  clearSessionOnUpgrade?: boolean;
}

function UpgradePromptImpl({
  onMaybeLater,
  returnPath,
  showMaybeLater = true,
  className = '',
  clearSessionOnUpgrade = false,
}: UpgradePromptProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const proPlanId = proTierDetails?.id;

  const handleUpgrade = async () => {
    if (!user) {
      navigate(`/login?redirect=${location.pathname}${location.search}`);
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

    // Clear session storage if requested (for onboarding flow)
    if (clearSessionOnUpgrade) {
      try {
        sessionStorage.removeItem('flamedeck_selected_plan');
      } catch (e) {
        console.error('Failed to remove sessionStorage item:', e);
      }
    }

    try {
      const finalReturnPath = returnPath || location.pathname + location.search;

      const { data, error } = await supabase.functions.invoke('create-stripe-checkout-session', {
        body: { planId: proPlanId, returnPath: finalReturnPath },
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
    }
  };

  if (!proTierDetails) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Coming Soon Banner */}
      <div className="text-center space-y-4">
        <Crown className="h-12 w-12 text-muted-foreground mx-auto" />
        <div>
          <div className="text-2xl font-bold mb-2">Pro Tier Coming Soon</div>
          <p className="text-muted-foreground">
            We're working on bringing you premium features. Stay tuned!
          </p>
        </div>
      </div>

      {/* Features Preview */}
      <div className="space-y-3 opacity-60">
        <div className="text-sm font-semibold text-center">What's Coming:</div>
        {proTierDetails.features.map((feature) => (
          <div key={feature} className="flex items-start gap-3">
            <Check className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span className="text-sm text-muted-foreground">{feature}</span>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-2">
        {showMaybeLater && onMaybeLater && (
          <Button
            type="button"
            variant="outline"
            onClick={onMaybeLater}
            className="w-full"
          >
            Close
          </Button>
        )}
      </div>
    </div>
  );
}

export const UpgradePrompt = memo(UpgradePromptImpl);
