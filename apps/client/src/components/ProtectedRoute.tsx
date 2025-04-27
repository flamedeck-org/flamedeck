import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // Display a full-screen centered spinner while loading
    return null;
  }

  // If user exists, render the nested routes via Outlet
  // Otherwise, redirect to the login page, passing the current location
  // Also store the path in sessionStorage as a backup for OAuth redirects
  if (!user) {
    try {
      sessionStorage.setItem('postLoginRedirectPath', location.pathname + location.search + location.hash);
    } catch (e) {
      console.error("Failed to set sessionStorage:", e);
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute; 