/**
 * Deal Create Function
 * 
 * Create a new deal linked to a company and optionally a lead.
 * 
 * Endpoint: POST /.netlify/functions/deal_create
 * 
 * Body:
 * {
 *   "user_id": "uuid" OR "email": "user@example.com",
 *   "company_id": "uuid",
 *   "lead_id": "uuid" (optional),
 *   "title": "Deal title",
 *   "stage": "lead|qualified|proposal|negotiation|won|lost",
 *   "value": 1000,
 *   "probability": 50,
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

  // Only accept POST
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', 405);
  }

  try {
    const body = await parseBody(request);

    // Validate user
    const user = await validateUser(request, body);
    if (!user) {
      return unauthorizedResponse();
    }

    const { 
      company_id, 
      lead_id, 
      title, 
      stage = 'lead', 
      value, 
      probability,
      expected_close_date,
      meta = {} 
    } = body;

    // Validate company_id
    if (!company_id) {
      return errorResponse('company_id is required');
    }

    // Verify company exists and belongs to user
    const company = await queryOne(
      'SELECT id, name FROM companies WHERE id = $1 AND user_id = $2',
      [company_id, user.id]
    );

    if (!company) {
      return errorResponse('Company not found or access denied', 404);
    }

    // If lead_id provided, verify it exists and belongs to user
    let lead = null;
    if (lead_id) {
      lead = await queryOne(
        'SELECT id FROM leads WHERE id = $1 AND user_id = $2',
        [lead_id, user.id]
      );
      if (!lead) {
        return errorResponse('Lead not found or access denied', 404);
      }
    }

    // Validate stage
    const validStages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
    const finalStage = validStages.includes(stage) ? stage : 'lead';

    // Parse numeric values
    const dealValue = parseNumeric(value);
    const dealProbability = parseNumeric(probability);

    // Parse expected close date
    let closeDate = null;
    if (expected_close_date) {
      const parsed = new Date(expected_close_date);
      if (!isNaN(parsed.getTime())) {
        closeDate = parsed.toISOString().split('T')[0];
      }
    }

    // Use company name as title if not provided
    const dealTitle = title || company.name;

    // Create deal
    const result = await query(
      `INSERT INTO deals (user_id, company_id, lead_id, title, stage, value, probability, expected_close_date, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        user.id,
        company_id,
        lead_id || null,
        dealTitle,
        finalStage,
        dealValue,
        dealProbability,
        closeDate,
        JSON.stringify(meta)
      ]
    );

    const deal = result[0];

    return jsonResponse({
      success: true,
      deal: {
        ...deal,
        company
      }
    }, 201);

  } catch (err) {
    console.error('Deal create error:', err);
    return errorResponse(`Failed to create deal: ${err.message}`, 500);
  }
}

export const config = {
  path: "/deal_create"
};
