/**
 * Simple database test function - inline all deps
 */
import { neon } from '@neondatabase/serverless';

export async function handler(event, context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  
  try {
    // Get database URL
    const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      // List available environment variables (names only for security)
      const envKeys = Object.keys(process.env).filter(k => 
        k.includes('DATABASE') || k.includes('NEON') || k.includes('PG') || k.includes('POSTGRES')
      );
      
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'DATABASE_URL not configured',
          available_env_vars: envKeys,
          hint: 'Set DATABASE_URL in Netlify dashboard under Site Settings > Environment Variables'
        })
      };
    }
    
    // Parse URL to show info (mask password)
    let urlInfo = {};
    try {
      const url = new URL(databaseUrl);
      urlInfo = {
        host: url.hostname,
        database: url.pathname.slice(1),
        user: url.username,
        hasPassword: url.password ? 'yes (length: ' + url.password.length + ')' : 'no',
        ssl: url.searchParams.get('sslmode') || 'default'
      };
    } catch (e) {
      urlInfo = { error: 'Invalid URL format' };
    }
    
    // Connect and run simple query
    const sql = neon(databaseUrl);
    const result = await sql`SELECT NOW() as time, current_database() as db`;
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Database connection successful!',
        connection: urlInfo,
        data: result[0]
      })
    };
  } catch (error) {
    // Parse URL for debugging even on error
    const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL || '';
    let urlInfo = {};
    try {
      const url = new URL(databaseUrl);
      urlInfo = {
        host: url.hostname,
        database: url.pathname.slice(1),
        user: url.username,
        hasPassword: url.password ? 'yes (length: ' + url.password.length + ')' : 'no'
      };
    } catch (e) {
      urlInfo = { error: 'Invalid URL format' };
    }
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error.message,
        connection: urlInfo,
        hint: 'Check your Neon database password in the connection string. Go to Neon console and copy the full connection string.'
      })
    };
  }
}
