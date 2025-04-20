
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  // In a real implementation, this would use Supabase auth
  useEffect(() => {
    // Simulate auth check
    const checkAuth = async () => {
      // For demo purposes, let's assume user is not authenticated
      // In real app, this would check Supabase session
      setIsAuthenticated(false);
    };
    
    checkAuth();
  }, []);

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="container flex flex-col items-center justify-center min-h-screen py-12 space-y-6">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated, render children
  return <>{children}</>;
};

export default AuthGuard;
