/**
 * List Companies Function
 * 
 * Get all companies for a user with filtering and pagination.
 * 
 * Endpoint: GET /.netlify/functions/list_companies
 * 
 * Query params:
 * - user_id or email (required in header or query)
 * - search: search term for name
 * - category: filter by main_category
 * - limit: max results (default 100)
 * - offset: pagination offset
 */

import { query } from './lib/db.mjs';
import { validateUser, unauthorizedResponse } from './lib/auth.mjs';
import { jsonResponse, errorResponse, handleOptions } from './lib/response.mjs';

export default async function handler(request, context) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  // Accept GET or POST
  if (request.method !== 'GET' && request.method !== 'POST') {
    return errorResponse('Method not allowed. Use GET or POST.', 405);
  }

  try {
    // Parse query params
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const category = url.searchParams.get('category') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 100, 1000);
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    // Build body from query params for auth
    const body = {
      user_id: url.searchParams.get('user_id'),
      email: url.searchParams.get('email')
    };

    // Validate user
    const user = await validateUser(request, body);
    if (!user) {
      return unauthorizedResponse();
    }

    // Build query
    let sql = `
      SELECT 
        c.*,
        COUNT(DISTINCT l.id)::int AS lead_count,
        COUNT(DISTINCT d.id)::int AS deal_count,
        COALESCE(SUM(d.value), 0)::numeric AS total_deal_value
      FROM companies c
      LEFT JOIN leads l ON l.company_id = c.id
      LEFT JOIN deals d ON d.company_id = c.id
      WHERE c.user_id = $1
    `;
    const params = [user.id];
    let paramIndex = 2;

    // Add search filter
    if (search) {
      sql += ` AND (c.name ILIKE $${paramIndex} OR c.address ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add category filter
    if (category) {
      sql += ` AND c.main_category ILIKE $${paramIndex}`;
      params.push(`%${category}%`);
      paramIndex++;
    }

    sql += ` GROUP BY c.id ORDER BY c.created_at DESC`;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const companies = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as count FROM companies WHERE user_id = $1';
    const countParams = [user.id];
    
    if (search) {
      countSql += ' AND (name ILIKE $2 OR address ILIKE $2)';
      countParams.push(`%${search}%`);
    }
    if (category) {
      const catParam = countParams.length + 1;
      countSql += ` AND main_category ILIKE $${catParam}`;
      countParams.push(`%${category}%`);
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult[0]?.count) || 0;

    return jsonResponse({
      success: true,
      companies,
      total,
      limit,
      offset,
      has_more: offset + companies.length < total
    });

  } catch (err) {
    console.error('List companies error:', err);
    return errorResponse(`Failed to list companies: ${err.message}`, 500);
  }
}

function parseInt(value) {
  const num = Number.parseInt(value, 10);
  return isNaN(num) ? 0 : num;
}

export const config = {
  path: "/list_companies"
};
