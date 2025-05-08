import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react'; // Using lucide-react for icons

interface FloatingChatButtonProps {
  onClick: () => void;
  // Add other props like position, style if needed later
}

export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({ onClick }) => {
  return (
    <Button
      variant="default" // Or choose another variant like 'secondary'
      size="icon"
      className="fixed bottom-6 right-6 rounded-full shadow-lg w-14 h-14 z-50" // Positioned bottom-right
      onClick={onClick}
      aria-label="Toggle Chat"
    >
      <MessageSquare className="h-6 w-6" />
    </Button>
  );
};
