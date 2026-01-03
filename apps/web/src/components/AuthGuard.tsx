import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isSessionValid, HIDDEN_LOGIN_ROUTE, isLoginRoute, destroySession } from '@/lib/auth-gate';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Global Authentication Guard
 * 
 * Wraps all application routes and enforces authentication.
 * Unauthenticated users see nothing - just a blank screen while redirecting.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const currentPath = location.pathname;
      const isOnLoginPage = isLoginRoute(currentPath);
      const hasValidSession = isSessionValid();

      if (isOnLoginPage) {
        // On login page - allow if not authenticated, redirect if already authenticated
        if (hasValidSession) {
          navigate('/', { replace: true });
          return;
        }
        setIsAuthorized(true);
        setIsChecking(false);
        return;
      }

      // Not on login page - must have valid session
      if (!hasValidSession) {
        // CRITICAL: Do not reveal the login route in the URL bar
        // Redirect to hidden login route
        navigate(HIDDEN_LOGIN_ROUTE, { replace: true });
        return;
      }

      // Authorized
      setIsAuthorized(true);
      setIsChecking(false);
    };

    checkAuth();
  }, [location.pathname, navigate]);

  // Listen for storage changes (logout in other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === '_hd_sx_91' && !e.newValue) {
        // Session was cleared in another tab - force re-auth
        setIsAuthorized(false);
        navigate(HIDDEN_LOGIN_ROUTE, { replace: true });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [navigate]);

  // While checking, show absolutely nothing
  if (isChecking) {
    return (
      <div className="min-h-screen bg-black">
        {/* Intentionally blank - no loading indicators that reveal app exists */}
      </div>
    );
  }

  // Not authorized - show nothing (should be redirecting)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black">
        {/* Intentionally blank */}
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook to get logout function
 */
export function useLogout() {
  const navigate = useNavigate();

  return () => {
    destroySession();
    navigate(HIDDEN_LOGIN_ROUTE, { replace: true });
    // Force a full state reset
    window.location.reload();
  };
}
