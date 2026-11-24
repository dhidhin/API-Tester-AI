import { getCorsHeaders } from '../middleware/cors'

export function handleHealth(request: Request): Response {
  const cors = getCorsHeaders(request)
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        engine: 'Cloudflare Workers (API Connection Engine)',
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...cors,
      },
    }
  )
}
