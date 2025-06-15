import { type FC, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Sparkles, Lock, X } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UnauthenticatedChatTeaserProps {
  traceId: string;
}

export const UnauthenticatedChatTeaser: FC<UnauthenticatedChatTeaserProps> = ({ traceId }) => {
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('chat-teaser-dismissed') === 'true';
  });

  const handleDismiss = () => {
    localStorage.setItem('chat-teaser-dismissed', 'true');
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 max-h-[calc(100vh-8rem)] bg-background/80 backdrop-blur-sm border border-border/30 rounded-2xl shadow-2xl flex flex-col z-40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30 bg-background/90 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-r from-red-500 to-yellow-500 rounded-lg">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-bold text-foreground">AI Trace Analysis</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0 hover:bg-background/50"
            title="Dismiss"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content Area - with flexible height */}
      <div className="flex-1 p-4 flex flex-col items-center justify-center text-center space-y-3 min-h-0">
        <div className="p-3 bg-gradient-to-br from-red-500/10 to-yellow-500/10 border border-red-500/20 rounded-xl">
          <MessageSquare className="h-6 w-6 mx-auto text-red-500" />
        </div>

        <div className="space-y-2">
          <h4 className="font-bold text-base text-foreground">Get AI-Powered Insights</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ask questions about performance bottlenecks and optimization opportunities
          </p>
        </div>

        {/* Sample Questions - made more compact */}
        <div className="w-full space-y-1.5">
          <div className="text-left p-2 bg-muted/50 rounded-lg border border-border/20">
            <p className="text-xs text-muted-foreground italic">
              "What are the top 5 slowest functions?"
            </p>
          </div>
          <div className="text-left p-2 bg-muted/50 rounded-lg border border-border/20">
            <p className="text-xs text-muted-foreground italic">
              "Show me the performance bottlenecks"
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section - fixed at bottom */}
      <div className="p-4 bg-background/95 border-t border-border/30 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Sign up to analyze this trace</span>
        </div>

        <Link to="/login" className="block">
          <Button className="w-full bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            Sign Up for Free
          </Button>
        </Link>
      </div>
    </div>
  );
};
