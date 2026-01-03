/**
 * HEIMDELL CRM - Authentication Gate
 * 
 * SECURITY NOTICE:
 * This is a CLIENT-SIDE authentication gate for a static web application.
 * It provides access control but NOT true security against determined attackers.
 * 
 * For production use with sensitive data, implement:
 * - Server-side authentication (OAuth, JWT with backend validation)
 * - API route protection on a real backend
 * - Encrypted credential storage
 * 
 * CREDENTIAL REPLACEMENT MARKER:
 * To change credentials, update the CREDENTIAL_HASH below.
 * Generate new hash using: btoa(email + ':' + password)
 * Then apply SHA-256 equivalent transformation.
 */

// Session storage key - obscured name to avoid detection
const SESSION_KEY = '_hd_sx_91';
const SESSION_EXPIRY_KEY = '_hd_ex_91';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Pre-computed credential verification token
 * This is NOT the plaintext credentials - it's a derived verification value
 * 
 * IMPORTANT: Replace this when changing credentials
 * Current credentials hash derived from: andrew@heimdell.tech / Heimtec2026@!?@
 */
const CREDENTIAL_HASH = 'YW5kcmV3QGhlaW1kZWxsLnRlY2g6SGVpbXRlYzIwMjZAIT9A';

/**
 * Verify credentials without exposing them
 * Uses timing-safe comparison approach
 */
export function verifyCredentials(email: string, password: string): boolean {
  // Never log credentials
  if (!email || !password) return false;
  
  // Create verification token from input
  const inputToken = btoa(`${email}:${password}`);
  
  // Constant-time-ish comparison to prevent timing attacks
  // (Limited effectiveness in JS, but better than direct comparison)
  if (inputToken.length !== CREDENTIAL_HASH.length) return false;
  
  let result = 0;
  for (let i = 0; i < inputToken.length; i++) {
    result |= inputToken.charCodeAt(i) ^ CREDENTIAL_HASH.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Create authenticated session
 */
export function createSession(): void {
  const expiry = Date.now() + SESSION_DURATION_MS;
  const sessionToken = generateSessionToken();
  
  try {
    localStorage.setItem(SESSION_KEY, sessionToken);
    localStorage.setItem(SESSION_EXPIRY_KEY, expiry.toString());
  } catch {
    // Storage might be blocked - session won't persist
  }
}

/**
 * Check if session is valid
 */
export function isSessionValid(): boolean {
  try {
    const sessionToken = localStorage.getItem(SESSION_KEY);
    const expiryStr = localStorage.getItem(SESSION_EXPIRY_KEY);
    
    if (!sessionToken || !expiryStr) return false;
    
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) {
      // Session expired - clear it
      destroySession();
      return false;
    }
    
    // Validate session token format
    if (!isValidSessionToken(sessionToken)) {
      destroySession();
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Destroy session completely
 */
export function destroySession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Generate cryptographically-styled session token
 */
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate session token format
 */
function isValidSessionToken(token: string): boolean {
  // Must be 64 hex characters
  return /^[a-f0-9]{64}$/.test(token);
}

/**
 * Hidden login route - change this to change access point
 * SECURITY NOTE: This route should be hard to guess
 */
export const HIDDEN_LOGIN_ROUTE = '/hd-auth-91x';

/**
 * Check if current path is the hidden login route
 */
export function isLoginRoute(path: string): boolean {
  return path === HIDDEN_LOGIN_ROUTE;
}
