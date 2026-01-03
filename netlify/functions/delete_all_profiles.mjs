/**
 * delete_all_profiles.mjs
 * 
 * POST endpoint: deletes all records for a user (admin/debug only)
 * Protected with ADMIN_KEY env var
 * Requires header: x-admin-key
 */

import { getDb } from './lib/db.mjs';
import { jsonResponse, errorResponse } from './lib/response.mjs';

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    // Check admin key
    const adminKey = process.env.ADMIN_KEY;
    const providedKey = event.headers['x-admin-key'] || event.headers['X-Admin-Key'];
    
    if (!adminKey) {
      return errorResponse(500, 'ADMIN_KEY not configured on server');
    }
    
    if (!providedKey || providedKey !== adminKey) {
      return errorResponse(401, 'Unauthorized: Invalid or missing x-admin-key header');
    }
    
    // Parse body
    const body = JSON.parse(event.body || '{}');
    const { userId, confirmDelete } = body;
    
    if (!userId) {
      return errorResponse(400, 'userId is required');
    }
    
    if (confirmDelete !== true) {
      return errorResponse(400, 'confirmDelete must be true to proceed');
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
    return errorResponse(500, error.message || 'Internal server error');
  }
}
