import { memo } from 'react';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

function UpgradeModalImpl() {
    const { isOpen, closeModal } = useUpgradeModal();

    const proTier = {
        name: 'Pro',
        price: '10',
        features: [
            'Unlimited trace retention',
            '1,000 total traces',
            'Advanced collaboration features',
            '50 messages per chat session',
            '25 chat sessions per month',
            'Priority support',
            'More features coming soon...',
        ],
        cta: 'Upgrade to Pro',
        link: '/settings/billing', // Placeholder for actual upgrade link/action
        isComingSoon: true,
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            closeModal();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center">
                        <Zap className="h-6 w-6 mr-2 text-primary" />
                        Unlock More with Pro!
                    </DialogTitle>
                    <DialogDescription className="pt-2">
                        Supercharge your trace analysis workflow by upgrading to the Pro plan. Get access to advanced features, higher limits, and more.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <h3 className="text-lg font-semibold mb-1">Pro Plan Includes:</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        {proTier.features.map((feature) => (
                            <li key={feature} className="flex items-center">
                                <Check className="h-4 w-4 mr-2 text-green-500" />
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-6 text-center">
                        <span className="text-3xl font-bold">${proTier.price}</span>
                        <span className="text-muted-foreground">/month</span>
                    </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
                    <Button type="button" variant="outline" onClick={closeModal}>
                        Maybe Later
                    </Button>
                    <Link
                        to={proTier.isComingSoon ? '#' : proTier.link}
                        className={cn(proTier.isComingSoon && 'pointer-events-none')}
                        aria-disabled={proTier.isComingSoon}
                        tabIndex={proTier.isComingSoon ? -1 : undefined}
                    >
                        <Button type="button" variant="gradient" className="w-full sm:w-auto" disabled={proTier.isComingSoon}>
                            {proTier.isComingSoon ? 'Coming Soon' : proTier.cta}
                        </Button>
                    </Link>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export const UpgradeModal = memo(UpgradeModalImpl); 