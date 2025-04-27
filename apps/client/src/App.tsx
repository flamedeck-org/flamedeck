import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Traces from "./pages/Traces";
import TraceDetail from "./pages/TraceDetail";
import ApiKeysPage from "./pages/settings/ApiKeysPage";
import Upload from "./pages/Upload";
import NotFound from "./pages/NotFound";
import TraceViewerPage from "./pages/TraceViewerPage";
import DocsApiPage from "./pages/DocsApiPage/DocsApiPage";
import { useAuth } from "./contexts/AuthContext";
import { useTheme } from "./components/speedscope-ui/themes/theme";
import { useAtom } from "./lib/speedscope-core/atom";
import { glCanvasAtom } from "./lib/speedscope-core/app-state";
import { useMemo } from "react";
import { getCanvasContext } from "./lib/speedscope-core/app-state/getters";
import { GLCanvas } from "./components/speedscope-ui/application";
import { SharingModalProvider } from '@/hooks/useSharingModal';
import { SharingModal } from '@/components/sharing/SharingModal';
// Import Settings components
import SettingsLayout from '@/components/settings/SettingsLayout';
import SettingsPage from './pages/settings/SettingsPage'; 

const queryClient = new QueryClient();

// Wrapper component for conditional routing
const AppRoutes = () => {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/traces" replace /> : <Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/traces" element={<Traces />} />
      <Route path="/traces/folder/:folderId" element={<Traces />} />
      <Route path="/traces/:id" element={<TraceDetail />} />
      <Route path="/traces/:id/view" element={<TraceViewerPage />} />
      <Route path="/upload" element={<Upload />} />
      
      {/* Settings Routes */}
      <Route path="/settings" element={<SettingsLayout />}>
        {/* Redirect /settings to /settings/api-keys or a default settings page */}
        <Route index element={<Navigate to="/settings/api-keys" replace />} /> 
        {/* <Route index element={<SettingsPage />} /> */}
        <Route path="api-keys" element={<ApiKeysPage />} />
        {/* Add other settings sub-routes here */}
      </Route>

      {/* Documentation Routes */}
      <Route path="/docs/api" element={<DocsApiPage />} />

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
            <div className="h-full w-full flex flex-col speedscope-app-container relative">
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
