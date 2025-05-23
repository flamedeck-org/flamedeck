import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UploadCloud, Zap, Loader2 } from 'lucide-react';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';
import { useTraceUploadModal } from '@/hooks/useTraceUploadModal';

interface SidebarActionButtonsProps {
  minimized?: boolean;
}

// Define consistent icon sizes from Sidebar.tsx
const ICON_SIZE = 'h-6 w-6';
const MINIMIZED_BUTTON_SIZE = 'h-10 w-10';

function SidebarActionButtonsImpl({ minimized = false }: SidebarActionButtonsProps) {
  const { isLoading: isSubscriptionLoading, isProUser } = useUserSubscription();
  const { openModal: openUpgradeModal } = useUpgradeModal();
  const { openModal: openTraceUploadModal } = useTraceUploadModal();

  if (isSubscriptionLoading) {
    return (
      <div
        className={`flex items-center justify-center ${minimized ? MINIMIZED_BUTTON_SIZE : 'h-10 w-full px-4 py-2 mb-2'}`}
      >
        <Loader2 className={`animate-spin ${ICON_SIZE}`} />
      </div>
    );
  }

  // Logic to determine which button to show
  // For now, we assume if they are NOT a Pro user, they see Upgrade.
  // If they ARE a Pro user, they see Upload.
  // This can be expanded if you have more plans or specific upload allowances for free tier.
  const showUpgradeButton = !isProUser;

  if (showUpgradeButton) {
    if (minimized) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="primary-outline" // Or another appropriate variant
                className={`${MINIMIZED_BUTTON_SIZE} flex items-center justify-center`}
                onClick={openUpgradeModal}
                aria-label="Upgrade to Pro"
              >
                <Zap className={ICON_SIZE} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={4}>
              <p>Upgrade to Pro</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return (
      <Button
        variant="gradient"
        className="w-full space-x-2 flex items-center justify-center"
        onClick={openUpgradeModal}
      >
        <Zap className="h-4 w-4" />
        <span>Upgrade to Pro</span>
      </Button>
    );
  }

  // If not showing upgrade, show Upload Trace button
  if (minimized) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="primary-outline"
              className={`${MINIMIZED_BUTTON_SIZE} w-full flex items-center justify-center`}
              aria-label="Upload Trace"
              onClick={() => openTraceUploadModal(null, null)}
            >
              <UploadCloud className={ICON_SIZE} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={4}>
            <p>Upload Trace</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <Button
      variant="primary-outline"
      className="w-full space-x-2 flex items-center justify-center"
      aria-label="Upload Trace"
      onClick={() => openTraceUploadModal(null, null)}
    >
      <UploadCloud className={ICON_SIZE} />
      <span>Upload Trace</span>
    </Button>
  );
}

export const SidebarActionButtons = memo(SidebarActionButtonsImpl);
