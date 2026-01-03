/**
 * List Deals Function
 * 
 * Get all deals for a user with filtering and pagination.
 * 
 * Endpoint: GET /.netlify/functions/list_deals
 * 
 * Query params:
 * - user_id or email (required in header or query)
 * - search: search term
 * - stage: filter by stage
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
    const stage = url.searchParams.get('stage') || '';
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
        d.*,
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
        ) AS company,
        CASE WHEN l.id IS NOT NULL THEN
          json_build_object(
            'id', l.id,
            'status', l.status,
            'source', l.source
          )
        ELSE NULL END AS lead
      FROM deals d
      JOIN companies c ON c.id = d.company_id
      LEFT JOIN leads l ON l.id = d.lead_id
      WHERE d.user_id = $1
    `;
    const params = [user.id];
    let paramIndex = 2;

    // Add search filter (search company name or deal title)
    if (search) {
      sql += ` AND (c.name ILIKE $${paramIndex} OR d.title ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add stage filter
    if (stage) {
      sql += ` AND d.stage = $${paramIndex}`;
      params.push(stage);
      paramIndex++;
    }

    // Add company_id filter
    if (companyId) {
      sql += ` AND d.company_id = $${paramIndex}`;
      params.push(companyId);
      paramIndex++;
    }

    sql += ` ORDER BY d.created_at DESC`;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const deals = await query(sql, params);

    // Get total count and value by stage
    let countSql = `
      SELECT COUNT(*) as count 
      FROM deals d 
      JOIN companies c ON c.id = d.company_id
      WHERE d.user_id = $1
    `;
    const countParams = [user.id];
    let countParamIndex = 2;
    
    if (search) {
      countSql += ` AND (c.name ILIKE $${countParamIndex} OR d.title ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }
    if (stage) {
      countSql += ` AND d.stage = $${countParamIndex}`;
      countParams.push(stage);
      countParamIndex++;
    }
    if (companyId) {
      countSql += ` AND d.company_id = $${countParamIndex}`;
      countParams.push(companyId);
      countParamIndex++;
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult[0]?.count) || 0;

    // Get pipeline summary (count and value by stage)
    const pipelineSql = `
      SELECT 
        stage,
        COUNT(*)::int AS count,
        COALESCE(SUM(value), 0)::numeric AS total_value
      FROM deals
      WHERE user_id = $1
      GROUP BY stage
    `;
    const pipelineStats = await query(pipelineSql, [user.id]);

    return jsonResponse({
      success: true,
      deals,
      total,
      limit,
      offset,
      has_more: offset + deals.length < total,
      pipeline: pipelineStats
    });

  } catch (err) {
    console.error('List deals error:', err);
    return errorResponse(`Failed to list deals: ${err.message}`, 500);
  }
}

function parseInt(value) {
  const num = Number.parseInt(value, 10);
  return isNaN(num) ? 0 : num;
}

export const config = {
  path: "/list_deals"
};
