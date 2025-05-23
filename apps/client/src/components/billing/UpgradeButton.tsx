import { memo, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';

interface UpgradeButtonProps extends Omit<ButtonProps, 'onClick' | 'title' | 'children'> {
  title?: ReactNode;
  children?: ReactNode;
}

function UpgradeButton({ title, children, ...props }: UpgradeButtonProps) {
  const { openModal } = useUpgradeModal();

  const buttonContent = children || title || 'Upgrade to Pro';

  return (
    <Button variant="gradient" onClick={openModal} {...props}>
      {buttonContent}
    </Button>
  );
}

export default memo(UpgradeButton);
