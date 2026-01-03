/**
 * Get Pipelines Function
 * 
 * Get the available deal pipeline stages.
 * 
 * Endpoint: GET /.netlify/functions/pipelines
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
    return errorResponse('Method not allowed. Use GET.', 405);
  }

  try {
    // Parse query params for auth
    const url = new URL(request.url);
    const body = {
      user_id: url.searchParams.get('user_id'),
      email: url.searchParams.get('email')
    };

    // Validate user
    const user = await validateUser(request, body);
    if (!user) {
      return unauthorizedResponse();
    }

    // Return static pipeline stages
    // In a more advanced system, these could be stored in the database
    const pipelines = [
      {
        id: 'default',
        name: 'Sales Pipeline',
        stages: [
          { id: 'lead', name: 'Lead', position: 1 },
          { id: 'qualified', name: 'Qualified', position: 2 },
          { id: 'proposal', name: 'Proposal', position: 3 },
          { id: 'negotiation', name: 'Negotiation', position: 4 },
          { id: 'won', name: 'Won', position: 5 },
          { id: 'lost', name: 'Lost', position: 6 }
        ]
      }
    ];

    // Get deal counts per stage for this user
    const stageCounts = await query(`
      SELECT stage, COUNT(*)::int as count, COALESCE(SUM(value), 0)::numeric as total_value
      FROM deals
      WHERE user_id = $1
      GROUP BY stage
    `, [user.id]);

    // Add counts to stages
    const pipeline = pipelines[0];
    pipeline.stages = pipeline.stages.map(stage => {
      const stats = stageCounts.find(s => s.stage === stage.id);
      return {
        ...stage,
        deal_count: stats?.count || 0,
        total_value: parseFloat(stats?.total_value) || 0
      };
    });

    return jsonResponse({
      success: true,
      pipelines
    });

  } catch (err) {
    console.error('Pipelines error:', err);
    return errorResponse(`Failed to get pipelines: ${err.message}`, 500);
  }
}

export const config = {
  path: "/pipelines"
};
