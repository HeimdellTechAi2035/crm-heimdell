/**
 * CSV Import Function
 * 
 * Accepts CSV data and imports into companies, leads, and optionally deals.
 * Uses UPSERT to prevent duplicates based on (user_id, normalized_company_name).
 * 
 * Endpoint: POST /.netlify/functions/import_csv
 * 
 * Body (JSON):
 * {
 *   "user_id": "uuid" OR "email": "user@example.com",
 *   "csv_text": "raw csv string",
 *   "filename": "optional filename"
 * }
 * 
 * OR multipart/form-data with:
 * - file: CSV file
 * - user_id or email: user identifier
 */

import { query, queryOne, queryScalar } from './lib/db.mjs';
import { validateUser, unauthorizedResponse } from './lib/auth.mjs';
import { jsonResponse, errorResponse, handleOptions, parseBody } from './lib/response.mjs';
import { 
  parseCSV, 
  normalizeCompanyName, 
  mapCSVRowToFields, 
  cleanWebsiteUrl,
  parseNumeric,
  parseInt 
} from './lib/csv-parser.mjs';

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
    // Parse request body
    const body = await parseBody(request);
    
    // Get CSV text from body or file upload
    let csvText = '';
    let filename = 'import.csv';
    
    if (body.csv_text) {
      csvText = body.csv_text;
      filename = body.filename || filename;
    } else if (body.file) {
      csvText = body.file.text;
      filename = body.file.file?.name || filename;
    } else if (body.csv) {
      // Handle 'csv' field name
      if (typeof body.csv === 'string') {
        csvText = body.csv;
      } else if (body.csv.text) {
        csvText = body.csv.text;
        filename = body.csv.file?.name || filename;
      }
    }

    if (!csvText || csvText.trim().length === 0) {
      return errorResponse('No CSV data provided. Send csv_text in body or upload a file.');
    }

    // Validate user
    const user = await validateUser(request, body);
    if (!user) {
      return unauthorizedResponse();
    }

    // Parse CSV
    const { headers, rows } = parseCSV(csvText);
    
    if (headers.length === 0) {
      return errorResponse('CSV has no headers');
    }
    
    if (rows.length === 0) {
      return errorResponse('CSV has no data rows');
    }

    // Create import job record
    const importJob = await queryOne(
      `INSERT INTO import_jobs (user_id, filename, total_rows, status)
       VALUES ($1, $2, $3, 'processing')
       RETURNING id`,
      [user.id, filename, rows.length]
    );

    // Process results
    const results = {
      total: rows.length,
      companies_created: 0,
      companies_updated: 0,
      leads_created: 0,
      deals_created: 0,
      skipped: 0,
      errors: []
    };

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is headers, and we're 1-indexed

      try {
        // Map CSV columns to database fields
        const { knownFields, meta } = mapCSVRowToFields(row, headers);
        
        // Get company name
        const companyName = knownFields.name;
        if (!companyName || companyName.trim() === '') {
          results.errors.push(`Row ${rowNum}: Missing company name`);
          results.skipped++;
          continue;
        }

        const normalizedName = normalizeCompanyName(companyName);
        if (!normalizedName) {
          results.errors.push(`Row ${rowNum}: Invalid company name "${companyName}"`);
          results.skipped++;
          continue;
        }

        // Clean website URL
        const website = cleanWebsiteUrl(knownFields.website);
        
        // Parse numeric fields
        const reviewCount = parseInt(knownFields.review_count);
        const reviewRating = parseNumeric(knownFields.review_rating);

        // UPSERT company
        const companyResult = await query(
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
          RETURNING id, (xmax = 0) AS inserted`,
          [
            user.id,
            companyName.trim(),
            normalizedName,
            website,
            knownFields.phone || null,
            knownFields.address || null,
            knownFields.ranking || null,
            knownFields.market || null,
            reviewCount,
            reviewRating,
            knownFields.main_category || null,
            JSON.stringify(meta)
          ]
        );

        const company = companyResult[0];
        const companyId = company.id;
        const wasInserted = company.inserted;

        if (wasInserted) {
          results.companies_created++;
        } else {
          results.companies_updated++;
        }

        // Create lead linked to company
        const leadResult = await query(
          `INSERT INTO leads (user_id, company_id, status, source, meta)
           VALUES ($1, $2, 'new', 'csv_import', $3)
           RETURNING id`,
          [user.id, companyId, JSON.stringify({ import_job_id: importJob.id, row: rowNum })]
        );
        
        results.leads_created++;
        const leadId = leadResult[0].id;

        // Create deal if we have value/stage information
        const dealValue = parseNumeric(meta.deal_value || meta.value || row.deal_value || row.value);
        const dealStage = meta.deal_stage || meta.stage || row.deal_stage || row.stage || 'lead';
        
        // Always create a deal for each lead (they appear in pipeline)
        await query(
          `INSERT INTO deals (user_id, company_id, lead_id, title, stage, value, meta)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            user.id,
            companyId,
            leadId,
            companyName.trim(),
            dealStage,
            dealValue,
            JSON.stringify({ import_job_id: importJob.id })
          ]
        );
        
        results.deals_created++;

      } catch (err) {
        results.errors.push(`Row ${rowNum}: ${err.message}`);
      }
    }

    // Update import job with results
    await query(
      `UPDATE import_jobs SET
        companies_created = $1,
        companies_updated = $2,
        leads_created = $3,
        deals_created = $4,
        errors = $5,
        status = 'completed',
        completed_at = NOW()
       WHERE id = $6`,
      [
        results.companies_created,
        results.companies_updated,
        results.leads_created,
        results.deals_created,
        JSON.stringify(results.errors.slice(0, 100)), // Limit stored errors
        importJob.id
      ]
    );

    return jsonResponse({
      success: true,
      import_job_id: importJob.id,
      ...results
    });

  } catch (err) {
    console.error('Import error:', err);
    return errorResponse(`Import failed: ${err.message}`, 500);
  }
}

export const config = {
  path: "/import_csv"
};
