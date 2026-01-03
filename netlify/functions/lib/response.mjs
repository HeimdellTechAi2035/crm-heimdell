/**
 * CORS headers utility for Netlify Functions
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-User-Email',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders
  });
}

/**
 * Create an error response with CORS headers
 */
export function errorResponse(message, status = 400) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: corsHeaders }
  );
}

/**
 * Handle OPTIONS preflight request
 */
export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

/**
 * Parse request body as JSON or form data
 */
export async function parseBody(request) {
  const contentType = request.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }
  
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const body = {};
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          body[key] = {
            file: value,
            text: await value.text()
          };
        } else {
          body[key] = value;
        }
      }
      return body;
    } catch {
      return {};
    }
  }
  
  if (contentType.includes('text/')) {
    try {
      return { text: await request.text() };
    } catch {
      return {};
    }
  }
  
  return {};
}

export default {
  corsHeaders,
  jsonResponse,
  errorResponse,
  handleOptions,
  parseBody
};
