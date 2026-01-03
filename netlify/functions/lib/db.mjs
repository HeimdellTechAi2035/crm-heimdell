/**
 * Database connection module for Netlify Functions
 * Uses @netlify/neon for serverless Postgres access
 */

import { neon } from '@netlify/neon';

// Get a database connection using @netlify/neon
// The DATABASE_URL env var is automatically provided by Netlify when you add Neon integration
export function getDb() {
  // Netlify uses NETLIFY_DATABASE_URL, fall back to DATABASE_URL for local dev
  const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
      'Please add a Neon database via Netlify dashboard or set DATABASE_URL in your environment.'
    );
  }
  
  return neon(databaseUrl);
}

// Helper to run a single query
export async function query(sql, params = []) {
  const db = getDb();
  return db(sql, params);
}

// Helper to run a query and return first row
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Helper to run a query and return scalar value
export async function queryScalar(sql, params = []) {
  const row = await queryOne(sql, params);
  return row ? Object.values(row)[0] : null;
}

export default { getDb, query, queryOne, queryScalar };
