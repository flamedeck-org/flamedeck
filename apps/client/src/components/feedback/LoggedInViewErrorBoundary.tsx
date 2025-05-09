import React, { memo } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import * as Sentry from '@sentry/react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="flex justify-center items-center h-full w-full p-4">
      <Card className="w-full max-w-lg border-destructive bg-destructive/5">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive">Something went wrong</CardTitle>
          <CardDescription className="text-destructive/90">
            We encountered an unexpected error. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            If you continue to see this error, please contact support.
          </p>
          <pre className="text-xs text-destructive/70 whitespace-pre-wrap break-all bg-destructive/5 p-2 rounded-md mb-4">
            {error.message}
          </pre>
          <Button onClick={resetErrorBoundary} variant="destructive">
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface LoggedInViewErrorBoundaryProps {
  children: React.ReactNode;
}

function LoggedInViewErrorBoundaryComponent({ children }: LoggedInViewErrorBoundaryProps) {
  const handleOnError = React.useCallback((error: Error, info: { componentStack: string }) => {
    Sentry.captureException(error, {
      tags: { context: 'app-view-boundary' },
      extra: { componentStack: info.componentStack },
    });
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={handleOnError}>
      {children}
    </ErrorBoundary>
  );
}

export const LoggedInViewErrorBoundary = memo(LoggedInViewErrorBoundaryComponent);
