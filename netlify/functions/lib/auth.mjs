/**
 * Authentication validation module
 * 
 * PLACEHOLDER: This module provides a validateUser function that should be
 * replaced with your actual authentication logic (e.g., JWT verification,
 * session validation, Supabase auth, etc.)
 * 
 * For now, it extracts user_id from the request body or headers.
 * In production, you should verify the user's identity via a secure token.
 */

import { query, queryOne } from './db.mjs';

/**
 * Validate user from request and return user object
 * 
 * PLACEHOLDER IMPLEMENTATION:
 * - In development: accepts user_id from body/headers and creates user if needed
 * - In production: should verify JWT/session token and extract user from it
 * 
 * @param {Request} request - The incoming request
 * @param {Object} body - Parsed request body (if available)
 * @returns {Promise<{id: string, email: string} | null>} User object or null
 */
export async function validateUser(request, body = null) {
  // Try to get user_id from various sources
  let userId = null;
  let userEmail = null;

  // 1. Check body for user_id
  if (body?.user_id) {
    userId = body.user_id;
  }

  // 2. Check body for email
  if (body?.email) {
    userEmail = body.email;
  }

  // 3. Check Authorization header for user_id (simple token format)
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    // Support "Bearer <user_id>" or "Bearer <email>" format for dev
    const token = authHeader.replace('Bearer ', '').trim();
    if (token.includes('@')) {
      userEmail = token;
    } else if (token && token !== 'local-token') {
      userId = token;
    }
  }

  // 4. Check X-User-Id header
  const userIdHeader = request.headers.get('X-User-Id');
  if (userIdHeader) {
    userId = userIdHeader;
  }

  // 5. Check X-User-Email header
  const userEmailHeader = request.headers.get('X-User-Email');
  if (userEmailHeader) {
    userEmail = userEmailHeader;
  }

  // If we have userId, look up the user
  if (userId) {
    const user = await queryOne(
      'SELECT id, email FROM users WHERE id = $1',
      [userId]
    );
    if (user) {
      return user;
    }
  }

  // If we have email, find or create user
  if (userEmail) {
    // Try to find existing user
    let user = await queryOne(
      'SELECT id, email FROM users WHERE email = $1',
      [userEmail]
    );

    // Create user if not found (dev convenience)
    if (!user) {
      const result = await query(
        'INSERT INTO users (email) VALUES ($1) RETURNING id, email',
        [userEmail]
      );
      user = result[0];
    }

    return user;
  }

  // No valid authentication found
  return null;
}

/**
 * Create a standard error response for unauthorized requests
 */
export function unauthorizedResponse(message = 'Unauthorized: user_id or email required') {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: message,
      hint: 'Provide user_id in body, Authorization header, X-User-Id header, or email in body/X-User-Email header'
    }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

export default { validateUser, unauthorizedResponse };
