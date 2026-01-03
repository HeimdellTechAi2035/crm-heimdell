/**
 * delete_all_profiles.mjs
 * 
 * POST endpoint: deletes all records for a user (admin/debug only)
 * Protected with ADMIN_KEY env var
 * All dependencies inlined for Netlify Functions bundling compatibility
 */

import { neon } from '@neondatabase/serverless';

// Inline CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-User-Email, X-Admin-Key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

function jsonResponse(data, status = 200) {
  return {
    statusCode: status,
    headers: corsHeaders,
    body: JSON.stringify(data)
  };
}

function errorResponse(message, status = 400) {
  return {
    statusCode: status,
    headers: corsHeaders,
    body: JSON.stringify({ success: false, error: message })
  };
}

function getDb() {
  const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(databaseUrl);
}

export async function handler(event) {
  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Check admin key
    const adminKey = process.env.ADMIN_KEY;
    const providedKey = event.headers['x-admin-key'] || event.headers['X-Admin-Key'];
    
    if (!adminKey) {
      return errorResponse('ADMIN_KEY not configured on server', 500);
    }
    
    if (!providedKey || providedKey !== adminKey) {
      return errorResponse('Unauthorized: Invalid or missing x-admin-key header', 401);
    }
    
    // Parse body
    const body = JSON.parse(event.body || '{}');
    const { userId, confirmDelete } = body;
    
    if (!userId) {
      return errorResponse('userId is required', 400);
    }
    
    if (confirmDelete !== true) {
      return errorResponse('confirmDelete must be true to proceed', 400);
    }
    
    const sql = getDb();
    
    // Delete all profiles for this user
    const deleteResult = await sql`
      DELETE FROM business_profiles
      WHERE user_id = ${userId}
      RETURNING id
    `;
    
    const deletedCount = deleteResult.length;
    
    return jsonResponse({
      success: true,
      deleted: deletedCount,
      message: `Deleted ${deletedCount} profiles for user ${userId}`
    });
    
  } catch (error) {
    console.error('delete_all_profiles error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
