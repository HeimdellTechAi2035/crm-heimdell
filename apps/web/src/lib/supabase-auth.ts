/**
 * Supabase Authentication Utilities
 * 
 * Production-ready auth functions using Supabase Auth.
 * All operations use the anon key and rely on RLS for security.
 */

import { supabase } from './supabaseClient';
import type { User, Session, AuthError } from '@supabase/supabase-js';

// Re-export types for convenience
export type { User, Session, AuthError };

/**
 * Sign in result type
 */
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
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      return {
        success: false,
        user: null,
        session: null,
        error: getAuthErrorMessage(error),
      };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      user: null,
      session: null,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Sign up with email and password
 * 
 * Note: Depending on Supabase settings, email confirmation may be required.
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        // Redirect URL after email confirmation (if enabled)
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      return {
        success: false,
        user: null,
        session: null,
        error: getAuthErrorMessage(error),
      };
    }

    // Check if email confirmation is required
    // When confirmation is required, session will be null but user will exist
    const needsConfirmation = data.user && !data.session;

    return {
      success: true,
      user: data.user,
      session: data.session,
      error: needsConfirmation 
        ? 'Please check your email to confirm your account.'
        : null,
    };
  } catch (err) {
    return {
      success: false,
      user: null,
      session: null,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Sign out the current user
 * Clears all session data from localStorage
 */
export async function signOut(): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error: getAuthErrorMessage(error),
      };
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: 'Failed to sign out. Please try again.',
    };
  }
}

/**
 * Get the current session
 * Returns null if not authenticated
 */
export async function getSession(): Promise<Session | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch {
    return null;
  }
}

/**
 * Get the current user
 * Returns null if not authenticated
 */
export async function getUser(): Promise<User | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * Refresh the current session
 * Useful to get a fresh JWT before making important API calls
 */
export async function refreshSession(): Promise<Session | null> {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (error) {
      return {
        success: false,
        error: getAuthErrorMessage(error),
      };
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: 'Failed to send reset email. Please try again.',
    };
  }
}

/**
 * Convert Supabase auth errors to user-friendly messages
 */
function getAuthErrorMessage(error: AuthError): string {
  const errorMessages: Record<string, string> = {
    'Invalid login credentials': 'Invalid email or password.',
    'Email not confirmed': 'Please verify your email address before signing in.',
    'User already registered': 'An account with this email already exists.',
    'Password should be at least 6 characters': 'Password must be at least 6 characters.',
    'Signup is disabled': 'New registrations are currently disabled.',
    'Email rate limit exceeded': 'Too many attempts. Please try again later.',
    'Invalid email': 'Please enter a valid email address.',
  };

  // Check for known error messages
  for (const [key, message] of Object.entries(errorMessages)) {
    if (error.message.includes(key)) {
      return message;
    }
  }

  // Return the original message if no mapping found
  return error.message || 'Authentication failed. Please try again.';
}

/**
 * Subscribe to auth state changes
 * Returns an unsubscribe function
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
