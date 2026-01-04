/**
 * manage_pipelines.mjs
 * 
 * GET: List all pipelines for a user
 * POST: Create a new pipeline
 * DELETE: Delete a pipeline (with pipeline_id in body)
 */

import { neon } from '@neondatabase/serverless';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-User-Email',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

function jsonResponse(data, status = 200) {
  return {
    statusCode: status,
    headers: corsHeaders,
    body: JSON.stringify(data)
  };
}

function errorResponse(message, status = 400) {
  return {
    statusCode: status,
    headers: corsHeaders,
    body: JSON.stringify({ success: false, error: message })
  };
}

function getDb() {
  const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(databaseUrl);
}

export async function handler(event) {
  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const userId = event.headers['x-user-id'] || event.headers['X-User-Id'];
  
  if (!userId) {
    return errorResponse('userId is required', 401);
  }

  const sql = getDb();

  try {
    // Ensure pipelines table exists
    await sql`
      CREATE TABLE IF NOT EXISTS pipelines (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#06b6d4',
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Add pipeline_id column to business_profiles if it doesn't exist
    await sql`
      ALTER TABLE business_profiles 
      ADD COLUMN IF NOT EXISTS pipeline_id TEXT DEFAULT 'default'
    `;

    if (event.httpMethod === 'GET') {
      // List all pipelines for user
      const pipelines = await sql`
        SELECT p.*, 
               COUNT(bp.id)::int as profile_count,
               COALESCE(SUM((bp.meta->>'dealValue')::numeric), 0)::numeric as total_value
        FROM pipelines p
        LEFT JOIN business_profiles bp ON bp.pipeline_id = p.id AND bp.user_id = p.user_id
        WHERE p.user_id = ${userId}
        GROUP BY p.id
        ORDER BY p.created_at ASC
      `;

      // Always include a default pipeline
      const hasDefault = pipelines.some(p => p.id === 'default');
      if (!hasDefault) {
        // Create default pipeline
        await sql`
          INSERT INTO pipelines (id, user_id, name, color, description)
          VALUES ('default', ${userId}, 'Main Pipeline', '#06b6d4', 'Default sales pipeline')
          ON CONFLICT (id) DO NOTHING
        `;
        
        // Get count for default
        const defaultCount = await sql`
          SELECT COUNT(*)::int as count, COALESCE(SUM((meta->>'dealValue')::numeric), 0)::numeric as total_value
          FROM business_profiles 
          WHERE user_id = ${userId} AND (pipeline_id = 'default' OR pipeline_id IS NULL)
        `;
        
        pipelines.unshift({
          id: 'default',
          user_id: userId,
          name: 'Main Pipeline',
          color: '#06b6d4',
          description: 'Default sales pipeline',
          profile_count: defaultCount[0]?.count || 0,
          total_value: parseFloat(defaultCount[0]?.total_value) || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // Add stages to each pipeline
      const pipelinesWithStages = pipelines.map(p => ({
        ...p,
        stages: [
          { id: 'lead', name: 'Lead', position: 1 },
          { id: 'qualified', name: 'Qualified', position: 2 },
          { id: 'negotiation', name: 'Negotiation', position: 3 },
          { id: 'closed', name: 'Closed', position: 4 },
          { id: 'lost', name: 'Lost', position: 5 }
        ]
      }));

      return jsonResponse({
        success: true,
        pipelines: pipelinesWithStages
      });
    }

    if (event.httpMethod === 'POST') {
      // Create a new pipeline
      const body = JSON.parse(event.body || '{}');
      const { name, color, description } = body;

      if (!name || !name.trim()) {
        return errorResponse('Pipeline name is required');
      }

      const pipelineId = `pipeline-${Date.now()}`;
      
      await sql`
        INSERT INTO pipelines (id, user_id, name, color, description)
        VALUES (${pipelineId}, ${userId}, ${name.trim()}, ${color || '#06b6d4'}, ${description || null})
      `;

      return jsonResponse({
        success: true,
        pipeline: {
          id: pipelineId,
          user_id: userId,
          name: name.trim(),
          color: color || '#06b6d4',
          description: description || null,
          profile_count: 0,
          total_value: 0,
          stages: [
            { id: 'lead', name: 'Lead', position: 1 },
            { id: 'qualified', name: 'Qualified', position: 2 },
            { id: 'negotiation', name: 'Negotiation', position: 3 },
            { id: 'closed', name: 'Closed', position: 4 }
          ]
        }
      });
    }

    if (event.httpMethod === 'DELETE') {
      const body = JSON.parse(event.body || '{}');
      const { pipeline_id } = body;

      if (!pipeline_id) {
        return errorResponse('pipeline_id is required');
      }

      if (pipeline_id === 'default') {
        return errorResponse('Cannot delete the default pipeline');
      }

      // Move all profiles to default pipeline before deleting
      await sql`
        UPDATE business_profiles 
        SET pipeline_id = 'default', updated_at = NOW()
        WHERE user_id = ${userId} AND pipeline_id = ${pipeline_id}
      `;

      // Delete the pipeline
      await sql`
        DELETE FROM pipelines 
        WHERE id = ${pipeline_id} AND user_id = ${userId}
      `;

      return jsonResponse({
        success: true,
        message: 'Pipeline deleted. All profiles moved to default pipeline.'
      });
    }

    return errorResponse('Method not allowed', 405);

  } catch (error) {
    console.error('manage_pipelines error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
