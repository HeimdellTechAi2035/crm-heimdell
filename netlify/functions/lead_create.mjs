/**
 * Lead Create Function
 * 
 * Create a new lead linked to a company.
 * 
 * Endpoint: POST /.netlify/functions/lead_create
 * 
 * Body:
 * {
 *   "user_id": "uuid" OR "email": "user@example.com",
 *   "company_id": "uuid",
 *   "status": "new|contacted|qualified|converted|lost",
 *   "source": "csv_import|manual|api|...",
 *   "meta": {} // optional extra fields
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

    const { company_id, status = 'new', source = 'manual', meta = {} } = body;

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

    // Validate status
    const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
    const finalStatus = validStatuses.includes(status) ? status : 'new';

    // Create lead
    const result = await query(
      `INSERT INTO leads (user_id, company_id, status, source, meta)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user.id, company_id, finalStatus, source, JSON.stringify(meta)]
    );

    const lead = result[0];

    return jsonResponse({
      success: true,
      lead: {
        ...lead,
        company
      }
    }, 201);

  } catch (err) {
    console.error('Lead create error:', err);
    return errorResponse(`Failed to create lead: ${err.message}`, 500);
  }
}

export const config = {
  path: "/lead_create"
};
