/**
 * CORS handling middleware
 */

export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '*'

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  }
}

export function handleCorsPreflight(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  })
}
