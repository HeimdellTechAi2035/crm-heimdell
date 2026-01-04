/**
 * migrate_user_data.mjs
 * 
 * Migrates profiles from one user to another
 */

import { neon } from '@neondatabase/serverless';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    const { fromUserId, toUserId } = JSON.parse(event.body || '{}');

    if (!fromUserId || !toUserId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'fromUserId and toUserId required' })
      };
    }

    const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
    const sql = neon(databaseUrl);

    // Update profiles
    const result = await sql`
      UPDATE business_profiles 
      SET user_id = ${toUserId}, updated_at = NOW()
      WHERE user_id = ${fromUserId}
    `;

    // Count updated
    const count = await sql`
      SELECT COUNT(*) as count FROM business_profiles WHERE user_id = ${toUserId}
    `;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: `Migrated profiles from ${fromUserId} to ${toUserId}`,
        profileCount: parseInt(count[0]?.count || '0')
      })
    };

  } catch (error) {
    console.error('Migration error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}
