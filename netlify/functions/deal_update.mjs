/**
 * Update Deal Function
 * 
 * Update an existing deal (stage, value, etc.)
 * 
 * Endpoint: POST /.netlify/functions/deal_update
 * 
 * Body:
 * {
 *   "user_id": "uuid" OR "email": "user@example.com",
 *   "deal_id": "uuid",
 *   "stage": "lead|qualified|proposal|negotiation|won|lost",
 *   "value": 1000,
 *   "probability": 50,
 *   "title": "New title",
 *   "expected_close_date": "2024-01-01",
 *   "meta": {} // optional extra fields
 * }
 */

import { query, queryOne } from './lib/db.mjs';
import { validateUser, unauthorizedResponse } from './lib/auth.mjs';
import { jsonResponse, errorResponse, handleOptions, parseBody } from './lib/response.mjs';
import { parseNumeric } from './lib/csv-parser.mjs';

export default async function handler(request, context) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  // Only accept POST or PATCH
  if (request.method !== 'POST' && request.method !== 'PATCH' && request.method !== 'PUT') {
    return errorResponse('Method not allowed. Use POST, PATCH, or PUT.', 405);
  }

  try {
    const body = await parseBody(request);

    // Validate user
    const user = await validateUser(request, body);
    if (!user) {
      return unauthorizedResponse();
    }

    const { deal_id, id, stage, value, probability, title, expected_close_date, meta } = body;
    const dealId = deal_id || id;

    // Validate deal_id
    if (!dealId) {
      return errorResponse('deal_id is required');
    }

    // Verify deal exists and belongs to user
    const existingDeal = await queryOne(
      'SELECT * FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, user.id]
    );

    if (!existingDeal) {
      return errorResponse('Deal not found or access denied', 404);
    }

    // Build update query dynamically
    const updates = [];
    const params = [dealId, user.id];
    let paramIndex = 3;

    if (stage !== undefined) {
      const validStages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
      if (validStages.includes(stage)) {
        updates.push(`stage = $${paramIndex}`);
        params.push(stage);
        paramIndex++;
      }
    }

    if (value !== undefined) {
      updates.push(`value = $${paramIndex}`);
      params.push(parseNumeric(value));
      paramIndex++;
    }

    if (probability !== undefined) {
      updates.push(`probability = $${paramIndex}`);
      params.push(parseNumeric(probability));
      paramIndex++;
    }

    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(title);
      paramIndex++;
    }

    if (expected_close_date !== undefined) {
      let closeDate = null;
      if (expected_close_date) {
        const parsed = new Date(expected_close_date);
        if (!isNaN(parsed.getTime())) {
          closeDate = parsed.toISOString().split('T')[0];
        }
      }
      updates.push(`expected_close_date = $${paramIndex}`);
      params.push(closeDate);
      paramIndex++;
    }

    if (meta !== undefined) {
      updates.push(`meta = meta || $${paramIndex}`);
      params.push(JSON.stringify(meta));
      paramIndex++;
    }

    if (updates.length === 0) {
      return errorResponse('No valid fields to update');
    }

    // Execute update
    const sql = `
      UPDATE deals
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await query(sql, params);
    const deal = result[0];

    // Get company info
    const company = await queryOne(
      'SELECT id, name, website, phone, address FROM companies WHERE id = $1',
      [deal.company_id]
    );

    return jsonResponse({
      success: true,
      deal: {
        ...deal,
        company
      }
    });

  } catch (err) {
    console.error('Deal update error:', err);
    return errorResponse(`Failed to update deal: ${err.message}`, 500);
  }
}

export const config = {
  path: "/deal_update"
};
