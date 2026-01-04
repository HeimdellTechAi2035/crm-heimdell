/**
 * auth_login.mjs
 * 
 * User login endpoint
 * Verifies credentials and returns JWT token
 */

import { neon } from '@neondatabase/serverless';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function jsonResponse(data, status = 200) {
  return { statusCode: status, headers: corsHeaders, body: JSON.stringify(data) };
}

function errorResponse(message, status = 400) {
  return { statusCode: status, headers: corsHeaders, body: JSON.stringify({ success: false, error: message }) };
}

// Must match the hash function in signup
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'heimdell-salt-2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a simple JWT-like token
function generateToken(userId, email) {
  const payload = {
    userId,
    email,
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const { email, password } = JSON.parse(event.body || '{}');

    if (!email || !password) {
      return errorResponse('Email and password are required');
    }

    const emailLower = email.trim().toLowerCase();

    const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
      return errorResponse('Database not configured', 500);
    }

    const sql = neon(databaseUrl);

    // Find user
    const users = await sql`
      SELECT id, email, password_hash, name 
      FROM users 
      WHERE email = ${emailLower}
    `;

    if (users.length === 0) {
      return errorResponse('Invalid email or password', 401);
    }

    const user = users[0];

    // Verify password
    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.password_hash) {
      return errorResponse('Invalid email or password', 401);
    }

    // Update last login
    await sql`UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = ${user.id}`;

    const token = generateToken(user.id, user.email);

    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    
    if (error.message?.includes('relation "users" does not exist')) {
      return errorResponse('User system not initialized', 500);
    }
    
    return errorResponse(error.message || 'Login failed', 500);
  }
}
