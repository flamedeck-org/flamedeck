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
      '/home';
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

  const handleGitHubLogin = async () => {
    // Store the intended destination before redirecting to GitHub
    const from =
      location.state?.from?.pathname ||
      sessionStorage.getItem('postLoginRedirectPath') ||
      '/home';
    try {
      sessionStorage.setItem('postLoginRedirectPath', from);
    } catch (e) {
      console.error('Failed to set sessionStorage for redirect path:', e);
      // Continue without storing? Or show error? Depends on UX preference.
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
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

      {/* Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500 via-red-400 to-yellow-500" />
        <div className="absolute inset-0 bg-gradient-to-tl from-yellow-400/30 via-transparent to-red-500/30" />
      </div>

      <div className="flex items-center justify-center min-h-[85vh] py-6 px-4">
        <div className="w-full max-w-md">
          {/* Main Login Card */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-yellow-500/10 rounded-2xl blur-lg" />
            <Card className="relative bg-card/90 backdrop-blur-xl border border-border/30 shadow-xl transition-all duration-300 rounded-2xl overflow-hidden">
              <CardHeader className="text-center space-y-6 pt-10 pb-6">
                {/* Logo with enhanced styling */}
                <div className="mx-auto">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-yellow-500/10 rounded-xl blur-sm" />
                    <div className="relative w-16 h-16 bg-gradient-to-br from-background/90 to-background/70 backdrop-blur-sm rounded-xl border border-border/30 flex items-center justify-center">
                      <img
                        src="/flamestack_icon_300.webp"
                        alt="FlameDeck Logo"
                        width={56}
                        height={56}
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* Enhanced title */}
                <div className="space-y-3">
                  <CardTitle className="text-4xl font-bold tracking-tight leading-tight">
                    Welcome to
                    <span className="block bg-gradient-to-r from-red-500 via-red-400 to-yellow-500 bg-clip-text text-transparent mt-1">
                      FlameDeck
                    </span>
                  </CardTitle>
                  <p className="text-muted-foreground text-base leading-relaxed">
                    Sign in to access your performance traces
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 px-8 pb-6">
                {/* Enhanced Google Login Button */}
                <Button
                  onClick={handleGoogleLogin}
                  className="w-full group/btn relative overflow-hidden bg-background/70 backdrop-blur-sm border-2 border-border/60 hover:border-border hover:bg-background/90 text-foreground hover:text-foreground transition-all duration-300 hover:scale-[1.01] hover:shadow-lg py-5"
                  variant="outline"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/3 to-yellow-500/3 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                  <svg
                    className="w-5 h-5 mr-3 transition-transform group-hover/btn:scale-105"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="relative font-medium">Sign in with Google</span>
                </Button>
              </CardContent>

              <CardFooter className="flex flex-col items-center text-center px-8 pb-10">
                <p className="text-sm text-muted-foreground">Performance debugging made simple</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Start analyzing your traces in seconds
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Login;
