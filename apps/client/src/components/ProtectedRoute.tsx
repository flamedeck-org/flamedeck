import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
// Assuming AuthContext is at ../contexts/AuthContext.tsx relative to components/
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react'; // Keep if you want a loading spinner
import { Button } from './ui/button'; // Ensure correct path
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card'; // Import Card components
import { LoggedInViewErrorBoundary } from './feedback/LoggedInViewErrorBoundary'; // Import the new error boundary
import { useUserSubscription } from '@/hooks/useUserSubscription'; // Added

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
  signOut: () => Promise<void>; // Added signOut
  // Remove refetchProfile if not actually needed by this specific interface definition
}

const ProtectedRoute = () => {
  // Log context values on every render - MOVED TO TOP
  console.log('[ProtectedRoute] Component Rendered. Attempting to log state...');

  const { user, profile, loading, profileLoading, signOut } = useAuth() as AuthContextValue;
  const { isProUser, isLoading: isSubscriptionLoading, subscription } = useUserSubscription(); // Added
  const location = useLocation();
  const navigate = useNavigate(); // Added useNavigate

  const isLoading = loading || profileLoading || isSubscriptionLoading; // Added isSubscriptionLoading

  console.log('[ProtectedRoute] State Values:', {
    loading,
    profileLoading,
    isSubscriptionLoading, // Added
    user: !!user,
    profile: !!profile,
    profileUsername: profile?.username,
    isProUser, // Added
    subscriptionStatus: subscription?.status, // Added for debugging
  });

  const handleLogout = async () => {
    // Added handleLogout function
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

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

  // New Onboarding Upgrade Step Check
  if (user && profile && profile.username) {
    const selectedPlan = sessionStorage.getItem('flamedeck_selected_plan');
    console.log(
      '[ProtectedRoute] Checking for upgrade step. Selected Plan:',
      selectedPlan,
      'IsProUser:',
      isProUser
    );

    if (selectedPlan === 'pro' && !isProUser) {
      console.log(
        '[ProtectedRoute] User selected Pro, is not Pro. Redirecting to /onboarding/upgrade.'
      );
      return <Navigate to="/onboarding/upgrade" state={{ from: location }} replace />;
    } else if (selectedPlan === 'pro' && isProUser) {
      // User selected Pro and is already Pro (e.g., completed payment, came back)
      // Clear the flag so they don't get redirected again if they land here.
      console.log('[ProtectedRoute] User selected Pro and is already Pro. Clearing flag.');
      try {
        sessionStorage.removeItem('flamedeck_selected_plan');
      } catch (e) {
        console.error('Failed to remove sessionStorage item in ProtectedRoute:', e);
      }
    }
  }
  // End New Onboarding Upgrade Step Check

  if (profile && profile.username) {
    console.log('[ProtectedRoute] User exists, profile exists, username EXISTS. Rendering Outlet.');
    return (
      <LoggedInViewErrorBoundary>
        <Outlet />
      </LoggedInViewErrorBoundary>
    );
  }

  // Fallback / Error condition:
  // User exists, loading is done, but profile is still null/undefined.
  console.error(
    '[ProtectedRoute] Fallback Error: User exists but profile is missing after loading.',
    { user, profile, loading, profileLoading }
  );
  return (
    <div className="flex justify-center w-full p-4 pt-[var(--header-height,64px)] bg-background">
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
          <Button onClick={handleLogout} variant="outline" className="mt-2 ml-2">
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ProtectedRoute;
