/**
 * Simple health check - no dependencies
 */
export async function handler(event, context) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: 'Function is working!',
      timestamp: new Date().toISOString()
    })
  };
}
