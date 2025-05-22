import { useEffect, useMemo } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScrollToTop from './components/utils/ScrollToTop';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Index from './pages/Index.tsx';
import Login from './pages/Login.tsx';
import Traces from './pages/Traces.tsx';
import TraceDetail from './pages/TraceDetail';
import ApiKeysPage from './pages/settings/ApiKeysPage';
import Upload from './pages/Upload';
import NotFound from './pages/NotFound';
import TraceViewerPage from './pages/TraceViewerPage';
import DocsApiKeysPage from './pages/DocsApiKeysPage';
import DocsCliUploadPage from './pages/DocsCliUploadPage';
import DocsNpmUploadPage from './pages/DocsNpmUploadPage';
import DocsReactNativePage from './pages/DocsReactNativePage';
import DocsLayout from './components/docs/DocsLayout';
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
import { supabase } from './integrations/supabase/client.ts';

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
  // ProtectedRoute will then handle the /traces route and any onboarding redirects.
  return <Navigate to="/traces" replace />;
}
// --- End RootHandler ---

const queryClient = new QueryClient();

// Wrapper component for conditional routing
const AppRoutes = () => {
  // Remove useAuth from here again, RootHandler and ProtectedRoute handle checks

  return (
    <Routes>
      {/* Handle the root path explicitly using RootHandler */}
      <Route path="/" element={<RootHandler />} />

      {/* Other Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Documentation Routes - accessible to all */}
      <Route path="/docs" element={<DocsLayout />}>
        <Route index element={<Navigate to="/docs/api-keys" replace />} />
        <Route path="api-keys" element={<DocsApiKeysPage />} />
        <Route path="cli-upload" element={<DocsCliUploadPage />} />
        <Route path="npm-upload" element={<DocsNpmUploadPage />} />
        <Route path="react-native" element={<DocsReactNativePage />} />
      </Route>

      {/* Public Trace Viewer Route - outside ProtectedRoute */}
      <Route path="/traces/:id/view" element={<TraceViewerPage />} />

      {/* Onboarding Route - Must be outside ProtectedRoute */}
      <Route path="/onboarding/username" element={<UsernameStep />} />

      {/* Protected Routes - NO LONGER includes the root path "/" */}
      <Route element={<ProtectedRoute />}>
        {/* ProtectedRoute now only guards these specific authenticated paths */}
        <Route path="/traces" element={<Traces />} />
        <Route path="/traces/folder/:folderId" element={<Traces />} />
        <Route path="/traces/:id" element={<TraceDetail />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="/settings/general" replace />} />
          <Route path="general" element={<SettingsPage />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
        </Route>
      </Route>

      {/* Catch-all Not Found Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
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
          <SharingModalProvider>
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
                  <UpgradeModal />
                </BrowserRouter>
              </TooltipProvider>
            </UpgradeModalProvider>
          </SharingModalProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
