import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react'; // Using lucide-react for icons

interface FloatingChatButtonProps {
  onClick: () => void;
}

export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({ onClick }) => {
  return (
    <Button
      variant="gradient"
      size="icon"
      className="fixed border border bottom-6 right-6 rounded-full shadow-lg w-14 h-14 z-50"
      onClick={onClick}
      aria-label="Toggle Chat"
    >
      <MessageSquare className="h-6 w-6" />
    </Button>
  );
};
