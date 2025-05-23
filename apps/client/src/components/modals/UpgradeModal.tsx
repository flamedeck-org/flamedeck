import { memo, useState } from 'react';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Zap, Loader2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { subscriptionTiers } from '../PricingTable';
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

// Ensure this PUBLISHABLE_KEY is set in your .env file (e.g., VITE_STRIPE_PUBLISHABLE_KEY)
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

let stripePromise: Promise<any | null>;
if (STRIPE_PUBLISHABLE_KEY) {
  stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
} else {
  console.error('Stripe publishable key is not set. Please set VITE_STRIPE_PUBLISHABLE_KEY.');
}

// Find the Pro plan details from the shared subscriptionTiers array
// Ensure subscriptionTiers in PricingTable.tsx has an 'id' field for each tier.
const proTierDetails = subscriptionTiers.find((tier) => tier.name === 'Pro');

function UpgradeModalImpl() {
  const { isOpen, closeModal } = useUpgradeModal();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const proPlanId = proTierDetails?.id; // Get the Pro plan ID

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeModal();
    }
  };

  const handleUpgrade = async () => {
    if (!user) {
      closeModal();
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
    try {
      const returnPath = location.pathname + location.search;

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
      // Do not close modal here, Stripe redirect will handle it or error toast shown
    }
  };

  if (!proTierDetails) {
    // This should ideally not happen if subscriptionTiers is correctly populated
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Zap className="h-6 w-6 mr-2 text-primary" />
            Unlock More with Pro!
          </DialogTitle>
          <DialogDescription className="pt-2">
            Supercharge your trace analysis workflow by upgrading to the Pro plan.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 pt-0">
          <h3 className="text-lg font-semibold mb-4">Pro Plan Includes:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {proTierDetails.features.map((feature) => (
              <li key={feature} className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-green-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 text-center">
            <span className="text-3xl font-bold">${proTierDetails.price}</span>
            <span className="text-muted-foreground">/month</span>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <Button type="button" variant="outline" onClick={closeModal} disabled={isLoading}>
            Maybe Later
          </Button>
          <Button
            type="button"
            variant="gradient"
            className="w-full sm:w-auto"
            onClick={handleUpgrade}
            disabled={isLoading || !proPlanId}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Upgrade to Pro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const UpgradeModal = memo(UpgradeModalImpl);
