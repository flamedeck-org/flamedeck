import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';

interface ErrorAction {
  message: string;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost' | 'link' | 'gradient';
  className?: string;
  icon?: ReactNode;
}

interface TraceViewerErrorStateProps {
  title: string;
  message: string;
  actions?: ErrorAction[];
}

export function TraceViewerErrorState({
  title,
  message,
  actions = [],
}: TraceViewerErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4 text-center relative z-10 bg-background">
      <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-yellow-500/20 rounded-xl border border-red-500/30 flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>

      <h3 className="text-lg font-bold mb-2">{title}</h3>

      <p className="text-muted-foreground mb-6 max-w-md mx-auto">{message}</p>

      {actions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          {actions.map((action, index) => {
            const buttonContent = (
              <>
                {action.icon}
                {action.message}
              </>
            );

            if (action.href) {
              return (
                <Link key={index} to={action.href}>
                  <Button
                    variant={action.variant || 'outline'}
                    className={`w-full sm:w-auto ${action.className || ''}`}
                  >
                    {buttonContent}
                  </Button>
                </Link>
              );
            }

            return (
              <Button
                key={index}
                onClick={action.onClick}
                variant={action.variant || 'outline'}
                className={`w-full sm:w-auto ${action.className || ''}`}
              >
                {buttonContent}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
