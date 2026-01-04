/**
 * bulk_update_values.mjs
 * 
 * POST endpoint: updates all profiles with a specified deal value
 * Body: { value: 750 } or { value: 750, stage: "lead" } to filter by stage
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

  if (event.httpMethod !== 'POST') {
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
    const { value, stage } = body;

    if (value === undefined || value === null) {
      return errorResponse('value is required', 400);
    }

    const sql = getDb();

    let query;
    let values;

    if (stage) {
      // Update only profiles with specific stage
      query = `
        UPDATE business_profiles 
        SET meta = COALESCE(meta, '{}') || $1::jsonb,
            updated_at = NOW()
        WHERE user_id = $2 
          AND (meta->>'stage' = $3 OR ($3 = 'lead' AND (meta->>'stage' IS NULL OR meta->>'stage' = 'lead')))
        RETURNING id
      `;
      values = [JSON.stringify({ dealValue: value }), userId, stage];
    } else {
      // Update ALL profiles for this user
      query = `
        UPDATE business_profiles 
        SET meta = COALESCE(meta, '{}') || $1::jsonb,
            updated_at = NOW()
        WHERE user_id = $2
        RETURNING id
      `;
      values = [JSON.stringify({ dealValue: value }), userId];
    }

    const result = await sql(query, values);

    return jsonResponse({
      success: true,
      updatedCount: result.length,
      message: `Updated ${result.length} profiles with value £${value}`
    });

  } catch (error) {
    console.error('bulk_update_values error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
