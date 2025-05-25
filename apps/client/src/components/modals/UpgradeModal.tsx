import { memo } from 'react';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Crown } from 'lucide-react';
import { UpgradePrompt } from '@/components/UpgradePrompt';

function UpgradeModalImpl() {
  const { isOpen, closeModal } = useUpgradeModal();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeModal();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center pb-4">
          <DialogTitle className="flex items-center justify-center gap-2 text-xl">
            <Crown className="h-5 w-5 text-primary" />
            Upgrade to Pro
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-2">
            Unlock the full potential of FlameDeck
          </DialogDescription>
        </DialogHeader>

        <UpgradePrompt onMaybeLater={closeModal} />
      </DialogContent>
    </Dialog>
  );
}

export const UpgradeModal = memo(UpgradeModalImpl);
