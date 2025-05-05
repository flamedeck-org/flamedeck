import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client'; // Adjust path if needed
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/button.tsx';

function AuthCallbackPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[AuthCallbackPage] Mounted, setting up listener.");
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("[AuthCallbackPage] onAuthStateChange event:", event, "Session:", session);
        if (!isMounted) return;

        if (event === "SIGNED_IN") {
            console.log("[AuthCallbackPage] SIGNED_IN detected. Invalidating queries and navigating.");
            // Invalidate queries to ensure fresh data after login
            queryClient.invalidateQueries({ queryKey: ['userProfile'] }); // Invalidate profile query
            queryClient.invalidateQueries({ queryKey: ['subscriptionUsage'] }); // Invalidate usage query
            
            // Redirect to the originally intended path or default
            const redirectTo = sessionStorage.getItem('postLoginRedirectPath') || '/';
            sessionStorage.removeItem('postLoginRedirectPath'); // Clean up
            navigate(redirectTo, { replace: true });
        } else if (event === "SIGNED_OUT") {
            // Should not happen on callback, but handle defensively
             console.warn("[AuthCallbackPage] Received SIGNED_OUT, navigating to login.");
             navigate('/login', { replace: true });
        } else if (event === 'INITIAL_SESSION') {
            // If initial session is null, wait for SIGNED_IN
            if (!session) {
                console.log("[AuthCallbackPage] INITIAL_SESSION is null, waiting for SIGNED_IN...");
            } else {
                // If somehow we get a session on initial load, treat as signed in
                console.log("[AuthCallbackPage] INITIAL_SESSION has data, treating as SIGNED_IN.");
                queryClient.invalidateQueries({ queryKey: ['userProfile'] });
                queryClient.invalidateQueries({ queryKey: ['subscriptionUsage'] });
                const redirectTo = sessionStorage.getItem('postLoginRedirectPath') || '/';
                sessionStorage.removeItem('postLoginRedirectPath');
                navigate(redirectTo, { replace: true });
            }
        } else if (event === "USER_UPDATED") {
             // Ignore user updated events during callback
             console.log("[AuthCallbackPage] Ignoring USER_UPDATED event.");
        } else {
            // Handle other events or potential errors if necessary
             console.warn("[AuthCallbackPage] Unhandled auth event:", event);
        }
    });
    
    // Handle cases where the hash might contain an error from the OAuth provider
    const hash = window.location.hash;
    if (hash.includes('error=')) {
        const params = new URLSearchParams(hash.substring(1)); // Remove #
        const errorDesc = params.get('error_description');
        console.error("[AuthCallbackPage] OAuth Error detected in URL hash:", errorDesc);
        setError(errorDesc || 'An unknown error occurred during authentication.');
    }

    return () => {
      console.log("[AuthCallbackPage] Unmounting, unsubscribing.");
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, queryClient]);

  return (
    <div className="flex flex-col justify-center items-center min-h-screen w-full p-4">
        {error ? (
            <div className="text-center text-destructive">
                <h1 className="text-xl font-semibold mb-2">Authentication Failed</h1>
                <p className="text-sm mb-4">{error}</p>
                <Button onClick={() => navigate('/login')} variant="outline">Return to Login</Button>
            </div>
        ) : (
            <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Finalizing authentication...</p>
            </div>
        )}
    </div>
  );
}

export default AuthCallbackPage; 