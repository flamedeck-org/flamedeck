import { memo, useCallback, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { createStripePortalSession } from '@/lib/api/subscription';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Check, Zap, Crown, Database, Calendar, CreditCard, Star } from 'lucide-react';
import { format } from 'date-fns';
import UpgradeButton from '@/components/billing/UpgradeButton';
import { subscriptionTiers } from '@/components/PricingTable';

function BillingPage() {
  const { subscription, isProUser, isLoading: isSubscriptionLoading } = useUserSubscription();
  const [isCreatingPortalSession, setIsCreatingPortalSession] = useState(false);

  const proTier = useMemo(() => subscriptionTiers.find(tier => tier.name === 'Pro'), []);
  const freeTier = useMemo(() => subscriptionTiers.find(tier => tier.name === 'Free'), []);

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

  const renderUpgradePrompt = () => {
    if (!proTier || !freeTier) return null;

    return (
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Current Plan - Free */}
        <div className="bg-muted/30 rounded-lg border p-6 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-muted rounded-md">
                <Database className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Free Plan</h3>
                <p className="text-sm text-muted-foreground">Current plan</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-muted-foreground">$0</div>
              <div className="text-sm text-muted-foreground">per month</div>
            </div>
          </div>

          <div className="space-y-3">
            {freeTier.features.map((feature) => (
              <div key={feature} className="flex items-start gap-3">
                <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground leading-relaxed">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pro Plan - Upgrade */}
        <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-primary/5 rounded-lg border-2 border-primary/20 p-6 relative shadow-sm">
          <div className="absolute -top-3 left-6">
            <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
              Recommended
            </span>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-md">
                <Crown className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-primary">Pro Plan</h3>
                <p className="text-sm text-muted-foreground">Unlock full potential</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">${proTier.price}</div>
              <div className="text-sm text-muted-foreground">per month</div>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {proTier.features.map((feature) => (
              <div key={feature} className="flex items-start gap-3">
                <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm leading-relaxed font-medium">{feature}</span>
              </div>
            ))}
          </div>

          <UpgradeButton className="w-full h-12 text-base font-semibold shadow-sm">
            <Crown className="mr-2 h-4 w-4" />
            Upgrade to Pro
          </UpgradeButton>

          <p className="text-xs text-center text-muted-foreground mt-3">
            Cancel anytime • Instant activation
          </p>
        </div>
      </div>
    );
  };

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
              <div className="space-y-6">
                {/* Pro Plan Status Card */}
                <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-primary/5 rounded-lg border-2 border-primary/20 p-6 relative shadow-sm">
                  <div className="absolute -top-3 left-6">
                    <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      Pro Plan
                    </span>
                  </div>

                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Crown className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-primary mb-1">
                          {subscription.plan_name || 'Pro'}
                        </h3>
                        <div className="flex items-center gap-2">
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${subscription.status === 'active' || subscription.status === 'trialing'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : subscription.status === 'past_due'
                                ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                : 'bg-red-100 text-red-700 border border-red-200'
                              }`}
                          >
                            {subscription.status === 'active' || subscription.status === 'trialing' ? (
                              <Check className="h-3 w-3" />
                            ) : subscription.status === 'past_due' ? (
                              <Loader2 className="h-3 w-3" />
                            ) : (
                              <Zap className="h-3 w-3" />
                            )}
                            <span className="capitalize">
                              {subscription.status === 'trialing' ? 'Trial Active' : subscription.status || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {proTier && (
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">${proTier.price}</div>
                        <div className="text-sm text-muted-foreground">per month</div>
                      </div>
                    )}
                  </div>

                  {/* Billing Information */}
                  <div className="mt-6 pt-4 border-t border-primary/10">
                    <div className="grid sm:grid-cols-2 gap-4">
                      {subscription.current_period_end && (
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/5 rounded-md">
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {subscription.status === 'trialing'
                                ? 'Trial Ends'
                                : subscription.cancel_at_period_end
                                  ? 'Subscription Ends'
                                  : 'Next Billing Date'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(subscription.current_period_end), 'MMMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      )}

                      {proTier && (
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/5 rounded-md">
                            <CreditCard className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Billing Cycle</p>
                            <p className="text-sm text-muted-foreground">
                              Monthly billing
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Messages */}
                  <div className="mt-4">
                    {subscription.cancel_at_period_end && subscription.status !== 'canceled' && (
                      <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <Loader2 className="h-4 w-4 text-yellow-600" />
                        <p className="text-sm text-yellow-700 font-medium">
                          Your subscription is set to cancel at the end of the current billing period.
                        </p>
                      </div>
                    )}
                    {!canManageSubscription && subscription.status === 'past_due' && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                        <Zap className="h-4 w-4 text-red-600" />
                        <p className="text-sm text-red-700 font-medium">
                          Your payment is past due. Please update your payment method.
                        </p>
                      </div>
                    )}
                    {!canManageSubscription && subscription.status === 'canceled' && (
                      <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground font-medium">
                          Your subscription has been canceled.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pro Features */}
                {proTier && (
                  <div className="bg-card rounded-lg border p-6">
                    <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Star className="h-5 w-5 text-primary" />
                      Your Pro Features
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {proTier.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-3">
                          <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              renderUpgradePrompt()
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
