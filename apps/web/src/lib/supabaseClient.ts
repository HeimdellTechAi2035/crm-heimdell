/**
 * Auth Client - Real multi-user authentication for Heimdell CRM
 * Uses Netlify Functions + Neon Postgres for user management
 */

const NETLIFY_FUNCTIONS_URL = '/.netlify/functions';
const AUTH_STORAGE_KEY = 'heimdell-auth';

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface AuthSession {
  user: User;
  token: string;
}

// Get stored session
function getStoredSession(): AuthSession | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    
    const session = JSON.parse(stored);
    
    // Check token expiration
    if (session.token) {
      const payload = JSON.parse(atob(session.token));
      if (payload.exp && payload.exp < Date.now()) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }
    }
    
    return session;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

// Store session
function storeSession(session: AuthSession | null) {
  if (session) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

// Mock supabase object for compatibility with existing code
export const supabase = {
  auth: {
    getSession: async () => {
      const session = getStoredSession();
      return { data: { session: session ? { user: session.user } : null } };
    },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
};

/**
 * Get the current user's ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = getStoredSession();
  return session?.user?.id ?? null;
}

/**
 * Get the current user's ID synchronously
 */
export function getCurrentUserIdSync(): string | null {
  const session = getStoredSession();
  return session?.user?.id ?? null;
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  const session = getStoredSession();
  return session?.user ?? null;
}

/**
 * Get auth token
 */
export function getAuthToken(): string | null {
  const session = getStoredSession();
  return session?.token ?? null;
}

/**
 * Sign up a new user
 */
export async function authSignUp(email: string, password: string, name?: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/auth_signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Signup failed' };
    }
    
    // Store session
    storeSession({ user: data.user, token: data.token });
    
    return { success: true, user: data.user };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Sign in an existing user
 */
export async function authSignIn(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/auth_login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Login failed' };
    }
    
    // Store session
    storeSession({ user: data.user, token: data.token });
    
    return { success: true, user: data.user };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Sign out
 */
export function authSignOut() {
  storeSession(null);
}

/**
 * Check if user is logged in
 */
export function isLoggedIn(): boolean {
  return getStoredSession() !== null;
}
