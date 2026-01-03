/**
 * List Leads Function
 * 
 * Get all leads for a user with filtering and pagination.
 * 
 * Endpoint: GET /.netlify/functions/list_leads
 * 
 * Query params:
 * - user_id or email (required in header or query)
 * - search: search term
 * - status: filter by status
 * - company_id: filter by company
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
    const status = url.searchParams.get('status') || '';
    const companyId = url.searchParams.get('company_id') || '';
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

    // Build query - join with company to get company details
    let sql = `
      SELECT 
        l.*,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'website', c.website,
          'phone', c.phone,
          'address', c.address,
          'ranking', c.ranking,
          'market', c.market,
          'review_count', c.review_count,
          'review_rating', c.review_rating,
          'main_category', c.main_category,
          'meta', c.meta
        ) AS company
      FROM leads l
      JOIN companies c ON c.id = l.company_id
      WHERE l.user_id = $1
    `;
    const params = [user.id];
    let paramIndex = 2;

    // Add search filter (search company name)
    if (search) {
      sql += ` AND c.name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add status filter
    if (status) {
      sql += ` AND l.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Add company_id filter
    if (companyId) {
      sql += ` AND l.company_id = $${paramIndex}`;
      params.push(companyId);
      paramIndex++;
    }

    sql += ` ORDER BY l.created_at DESC`;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const leads = await query(sql, params);

    // Get total count
    let countSql = `
      SELECT COUNT(*) as count 
      FROM leads l 
      JOIN companies c ON c.id = l.company_id
      WHERE l.user_id = $1
    `;
    const countParams = [user.id];
    let countParamIndex = 2;
    
    if (search) {
      countSql += ` AND c.name ILIKE $${countParamIndex}`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }
    if (status) {
      countSql += ` AND l.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }
    if (companyId) {
      countSql += ` AND l.company_id = $${countParamIndex}`;
      countParams.push(companyId);
      countParamIndex++;
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult[0]?.count) || 0;

    return jsonResponse({
      success: true,
      leads,
      total,
      limit,
      offset,
      has_more: offset + leads.length < total
    });

  } catch (err) {
    console.error('List leads error:', err);
    return errorResponse(`Failed to list leads: ${err.message}`, 500);
  }
}

function parseInt(value) {
  const num = Number.parseInt(value, 10);
  return isNaN(num) ? 0 : num;
}

export const config = {
  path: "/list_leads"
};
