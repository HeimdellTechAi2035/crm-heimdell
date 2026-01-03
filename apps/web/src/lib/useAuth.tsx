/**
 * useAuth Hook
 * 
 * React hook for managing Supabase authentication state.
 * Provides loading states, user info, and auth methods.
 */

import { useState, useEffect, useCallback, createContext, useContext, ReactNode, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { signIn, signUp, signOut, getSession, type User, type Session, type AuthResult } from './supabase-auth';
import { setNetlifyAuth, clearNetlifyAuth } from './netlify-api';

/**
 * Admin email - only this user has admin privileges
 * This is NOT a security measure on its own; backend RLS policies should enforce admin access.
 * This is purely for UI gating.
 */
const ADMIN_EMAIL = 'andrew@heimdell.tech';

/**
 * Auth context state
 */
interface AuthContextState {
  // Current user (null if not authenticated)
  user: User | null;
  // Current session (null if not authenticated)
  session: Session | null;
  // True while checking initial auth state
  isLoading: boolean;
  // True if user is authenticated
  isAuthenticated: boolean;
  // True if user is the admin (andrew@heimdell.tech)
  isAdmin: boolean;
  // Sign in with email/password
  login: (email: string, password: string) => Promise<AuthResult>;
  // Sign up with email/password
  register: (email: string, password: string) => Promise<AuthResult>;
  // Sign out
  logout: () => Promise<{ success: boolean; error: string | null }>;
  // Get current user ID (convenience method)
  getUserId: () => string | null;
}

/**
 * Auth context
 */
const AuthContext = createContext<AuthContextState | null>(null);

/**
 * Auth provider props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider Component
 * 
 * Wrap your app with this to provide auth context to all components.
 * Handles initial session check and listens for auth state changes.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check initial session on mount
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const currentSession = await getSession();
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          // Set Netlify auth for serverless functions
          if (currentSession?.user?.email) {
            setNetlifyAuth(currentSession.user.email, currentSession.user.id);
          }
        }
      } catch (error) {
        console.error('Failed to get initial session:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        console.log('Auth state changed:', event);
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);

        // Sync with Netlify auth
        if (newSession?.user?.email) {
          setNetlifyAuth(newSession.user.email, newSession.user.id);
        }

        // Handle specific auth events
        if (event === 'SIGNED_OUT') {
          // Clear any cached data when user signs out
          setUser(null);
          setSession(null);
          clearNetlifyAuth();
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Login handler
  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const result = await signIn(email, password);
    return result;
  }, []);

  // Register handler
  const register = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const result = await signUp(email, password);
    return result;
  }, []);

  // Logout handler
  const logout = useCallback(async () => {
    const result = await signOut();
    if (result.success) {
      setUser(null);
      setSession(null);
      clearNetlifyAuth();
    }
    return result;
  }, []);

  // Get current user ID
  const getUserId = useCallback((): string | null => {
    return user?.id ?? null;
  }, [user]);

  // Check if current user is admin (based on email)
  const isAdmin = useMemo(() => {
    if (!user?.email) return false;
    return user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  }, [user?.email]);

  const value: AuthContextState = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user && !!session,
    isAdmin,
    login,
    register,
    logout,
    getUserId,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth Hook
 * 
 * Access auth state and methods from any component.
 * Must be used within an AuthProvider.
 */
export function useAuth(): AuthContextState {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

/**
 * Higher-order component for components that require authentication
 * Useful for class components or when you prefer HOCs over hooks
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P & { auth: AuthContextState }>
) {
  return function AuthenticatedComponent(props: P) {
    const auth = useAuth();
    return <Component {...props} auth={auth} />;
  };
}
