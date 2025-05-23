import { memo, useCallback, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { createStripePortalSession } from '@/lib/api/subscription';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import UpgradeButton from '@/components/billing/UpgradeButton';

function BillingPage() {
  const { subscription, isProUser, isLoading: isSubscriptionLoading } = useUserSubscription();
  const [isCreatingPortalSession, setIsCreatingPortalSession] = useState(false);

  const handleManageBilling = useCallback(async () => {
    if (
      !isProUser &&
      !(subscription && (subscription.status === 'active' || subscription.status === 'trialing'))
    ) {
      toast.info('Only active Pro subscriptions can be managed here.');
      return;
    }
    setIsCreatingPortalSession(true);
    try {
      const result = await createStripePortalSession();
      if (result?.portalUrl) {
        window.location.href = result.portalUrl;
      } else {
        // This case should ideally be handled by errors thrown in createStripePortalSession
        toast.error('Could not open billing portal. Please try again.');
      }
    } catch (error) {
      console.error('Error creating Stripe portal session:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsCreatingPortalSession(false);
    }
  }, [isProUser, subscription]);

  const canManageSubscription = useMemo(() => {
    return (
      isProUser &&
      subscription &&
      (subscription.status === 'active' || subscription.status === 'trialing')
    );
  }, [isProUser, subscription]);

  return (
    <>
      <PageHeader title="Billing & Subscription" />
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Details</CardTitle>
            <CardDescription>
              View your current subscription plan and manage your billing information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSubscriptionLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span>Loading subscription details...</span>
              </div>
            ) : subscription ? (
              <div className="space-y-2">
                <p>
                  <strong>Current Plan:</strong> {subscription.plan_name || 'N/A'}
                </p>
                <p>
                  <strong>Status:</strong>{' '}
                  <span
                    className={`capitalize ${subscription.status === 'active' || subscription.status === 'trialing' ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {subscription.status || 'N/A'}
                  </span>
                </p>
                {subscription.current_period_end && (
                  <p>
                    <strong>
                      {subscription.status === 'trialing'
                        ? 'Trial Ends:'
                        : subscription.cancel_at_period_end
                          ? 'Subscription Ends:'
                          : 'Next Billing Date:'}
                    </strong>{' '}
                    {format(new Date(subscription.current_period_end), 'MMMM d, yyyy')}
                  </p>
                )}
                {subscription.cancel_at_period_end && subscription.status !== 'canceled' && (
                  <p className="text-yellow-600 font-medium">
                    Your subscription is set to cancel at the end of the current billing period.
                  </p>
                )}
                {!canManageSubscription && subscription.status === 'past_due' && (
                  <p className="text-red-600 font-medium">
                    Your payment is past due. Please update your payment method.
                  </p>
                )}
                {!canManageSubscription && subscription.status === 'canceled' && (
                  <p className="text-muted-foreground">Your subscription has been canceled.</p>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  You do not have an active subscription.
                </p>
                <UpgradeButton />
              </div>
            )}

            {canManageSubscription || (subscription && subscription.status === 'past_due') ? (
              <Button
                onClick={handleManageBilling}
                disabled={isCreatingPortalSession}
                className="mt-4"
              >
                {isCreatingPortalSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isCreatingPortalSession
                  ? 'Opening Portal...'
                  : subscription?.status === 'past_due'
                    ? 'Update Payment Method'
                    : 'Manage Billing & Subscription'}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default memo(BillingPage);
