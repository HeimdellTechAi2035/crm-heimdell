/**
 * Company Upsert Function
 * 
 * Create or update a single company.
 * 
 * Endpoint: POST /.netlify/functions/company_upsert
 * 
 * Body:
 * {
 *   "user_id": "uuid" OR "email": "user@example.com",
 *   "name": "Company Name",
 *   "website": "https://...",
 *   "phone": "...",
 *   "address": "...",
 *   "ranking": "...",
 *   "market": "...",
 *   "main_category": "...",
 *   "meta": {} // optional extra fields
 * }
 */

import { query, queryOne } from './lib/db.mjs';
import { validateUser, unauthorizedResponse } from './lib/auth.mjs';
import { jsonResponse, errorResponse, handleOptions, parseBody } from './lib/response.mjs';
import { normalizeCompanyName, cleanWebsiteUrl, parseNumeric, parseInt } from './lib/csv-parser.mjs';

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

    // Validate required fields
    const { name, website, phone, address, ranking, market, main_category, review_count, review_rating, meta } = body;

    if (!name || name.trim() === '') {
      return errorResponse('Company name is required');
    }

    const normalizedName = normalizeCompanyName(name);
    if (!normalizedName) {
      return errorResponse('Invalid company name');
    }

    // Clean website URL
    const cleanedWebsite = cleanWebsiteUrl(website);
    
    // Parse numeric fields
    const parsedReviewCount = parseInt(review_count);
    const parsedReviewRating = parseNumeric(review_rating);

    // UPSERT company
    const result = await query(
      `INSERT INTO companies (
        user_id, name, normalized_name, website, phone, address, 
        ranking, market, review_count, review_rating, main_category, meta
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id, normalized_name)
      DO UPDATE SET
        name = EXCLUDED.name,
        website = COALESCE(EXCLUDED.website, companies.website),
        phone = COALESCE(EXCLUDED.phone, companies.phone),
        address = COALESCE(EXCLUDED.address, companies.address),
        ranking = COALESCE(EXCLUDED.ranking, companies.ranking),
        market = COALESCE(EXCLUDED.market, companies.market),
        review_count = COALESCE(EXCLUDED.review_count, companies.review_count),
        review_rating = COALESCE(EXCLUDED.review_rating, companies.review_rating),
        main_category = COALESCE(EXCLUDED.main_category, companies.main_category),
        meta = companies.meta || EXCLUDED.meta,
        updated_at = NOW()
      RETURNING *,
        (xmax = 0) AS is_new`,
      [
        user.id,
        name.trim(),
        normalizedName,
        cleanedWebsite,
        phone || null,
        address || null,
        ranking || null,
        market || null,
        parsedReviewCount,
        parsedReviewRating,
        main_category || null,
        JSON.stringify(meta || {})
      ]
    );

    const company = result[0];
    const wasCreated = company.is_new;
    delete company.is_new;

    return jsonResponse({
      success: true,
      created: wasCreated,
      updated: !wasCreated,
      company
    });

  } catch (err) {
    console.error('Company upsert error:', err);
    return errorResponse(`Failed to upsert company: ${err.message}`, 500);
  }
}

export const config = {
  path: "/company_upsert"
};
