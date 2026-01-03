/**
 * Delete Entity Function
 * 
 * Delete a company, lead, or deal by ID.
 * Deleting a company cascades to delete all its leads and deals.
 * 
 * Endpoint: POST /.netlify/functions/delete
 * 
 * Body:
 * {
 *   "user_id": "uuid" OR "email": "user@example.com",
 *   "type": "company|lead|deal",
 *   "id": "uuid"
 * }
 */

import { query, queryOne } from './lib/db.mjs';
import { validateUser, unauthorizedResponse } from './lib/auth.mjs';
import { jsonResponse, errorResponse, handleOptions, parseBody } from './lib/response.mjs';

export default async function handler(request, context) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  // Only accept POST or DELETE
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return errorResponse('Method not allowed. Use POST or DELETE.', 405);
  }

  try {
    const body = await parseBody(request);

    // Validate user
    const user = await validateUser(request, body);
    if (!user) {
      return unauthorizedResponse();
    }

    const { type, id } = body;

    if (!type || !['company', 'lead', 'deal'].includes(type)) {
      return errorResponse('type must be one of: company, lead, deal');
    }

    if (!id) {
      return errorResponse('id is required');
    }

    let result;
    let deleted = { companies: 0, leads: 0, deals: 0 };

    switch (type) {
      case 'company':
        // Verify company exists and belongs to user
        const company = await queryOne(
          'SELECT id FROM companies WHERE id = $1 AND user_id = $2',
          [id, user.id]
        );
        if (!company) {
          return errorResponse('Company not found or access denied', 404);
        }

        // Count related records before deletion (for reporting)
        const leadsCount = await queryOne(
          'SELECT COUNT(*)::int as count FROM leads WHERE company_id = $1',
          [id]
        );
        const dealsCount = await queryOne(
          'SELECT COUNT(*)::int as count FROM deals WHERE company_id = $1',
          [id]
        );

        // Delete company (cascades to leads and deals due to FK constraints)
        await query('DELETE FROM companies WHERE id = $1 AND user_id = $2', [id, user.id]);
        
        deleted.companies = 1;
        deleted.leads = leadsCount?.count || 0;
        deleted.deals = dealsCount?.count || 0;
        break;

      case 'lead':
        // Verify lead exists and belongs to user
        const lead = await queryOne(
          'SELECT id, company_id FROM leads WHERE id = $1 AND user_id = $2',
          [id, user.id]
        );
        if (!lead) {
          return errorResponse('Lead not found or access denied', 404);
        }

        // Update any deals that reference this lead
        await query(
          'UPDATE deals SET lead_id = NULL WHERE lead_id = $1',
          [id]
        );

        // Delete the lead
        await query('DELETE FROM leads WHERE id = $1 AND user_id = $2', [id, user.id]);
        deleted.leads = 1;
        break;

      case 'deal':
        // Verify deal exists and belongs to user
        const deal = await queryOne(
          'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
          [id, user.id]
        );
        if (!deal) {
          return errorResponse('Deal not found or access denied', 404);
        }

        // Delete the deal
        await query('DELETE FROM deals WHERE id = $1 AND user_id = $2', [id, user.id]);
        deleted.deals = 1;
        break;
    }

    return jsonResponse({
      success: true,
      deleted
    });

  } catch (err) {
    console.error('Delete error:', err);
    return errorResponse(`Failed to delete: ${err.message}`, 500);
  }
}

export const config = {
  path: "/delete"
};
