/**
 * Supabase Auth Guard Component
 * 
 * Protects routes by checking Supabase authentication state.
 * Redirects unauthenticated users to login page.
 */

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/useAuth';

interface AuthGuardProps {
  children: ReactNode;
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/signup', '/reset-password'];

/**
 * AuthGuard Component
 * 
 * Wraps protected content and handles:
 * - Loading state while checking auth
 * - Redirecting unauthenticated users to login
 * - Redirecting authenticated users away from login page
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  
  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          {/* Minimal loading indicator */}
          <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-cyan-400/50 font-['Share_Tech_Mono'] text-sm">
            INITIALIZING...
          </p>
        </div>
      </div>
    );
  }

  // If on a public route (login/signup)
  if (isPublicRoute) {
    // If already authenticated, redirect to home
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/';
      return <Navigate to={from} replace />;
    }
    // Otherwise, show the public page
    return <>{children}</>;
  }

  // Protected route - require authentication
  if (!isAuthenticated) {
    // Save the attempted URL for redirecting after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated - render children
  return <>{children}</>;
}

/**
 * Hook to check if current route is protected
 */
export function useIsProtectedRoute(): boolean {
  const location = useLocation();
  return !PUBLIC_ROUTES.includes(location.pathname);
}
