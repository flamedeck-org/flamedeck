import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScrollToTop from "./components/utils/ScrollToTop";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Traces from "./pages/Traces";
import TraceDetail from "./pages/TraceDetail";
import ApiKeysPage from "./pages/settings/ApiKeysPage";
import Upload from "./pages/Upload";
import NotFound from "./pages/NotFound";
import TraceViewerPage from "./pages/TraceViewerPage";
import DocsApiPage from "./pages/DocsApiPage/DocsApiPage";
import DocsGettingStartedPage from "./pages/DocsGettingStartedPage";
import DocsLayout from "./components/docs/DocsLayout";
import { useTheme } from "./components/speedscope-ui/themes/theme";
import { useAtom } from "./lib/speedscope-core/atom";
import { glCanvasAtom } from "./lib/speedscope-core/app-state";
import { useMemo } from "react";
import { getCanvasContext } from "./lib/speedscope-core/app-state/getters";
import { GLCanvas } from "./components/speedscope-ui/application";
import { SharingModalProvider } from '@/hooks/useSharingModal';
import { SharingModal } from '@/components/sharing/SharingModal';
import SettingsLayout from '@/components/settings/SettingsLayout';
import SettingsPage from './pages/settings/SettingsPage';
import Navbar from "./components/Navbar";
import ProtectedRoute from './components/ProtectedRoute';

const queryClient = new QueryClient();

// Wrapper component for conditional routing
const AppRoutes = () => {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/traces" replace /> : <Index />} />
      <Route path="/login" element={<Login />} />

      {/* Documentation Routes - accessible to all */}
      <Route path="/docs" element={<DocsLayout />}>
        <Route index element={<Navigate to="/docs/getting-started" replace />} />
        <Route path="getting-started" element={<DocsGettingStartedPage />} />
        <Route path="api" element={<DocsApiPage />} />
      </Route>

      {/* Protected Routes: Wrap authenticated routes with ProtectedRoute */}
      <Route element={<ProtectedRoute />}>
        <Route path="/traces" element={<Traces />} />
        <Route path="/traces/folder/:folderId" element={<Traces />} />
        <Route path="/traces/:id" element={<TraceDetail />} />
        <Route path="/traces/:id/view" element={<TraceViewerPage />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="/settings/api-keys" replace />} /> 
          <Route path="api-keys" element={<ApiKeysPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  const theme = useTheme()
  const glCanvas = useAtom(glCanvasAtom);
  const canvasContext = useMemo(
    () => (glCanvas ? getCanvasContext({theme, canvas: glCanvas}) : null),
    [theme, glCanvas],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SharingModalProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <div className="h-full w-full flex flex-col speedscope-app-container relative">
              <Navbar />
              <GLCanvas theme={theme} setGLCanvas={glCanvasAtom.set} canvasContext={canvasContext} />
              <AppRoutes />
            </div>
          </BrowserRouter>
          <SharingModal />
        </TooltipProvider>
      </SharingModalProvider>
    </AuthProvider>
  </QueryClientProvider>
  )
};

export default App;
