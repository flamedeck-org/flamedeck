import { useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import SharedPageSEO from '@/components/seo/SharedPageSEO';

const Login: React.FC = () => {
  const { toast } = useToast();
  const location = useLocation();

  const handleGoogleLogin = async () => {
    // Store the intended destination before redirecting to Google
    const from =
      location.state?.from?.pathname ||
      sessionStorage.getItem('postLoginRedirectPath') ||
      '/traces';
    try {
      sessionStorage.setItem('postLoginRedirectPath', from);
    } catch (e) {
      console.error('Failed to set sessionStorage for redirect path:', e);
      // Continue without storing? Or show error? Depends on UX preference.
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Redirect to the dedicated callback page
          redirectTo: window.location.origin + '/auth/callback',
        },
      });

      if (error) throw error;
      // No navigation here, Supabase handles the redirect
    } catch (error) {
      toast({
        title: 'Login failed',
        description: (error as Error).message || 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  return (
    <Layout hideNav>
      <SharedPageSEO
        pageTitle="Login"
        description="Sign in to FlameDeck to access your performance traces, collaborate with your team, and analyze profiles."
        path="/login"
        ogType="website"
      />
      <div className="flex items-center justify-center min-h-[80vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 w-12 h-12 rounded flex items-center justify-center">
              <div className="w-12 h-12 rounded">
                <img
                  src="/flamestack_icon_300.webp"
                  alt="FlameDeck Logo"
                  width={45}
                  height={45}
                  className="rounded"
                />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Welcome to FlameDeck</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button onClick={handleGoogleLogin} className="w-full" variant="outline">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </Button>
          </CardContent>

          <CardFooter className="flex justify-center text-sm text-muted-foreground">
            Performance profiling for engineering teams
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
};

export default Login;
