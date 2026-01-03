/**
 * Supabase Client Configuration
 * 
 * This file initializes the Supabase client for frontend use.
 * Uses the anon (public) key only - NEVER use service_role key in frontend.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Hardcoded Supabase credentials (anon key is safe for frontend)
const supabaseUrl = 'https://qzguvzszodpvyzgbonmr.supabase.co';
const supabaseAnonKey = 'sb_publishable_rhiw0megkxN-z3ANlCcyeA_nMF-F0-q';

/**
 * Supabase client instance
 * 
 * Configuration options:
 * - persistSession: true - Sessions persist across page refreshes
 * - autoRefreshToken: true - Automatically refresh JWT before expiry
 * - detectSessionInUrl: true - Handle OAuth redirects
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      // Persist session in localStorage
      persistSession: true,
      // Automatically refresh the session before expiry
      autoRefreshToken: true,
      // Detect OAuth redirect params in URL
      detectSessionInUrl: true,
      // Storage key prefix
      storageKey: 'heimdell-auth',
    },
  }
);

/**
 * Get the current authenticated user's ID
 * Returns null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/**
 * Get the current authenticated user's ID synchronously from cache
 * WARNING: This may be stale - prefer getCurrentUserId() for critical operations
 */
export function getCurrentUserIdSync(): string | null {
  // Access the cached session synchronously
  const sessionStr = localStorage.getItem('heimdell-auth');
  if (!sessionStr) return null;
  
  try {
    const data = JSON.parse(sessionStr);
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}
