/**
 * import_csv.mjs
 * 
 * POST endpoint: accepts { csv_text: "...", filename: "..." }
 * Parses CSV, transforms to profiles, and saves to database.
 * Gets userId from X-User-Id header or X-User-Email header.
 */

import { neon } from '@neondatabase/serverless';

// CORS headers
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

// Parse CSV row handling quoted fields
function parseCSVRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// Parse full CSV text
function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVRow(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

// Map CSV row to profile object
function mapRowToProfile(row, index) {
  // Auto-detect column mappings (handle various naming conventions)
  const getName = () => row['place/name'] || row['name'] || row['business_name'] || row['businessname'] || row['company'] || '';
  const getAddress = () => row['place/address'] || row['address'] || row['full_address'] || row['location'] || '';
  const getPhone = () => row['place/phone'] || row['phone'] || row['telephone'] || row['phone_number'] || '';
  const getWebsite = () => row['place/website_url'] || row['website'] || row['url'] || row['website_url'] || '';
  const getMapUrl = () => row['place/map_url'] || row['map_url'] || row['google_maps_url'] || row['maps_url'] || '';
  const getCategory = () => row['place/main_category'] || row['category'] || row['main_category'] || row['type'] || '';
  const getReviews = () => row['place/review_count'] || row['review_count'] || row['reviews'] || row['num_reviews'] || '0';
  const getRating = () => row['place/ave_review_rating'] || row['rating'] || row['review_rating'] || row['stars'] || '';
  const getRanking = () => row['place/ranking'] || row['ranking'] || row['rank'] || row['position'] || '';
  const getAvgPosition = () => row['average_position'] || row['avg_position'] || row['avgposition'] || '';
  const getMarketShare = () => row['market_share'] || row['marketshare'] || row['share'] || '';
  const getPhotosCount = () => row['photos_count'] || row['photoscount'] || row['photos'] || '0';

  const name = getName();
  if (!name) {
    return null; // Skip rows without a name
  }

  // Generate dedupe key from name + address (normalized)
  const address = getAddress();
  const dedupeKey = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${address.toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 255);

  return {
    id: `bp-${Date.now()}-${index}`,
    name,
    address: address || null,
    phone: getPhone() || null,
    website: getWebsite() || null,
    mapUrl: getMapUrl() || null,
    category: getCategory() || null,
    reviews: parseInt(getReviews(), 10) || 0,
    rating: parseFloat(getRating()) || null,
    ranking: getRanking() || null,
    avgPosition: parseFloat(getAvgPosition()) || null,
    marketShare: parseFloat(getMarketShare()) || null,
    photosCount: parseInt(getPhotosCount(), 10) || 0,
    dedupeKey,
    source: 'csv_import',
    meta: row // Store raw row data
  };
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
  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Get user ID from headers
    const userId = event.headers['x-user-id'] || event.headers['X-User-Id'] || 
                   event.headers['x-user-email'] || event.headers['X-User-Email'];
    
    if (!userId) {
      return errorResponse('userId is required (set X-User-Id or X-User-Email header)', 400);
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { csv_text, filename, pipeline_id } = body;

    if (!csv_text) {
      return errorResponse('csv_text is required', 400);
    }

    // Default to 'default' pipeline if not specified
    const targetPipeline = pipeline_id || 'default';

    // Parse CSV
    const { headers, rows } = parseCSV(csv_text);
    console.log(`Parsed CSV: ${rows.length} rows, headers: ${headers.join(', ')}`);

    // Map rows to profiles
    const profiles = rows.map((row, idx) => mapRowToProfile(row, idx)).filter(p => p !== null);
    console.log(`Mapped ${profiles.length} valid profiles`);

    if (profiles.length === 0) {
      return errorResponse('No valid profiles found in CSV. Make sure there is a name/place_name column.', 400);
    }

    const sql = getDb();
    const result = {
      success: true,
      import_job_id: `job-${Date.now()}`,
      total: profiles.length,
      companies_created: 0,
      companies_updated: 0,
      leads_created: 0,
      deals_created: 0,
      skipped: 0,
      errors: []
    };

    // Process each profile
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      
      try {
        const upsertResult = await sql`
          INSERT INTO business_profiles (
            id, user_id, name, address, phone, website, map_url,
            category, reviews, rating, ranking, avg_position,
            market_share, photos_count, dedupe_key, source, import_batch_id, meta, pipeline_id
          ) VALUES (
            ${profile.id},
            ${userId},
            ${profile.name},
            ${profile.address},
            ${profile.phone},
            ${profile.website},
            ${profile.mapUrl},
            ${profile.category},
            ${toInt(profile.reviews)},
            ${toNumber(profile.rating)},
            ${profile.ranking},
            ${toNumber(profile.avgPosition)},
            ${toNumber(profile.marketShare)},
            ${toInt(profile.photosCount)},
            ${profile.dedupeKey},
            ${profile.source},
            ${filename || null},
            ${JSON.stringify(profile.meta || {})},
            ${targetPipeline}
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
            pipeline_id = EXCLUDED.pipeline_id,
            updated_at = NOW()
          RETURNING (xmax = 0) AS inserted
        `;

        if (upsertResult && upsertResult[0]) {
          if (upsertResult[0].inserted) {
            result.companies_created++;
          } else {
            result.companies_updated++;
          }
        } else {
          result.companies_created++;
        }
      } catch (dbError) {
        console.error(`Error upserting profile ${i}:`, dbError);
        result.errors.push(`Row ${i + 1}: ${dbError.message}`);
        result.skipped++;
      }
    }

    // For compatibility with old API, create leads/deals entries
    result.leads_created = result.companies_created;
    result.deals_created = result.companies_created;

    return jsonResponse(result);

  } catch (error) {
    console.error('import_csv error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
