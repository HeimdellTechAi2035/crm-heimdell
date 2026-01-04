/**
 * auth_me.mjs
 * 
 * Get current user from token
 */

import { neon } from '@neondatabase/serverless';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

function jsonResponse(data, status = 200) {
  return { statusCode: status, headers: corsHeaders, body: JSON.stringify(data) };
}

function errorResponse(message, status = 400) {
  return { statusCode: status, headers: corsHeaders, body: JSON.stringify({ success: false, error: message }) };
}

function parseToken(authHeader) {
  if (!authHeader) return null;
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Check expiration
    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const payload = parseToken(authHeader);

    if (!payload) {
      return errorResponse('Invalid or expired token', 401);
    }

    const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
      return errorResponse('Database not configured', 500);
    }

    const sql = neon(databaseUrl);

    const users = await sql`
      SELECT id, email, name, created_at 
      FROM users 
      WHERE id = ${payload.userId}
    `;

    if (users.length === 0) {
      return errorResponse('User not found', 404);
    }

    const user = users[0];

    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Auth me error:', error);
    return errorResponse(error.message || 'Failed to get user', 500);
  }
}
