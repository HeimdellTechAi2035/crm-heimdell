/**
 * import_profiles.mjs
 * 
 * POST endpoint: accepts { profiles: [ ...profile objects... ] }
 * Upserts profiles into business_profiles table with deduplication
 * Returns summary: { total, inserted, updated, skipped, errors: [{index, reason}] }
 */

import { getDb } from './lib/db.mjs';
import { jsonResponse, errorResponse } from './lib/response.mjs';

// Validate a single profile
function validateProfile(profile, index) {
  const errors = [];
  
  if (!profile.name || typeof profile.name !== 'string' || !profile.name.trim()) {
    errors.push(`Profile at index ${index}: name is required`);
  }
  
  if (!profile.dedupeKey || typeof profile.dedupeKey !== 'string') {
    errors.push(`Profile at index ${index}: dedupeKey is required`);
  }
  
  return errors;
}

// Sanitize numeric values
function toNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

function toInt(val) {
  if (val === null || val === undefined || val === '') return 0;
  const num = parseInt(val, 10);
  return isNaN(num) ? 0 : num;
}

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    // Parse body
    const body = JSON.parse(event.body || '{}');
    const { profiles, userId } = body;
    
    if (!userId) {
      return errorResponse(400, 'userId is required');
    }
    
    if (!profiles || !Array.isArray(profiles)) {
      return errorResponse(400, 'profiles array is required');
    }
    
    if (profiles.length === 0) {
      return jsonResponse({
        success: true,
        total: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: []
      });
    }
    
    const sql = getDb();
    const result = {
      success: true,
      total: profiles.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };
    
    // Process each profile
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      
      // Validate
      const validationErrors = validateProfile(profile, i);
      if (validationErrors.length > 0) {
        result.errors.push({ index: i, reason: validationErrors.join('; ') });
        result.skipped++;
        continue;
      }
      
      try {
        // Upsert: INSERT ON CONFLICT UPDATE
        // Never overwrite existing non-null values with null
        const upsertResult = await sql`
          INSERT INTO business_profiles (
            id, user_id, name, address, phone, website, map_url,
            category, reviews, rating, ranking, avg_position,
            market_share, photos_count, dedupe_key, source, import_batch_id, meta
          ) VALUES (
            ${profile.id || `bp-${Date.now()}-${i}`},
            ${userId},
            ${profile.name},
            ${profile.address || null},
            ${profile.phone || null},
            ${profile.website || null},
            ${profile.mapUrl || profile.googleMapsUrl || null},
            ${profile.category || null},
            ${toInt(profile.reviews || profile.reviewCount)},
            ${toNumber(profile.rating)},
            ${profile.ranking || null},
            ${toNumber(profile.avgPosition || profile.averagePosition)},
            ${toNumber(profile.marketShare)},
            ${toInt(profile.photosCount)},
            ${profile.dedupeKey},
            ${profile.source || 'csv_import'},
            ${profile.importBatchId || null},
            ${JSON.stringify(profile.meta || profile.rawData || {})}
          )
          ON CONFLICT (user_id, dedupe_key) DO UPDATE SET
            name = COALESCE(EXCLUDED.name, business_profiles.name),
            address = COALESCE(EXCLUDED.address, business_profiles.address),
            phone = COALESCE(EXCLUDED.phone, business_profiles.phone),
            website = COALESCE(EXCLUDED.website, business_profiles.website),
            map_url = COALESCE(EXCLUDED.map_url, business_profiles.map_url),
            category = COALESCE(EXCLUDED.category, business_profiles.category),
            reviews = COALESCE(EXCLUDED.reviews, business_profiles.reviews),
            rating = COALESCE(EXCLUDED.rating, business_profiles.rating),
            ranking = COALESCE(EXCLUDED.ranking, business_profiles.ranking),
            avg_position = COALESCE(EXCLUDED.avg_position, business_profiles.avg_position),
            market_share = COALESCE(EXCLUDED.market_share, business_profiles.market_share),
            photos_count = COALESCE(EXCLUDED.photos_count, business_profiles.photos_count),
            import_batch_id = EXCLUDED.import_batch_id,
            meta = EXCLUDED.meta,
            updated_at = NOW()
          RETURNING 
            (xmax = 0) AS inserted
        `;
        
        // xmax = 0 means INSERT, otherwise UPDATE
        if (upsertResult && upsertResult[0]) {
          if (upsertResult[0].inserted) {
            result.inserted++;
          } else {
            result.updated++;
          }
        } else {
          result.inserted++;
        }
        
      } catch (dbError) {
        console.error(`Error upserting profile ${i}:`, dbError);
        result.errors.push({ index: i, reason: dbError.message || 'Database error' });
        result.skipped++;
      }
    }
    
    return jsonResponse(result);
    
  } catch (error) {
    console.error('import_profiles error:', error);
    return errorResponse(500, error.message || 'Internal server error');
  }
}
