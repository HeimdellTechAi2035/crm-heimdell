/**
 * auth_signup.mjs
 * 
 * User registration endpoint
 * Creates a new user with hashed password
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

// Simple hash function (for demo - use bcrypt in production)
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

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const { email, password, name } = JSON.parse(event.body || '{}');

    if (!email || !password) {
      return errorResponse('Email and password are required');
    }

    if (password.length < 6) {
      return errorResponse('Password must be at least 6 characters');
    }

    const emailLower = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      return errorResponse('Invalid email format');
    }

    const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
      return errorResponse('Database not configured', 500);
    }

    const sql = neon(databaseUrl);

    // Check if user already exists
    const existing = await sql`SELECT id FROM users WHERE email = ${emailLower}`;
    if (existing.length > 0) {
      return errorResponse('An account with this email already exists');
    }

    // Create user
    const userId = generateUUID();
    const passwordHash = await hashPassword(password);
    const displayName = name || emailLower.split('@')[0];

    await sql`
      INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
      VALUES (${userId}, ${emailLower}, ${passwordHash}, ${displayName}, NOW(), NOW())
    `;

    const token = generateToken(userId, emailLower);

    return jsonResponse({
      success: true,
      user: {
        id: userId,
        email: emailLower,
        name: displayName
      },
      token
    });

  } catch (error) {
    console.error('Signup error:', error);
    
    // Check if it's a table doesn't exist error
    if (error.message?.includes('relation "users" does not exist')) {
      return errorResponse('User system not initialized. Please run database setup.', 500);
    }
    
    return errorResponse(error.message || 'Signup failed', 500);
  }
}
