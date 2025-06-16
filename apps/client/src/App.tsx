import { useEffect, useMemo } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScrollToTop from './components/utils/ScrollToTop';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SidebarProvider } from '@/contexts/SidebarContext';
import Index from './pages/Index.tsx';
import Login from './pages/Login.tsx';
import Home from './pages/Home.tsx';
import Traces from './pages/Traces.tsx';
import { TraceDetail } from './pages/TraceDetail';
import ApiKeysPage from './pages/settings/ApiKeysPage';
import NotFound from './pages/NotFound';
import TraceViewerPage from './pages/TraceViewerPage';
import { useTheme } from './components/speedscope-ui/theme.tsx';
import { useAtom } from './lib/speedscope-core/atom';
import { glCanvasAtom } from './lib/speedscope-core/app-state/index';
import { getCanvasContext } from './lib/speedscope-core/app-state/getters';
import { GLCanvas } from './components/speedscope-ui/application';
import { SharingModalProvider } from '@/hooks/useSharingModal';
import { SharingModal } from '@/components/sharing/SharingModal';
import SettingsLayout from '@/components/settings/SettingsLayout';
import SettingsPage from './pages/settings/SettingsPage';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { Loader2 } from 'lucide-react';
import UsernameStep from './pages/Onboarding/UsernameStep';
import AuthCallbackPage from './pages/AuthCallbackPage';
import { HelmetProvider } from 'react-helmet-async';
import { UpgradeModal } from '@/components/modals/UpgradeModal';
import { UpgradeModalProvider } from '@/hooks/useUpgradeModal';
import { PaymentSuccessPage } from './pages/PaymentSuccessPage';
import { PaymentCancelPage } from './pages/PaymentCancelPage';
import BillingPage from './pages/settings/BillingPage';
import { TraceUploadModalProvider } from '@/hooks/useTraceUploadModal';
import { TraceUploadModal } from '@/components/TraceUploadModal';
import { OnboardingUpgradeStep } from './pages/Onboarding/OnboardingUpgradeStep';
import LoggedOutTraceViewerPage from './pages/LoggedOutTraceViewerPage';

// Component to redirect docs pages to external documentation
function DocsRedirect({ path }: { path: string }) {
  useEffect(() => {
    window.location.replace(`https://docs.flamedeck.com${path}`);
  }, [path]);

  return (
    <div className="flex justify-center items-center h-[calc(100vh-var(--header-height))] w-full">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to documentation...</p>
      </div>
    </div>
  );
}

// --- Component to handle root path logic ---
function RootHandler() {
  const { user, loading, profileLoading } = useAuth();
  // Consider both loading states
  const isAuthLoading = loading || profileLoading;

  if (isAuthLoading) {
    // Show spinner covering the main content area while determining auth state
    return (
      <div className="flex justify-center items-center h-[calc(100vh-var(--header-height))] w-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If loading is finished and there's no user, show the Index page
  if (!user) {
    return <Index />;
  }

  // If loading is finished and there *is* a user, navigate to the main app section.
  // ProtectedRoute will then handle the /home route and any onboarding redirects.
  return <Navigate to="/home" replace />;
}
// --- End RootHandler ---

const queryClient = new QueryClient();

// Component to handle GL canvas clearing on navigation
function NavigationHandler() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const location = useLocation();
  const glCanvas = useAtom(glCanvasAtom);

  useEffect(() => {
    if (glCanvas) {
      // Set canvas to null to clear it
      glCanvasAtom.set(null);

      // Restore the canvas on the next tick
      setTimeout(() => {
        glCanvasAtom.set(glCanvas);
      }, 0);
    }
  }, [location.pathname, glCanvas, isAuthenticated]);

  return null;
}

// Wrapper component for conditional routing
const AppRoutes = () => {
  // Remove useAuth from here again, RootHandler and ProtectedRoute handle checks

  return (
    <>
      <NavigationHandler />
      <Routes>
        {/* Handle the root path explicitly using RootHandler */}
        <Route path="/" element={<RootHandler />} />

        {/* Other Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/payment-success" element={<PaymentSuccessPage />} />
        <Route path="/payment-cancel" element={<PaymentCancelPage />} />

        {/* Documentation Redirects - redirect to external docs */}
        <Route path="/docs" element={<DocsRedirect path="" />} />
        <Route path="/docs/api-keys" element={<DocsRedirect path="/api-keys" />} />
        <Route path="/docs/cli-upload" element={<DocsRedirect path="/cli-upload" />} />
        <Route path="/docs/npm-upload" element={<DocsRedirect path="/npm-upload" />} />
        <Route path="/docs/react-native" element={<DocsRedirect path="/react-native" />} />
        <Route path="/docs/mcp-server" element={<DocsRedirect path="/mcp-server" />} />

        {/* Public Trace Viewer Route - outside ProtectedRoute */}
        <Route path="/traces/:id/view" element={<TraceViewerPage />} />

        {/* Logged Out Trace Viewer Routes */}
        <Route path="/viewer" element={<LoggedOutTraceViewerPage />} />
        <Route path="/viewer/trace-viewer" element={<TraceViewerPage />} />

        {/* Onboarding Route - Must be outside ProtectedRoute */}
        <Route path="/onboarding/username" element={<UsernameStep />} />
        <Route path="/onboarding/upgrade" element={<OnboardingUpgradeStep />} />

        {/* Protected Routes - NO LONGER includes the root path "/" */}
        <Route element={<ProtectedRoute />}>
          {/* ProtectedRoute now only guards these specific authenticated paths */}
          <Route path="/home" element={<Home />} />
          <Route path="/traces" element={<Traces />} />
          <Route path="/traces/folder/:folderId" element={<Traces />} />
          <Route path="/traces/:id" element={<TraceDetail />} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="/settings/general" replace />} />
            <Route path="general" element={<SettingsPage />} />
            <Route path="api-keys" element={<ApiKeysPage />} />
            <Route path="billing" element={<BillingPage />} />
          </Route>
        </Route>

        {/* Catch-all Not Found Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => {
  const theme = useTheme();
  const glCanvas = useAtom(glCanvasAtom);
  const canvasContext = useMemo(
    () => (glCanvas ? getCanvasContext({ theme, canvas: glCanvas }) : null),
    [theme, glCanvas]
  );

  // For testing: you can grab the JWT from here
  // useEffect(() => {
  //   setTimeout(() => {
  //     supabase.auth.getSession().then(({ data }) => console.log(data.session.access_token))
  //   }, 5000)
  // }, [])

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SidebarProvider>
            <SharingModalProvider>
              <TraceUploadModalProvider>
                <UpgradeModalProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <BrowserRouter>
                      <ScrollToTop />
                      <div className="h-full w-full flex flex-col speedscope-app-container relative">
                        <Navbar />
                        <GLCanvas
                          theme={theme}
                          setGLCanvas={glCanvasAtom.set}
                          canvasContext={canvasContext}
                        />
                        <AppRoutes />
                      </div>
                      <SharingModal />
                      <TraceUploadModal />
                      <UpgradeModal />
                    </BrowserRouter>
                  </TooltipProvider>
                </UpgradeModalProvider>
              </TraceUploadModalProvider>
            </SharingModalProvider>
          </SidebarProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
