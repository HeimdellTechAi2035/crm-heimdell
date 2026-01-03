/**
 * list_profiles.mjs
 * 
 * GET endpoint: returns profiles from business_profiles table
 * All dependencies inlined for Netlify Functions bundling compatibility
 */

import { neon } from '@neondatabase/serverless';

// Inline CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-User-Email',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const params = event.queryStringParameters || {};
    const { userId, category, search, limit = '500' } = params;
    
    if (!userId) {
      return errorResponse('userId query parameter is required', 400);
    }
    
    const sql = getDb();
    const maxLimit = Math.min(parseInt(limit, 10) || 500, 1000);
    
    let profiles;
    
    if (category && search) {
      const searchPattern = `%${search}%`;
      profiles = await sql`
        SELECT 
          id, user_id, name, address, phone, website, map_url,
          category, reviews, rating, ranking, avg_position,
          market_share, photos_count, dedupe_key, source, 
          import_batch_id, meta, created_at, updated_at
        FROM business_profiles
        WHERE user_id = ${userId}
          AND category = ${category}
          AND (name ILIKE ${searchPattern} OR address ILIKE ${searchPattern})
        ORDER BY created_at DESC
        LIMIT ${maxLimit}
      `;
    } else if (category) {
      profiles = await sql`
        SELECT 
          id, user_id, name, address, phone, website, map_url,
          category, reviews, rating, ranking, avg_position,
          market_share, photos_count, dedupe_key, source, 
          import_batch_id, meta, created_at, updated_at
        FROM business_profiles
        WHERE user_id = ${userId} AND category = ${category}
        ORDER BY created_at DESC
        LIMIT ${maxLimit}
      `;
    } else if (search) {
      const searchPattern = `%${search}%`;
      profiles = await sql`
        SELECT 
          id, user_id, name, address, phone, website, map_url,
          category, reviews, rating, ranking, avg_position,
          market_share, photos_count, dedupe_key, source, 
          import_batch_id, meta, created_at, updated_at
        FROM business_profiles
        WHERE user_id = ${userId}
          AND (name ILIKE ${searchPattern} OR address ILIKE ${searchPattern})
        ORDER BY created_at DESC
        LIMIT ${maxLimit}
      `;
    } else {
      profiles = await sql`
        SELECT 
          id, user_id, name, address, phone, website, map_url,
          category, reviews, rating, ranking, avg_position,
          market_share, photos_count, dedupe_key, source, 
          import_batch_id, meta, created_at, updated_at
        FROM business_profiles
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${maxLimit}
      `;
    }
    
    // Transform to frontend format
    const transformedProfiles = profiles.map(p => ({
      id: p.id,
      userId: p.user_id,
      name: p.name,
      address: p.address,
      phone: p.phone,
      website: p.website,
      mapUrl: p.map_url,
      category: p.category,
      reviews: p.reviews,
      reviewCount: p.reviews,
      rating: p.rating ? parseFloat(p.rating) : null,
      ranking: p.ranking,
      avgPosition: p.avg_position ? parseFloat(p.avg_position) : null,
      averagePosition: p.avg_position ? parseFloat(p.avg_position) : null,
      marketShare: p.market_share ? parseFloat(p.market_share) : null,
      photosCount: p.photos_count,
      dedupeKey: p.dedupe_key,
      source: p.source,
      importBatchId: p.import_batch_id,
      meta: p.meta,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      profileJson: {
        businessName: p.name,
        category: p.category,
        address: p.address,
        website: p.website,
        rating: p.rating ? parseFloat(p.rating) : null,
        reviewCount: p.reviews,
        ranking: p.ranking,
        averagePosition: p.avg_position ? parseFloat(p.avg_position) : null,
        marketShare: p.market_share ? parseFloat(p.market_share) : null,
        googleMapsUrl: p.map_url,
        photosCount: p.photos_count,
      }
    }));
    
    return jsonResponse({
      profiles: transformedProfiles,
      total: transformedProfiles.length
    });
    
  } catch (error) {
    console.error('list_profiles error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
