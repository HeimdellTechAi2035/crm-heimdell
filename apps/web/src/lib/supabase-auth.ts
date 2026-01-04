/**
 * Authentication Utilities for Heimdell CRM
 * Real multi-user authentication using Netlify Functions + Neon Postgres
 */

import { 
  authSignIn, 
  authSignUp, 
  authSignOut, 
  getCurrentUser, 
  getAuthToken,
  isLoggedIn,
  type User 
} from './supabaseClient';

// Re-export User type
export type { User };

export interface Session {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthError {
  message: string;
}

export interface AuthResult {
  success: boolean;
  user: User | null;
  session: Session | null;
  error: string | null;
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const result = await authSignIn(email, password);
  
  if (!result.success || !result.user) {
    return {
      success: false,
      user: null,
      session: null,
      error: result.error || 'Login failed',
    };
  }
  
  const token = getAuthToken() || '';
  
  return {
    success: true,
    user: result.user,
    session: {
      user: result.user,
      access_token: token,
      refresh_token: token,
      expires_in: 604800, // 7 days
      token_type: 'bearer',
    },
    error: null,
  };
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, name?: string): Promise<AuthResult> {
  const result = await authSignUp(email, password, name);
  
  if (!result.success || !result.user) {
    return {
      success: false,
      user: null,
      session: null,
      error: result.error || 'Signup failed',
    };
  }
  
  const token = getAuthToken() || '';
  
  return {
    success: true,
    user: result.user,
    session: {
      user: result.user,
      access_token: token,
      refresh_token: token,
      expires_in: 604800,
      token_type: 'bearer',
    },
    error: null,
  };
}

/**
 * Sign out
 */
export async function signOut(): Promise<{ success: boolean; error: string | null }> {
  authSignOut();
  return { success: true, error: null };
}

/**
 * Get the current session
 */
export async function getSession(): Promise<Session | null> {
  const user = getCurrentUser();
  const token = getAuthToken();
  
  if (!user || !token) return null;
  
  return {
    user,
    access_token: token,
    refresh_token: token,
    expires_in: 604800,
    token_type: 'bearer',
  };
}

/**
 * Get the current user
 */
export async function getUser(): Promise<User | null> {
  return getCurrentUser();
}

/**
 * Refresh the current session (no-op for now)
 */
export async function refreshSession(): Promise<Session | null> {
  return getSession();
}

/**
 * Send password reset email (not implemented)
 */
export async function resetPassword(_email: string): Promise<{ success: boolean; error: string | null }> {
  return { success: false, error: 'Password reset not yet implemented' };
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): () => void {
  // Check current state immediately
  const checkAuth = async () => {
    const session = await getSession();
    callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
  };
  
  setTimeout(checkAuth, 0);
  
  // Return unsubscribe function
  return () => {};
}

/**
 * Check if logged in
 */
export { isLoggedIn };


