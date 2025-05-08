import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
// Assuming AuthContext is at ../contexts/AuthContext.tsx relative to components/
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react'; // Keep if you want a loading spinner
import { Button } from './ui/button'; // Ensure correct path
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card'; // Import Card components

// Define the shape of the profile object you expect from useAuth
// Adjust this based on your actual user_profiles table structure
interface UserProfile {
  id: string;
  username: string | null;
  // other profile fields...
}

// Adjust the useAuth hook's return type assumption if needed
interface AuthContextValue {
  user: any | null; // Replace 'any' with your actual user type from Supabase Auth
  profile: UserProfile | null;
  loading: boolean; // Auth loading state
  profileLoading: boolean; // Profile loading state
  // Remove refetchProfile if not actually needed by this specific interface definition
}

const ProtectedRoute = () => {
  // Log context values on every render - MOVED TO TOP
  console.log('[ProtectedRoute] Component Rendered. Attempting to log state...');

  const { user, profile, loading, profileLoading } = useAuth() as AuthContextValue;
  const location = useLocation();

  const isLoading = loading || profileLoading;

  console.log('[ProtectedRoute] State Values:', {
    loading,
    profileLoading,
    user: !!user,
    profile: !!profile,
    profileUsername: profile?.username,
  });

  if (isLoading) {
    console.log('[ProtectedRoute] State is Loading, returning spinner.');
    return (
      <div className="flex justify-center items-center h-[calc(100vh-var(--header-height))] w-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Logged in state checks
  console.log('[ProtectedRoute] Loading is false. Evaluating user/profile state.');

  if (!user) {
    console.log('[ProtectedRoute] No user found, redirecting to /login.');
    try {
      sessionStorage.setItem(
        'postLoginRedirectPath',
        location.pathname + location.search + location.hash
      );
    } catch (e) {
      console.error('Failed to set sessionStorage:', e);
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // At this point, user exists.
  console.log('[ProtectedRoute] User exists. Checking profile.', { profile }); // Log the profile object itself

  if (profile && !profile.username) {
    console.log(
      '[ProtectedRoute] User exists, profile exists, username MISSING. Redirecting to /onboarding/username.'
    );
    return <Navigate to="/onboarding/username" state={{ from: location }} replace />;
  }

  if (profile && profile.username) {
    console.log('[ProtectedRoute] User exists, profile exists, username EXISTS. Rendering Outlet.');
    return <Outlet />;
  }

  // Fallback / Error condition:
  // User exists, loading is done, but profile is still null/undefined.
  console.error(
    '[ProtectedRoute] Fallback Error: User exists but profile is missing after loading.',
    { user, profile, loading, profileLoading }
  );
  return (
    <div className="flex justify-center w-full p-4 pt-[var(--header-height,64px)]">
      <Card className="w-full max-w-md border-destructive/50 bg-destructive/5 mt-8">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive">Error Loading Profile</CardTitle>
          <CardDescription className="text-destructive/90">
            We encountered an issue loading your profile details.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            Please check your connection or try refreshing the page. If the problem persists,
            contact support.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={() => window.location.reload()} variant="destructive" className="mt-2">
            Refresh Page
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ProtectedRoute;
