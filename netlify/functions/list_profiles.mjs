/**
 * list_profiles.mjs
 * 
 * GET endpoint: returns profiles from business_profiles table
 * Supports optional query params:
 *   - category: filter by category
 *   - search: matches name/address
 *   - userId: required for user-scoped data
 * Returns JSON array of profiles
 */

import { getDb } from './lib/db.mjs';
import { jsonResponse, errorResponse } from './lib/response.mjs';

export async function handler(event) {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    const params = event.queryStringParameters || {};
    const { userId, category, search, limit = '500' } = params;
    
    if (!userId) {
      return errorResponse(400, 'userId query parameter is required');
    }
    
    const sql = getDb();
    const maxLimit = Math.min(parseInt(limit, 10) || 500, 1000);
    
    let profiles;
    
    if (category && search) {
      // Filter by both category and search
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
          AND (
            name ILIKE ${searchPattern}
            OR address ILIKE ${searchPattern}
          )
        ORDER BY created_at DESC
        LIMIT ${maxLimit}
      `;
    } else if (category) {
      // Filter by category only
      profiles = await sql`
        SELECT 
          id, user_id, name, address, phone, website, map_url,
          category, reviews, rating, ranking, avg_position,
          market_share, photos_count, dedupe_key, source, 
          import_batch_id, meta, created_at, updated_at
        FROM business_profiles
        WHERE user_id = ${userId}
          AND category = ${category}
        ORDER BY created_at DESC
        LIMIT ${maxLimit}
      `;
    } else if (search) {
      // Filter by search only
      const searchPattern = `%${search}%`;
      profiles = await sql`
        SELECT 
          id, user_id, name, address, phone, website, map_url,
          category, reviews, rating, ranking, avg_position,
          market_share, photos_count, dedupe_key, source, 
          import_batch_id, meta, created_at, updated_at
        FROM business_profiles
        WHERE user_id = ${userId}
          AND (
            name ILIKE ${searchPattern}
            OR address ILIKE ${searchPattern}
          )
        ORDER BY created_at DESC
        LIMIT ${maxLimit}
      `;
    } else {
      // Return all profiles for user
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
    
    // Transform to frontend format (camelCase, consistent with UI expectations)
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
      reviewCount: p.reviews, // Alias for backwards compatibility
      rating: p.rating ? parseFloat(p.rating) : null,
      ranking: p.ranking,
      avgPosition: p.avg_position ? parseFloat(p.avg_position) : null,
      averagePosition: p.avg_position ? parseFloat(p.avg_position) : null, // Alias
      marketShare: p.market_share ? parseFloat(p.market_share) : null,
      photosCount: p.photos_count,
      dedupeKey: p.dedupe_key,
      source: p.source,
      importBatchId: p.import_batch_id,
      meta: p.meta,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      // Build profileJson for UI compatibility
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
    return errorResponse(500, error.message || 'Internal server error');
  }
}
