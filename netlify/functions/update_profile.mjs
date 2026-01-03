/**
 * update_profile.mjs
 * 
 * PATCH endpoint: updates a profile's stage or other fields
 * Body: { id: "profile-id", stage: "qualified", ...other fields }
 */

import { neon } from '@neondatabase/serverless';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-User-Email',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
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

  // Allow PATCH and POST
  if (event.httpMethod !== 'PATCH' && event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Get user ID from headers
    const userId = event.headers['x-user-id'] || event.headers['X-User-Id'] || 
                   event.headers['x-user-email'] || event.headers['X-User-Email'];
    
    if (!userId) {
      return errorResponse('userId is required', 400);
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { id, stage, value, probability, status, notes } = body;

    if (!id) {
      return errorResponse('id is required', 400);
    }

    // Remove 'deal-' prefix if present (deals have id like 'deal-bp-123')
    const profileId = id.replace(/^deal-/, '');

    const sql = getDb();

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    // Update stage in meta JSON
    if (stage !== undefined) {
      updates.push(`meta = jsonb_set(COALESCE(meta, '{}'), '{stage}', $${paramIndex}::jsonb)`);
      values.push(JSON.stringify(stage));
      paramIndex++;
    }

    if (value !== undefined) {
      updates.push(`meta = jsonb_set(COALESCE(meta, '{}'), '{dealValue}', $${paramIndex}::jsonb)`);
      values.push(JSON.stringify(value));
      paramIndex++;
    }

    if (probability !== undefined) {
      updates.push(`meta = jsonb_set(COALESCE(meta, '{}'), '{probability}', $${paramIndex}::jsonb)`);
      values.push(JSON.stringify(probability));
      paramIndex++;
    }

    if (status !== undefined) {
      updates.push(`meta = jsonb_set(COALESCE(meta, '{}'), '{dealStatus}', $${paramIndex}::jsonb)`);
      values.push(JSON.stringify(status));
      paramIndex++;
    }

    if (notes !== undefined) {
      updates.push(`meta = jsonb_set(COALESCE(meta, '{}'), '{notes}', $${paramIndex}::jsonb)`);
      values.push(JSON.stringify(notes));
      paramIndex++;
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    // Add updated_at
    updates.push('updated_at = NOW()');

    // Add WHERE clause parameters
    values.push(profileId);
    values.push(userId);

    const query = `
      UPDATE business_profiles 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING id, name, meta
    `;

    const result = await sql(query, values);

    if (result.length === 0) {
      return errorResponse('Profile not found or access denied', 404);
    }

    return jsonResponse({
      success: true,
      profile: result[0],
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('update_profile error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
