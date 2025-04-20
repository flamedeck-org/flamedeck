
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
import Upload from "./pages/Upload";
import NotFound from "./pages/NotFound";
import { useAuth } from "./contexts/AuthContext";

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
      <Route path="/traces/:id" element={<TraceDetail />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
