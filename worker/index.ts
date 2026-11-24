import { getCorsHeaders, handleCorsPreflight } from './middleware/cors'
import { checkRateLimit } from './middleware/rate-limit'
import { handleHealth } from './routes/health'
import { handleTestConnection } from './routes/test-connection'
import { handleModels } from './routes/models'
import { handleChatCompletions } from './routes/chat'
import { handleChatStream } from './routes/stream'
import { handleBenchmark } from './routes/benchmark'
import type { Env } from './types'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const corsHeaders = getCorsHeaders(request)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCorsPreflight(request)
    }

    // Rate Limiting (per client IP)
    const clientIp =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'

    const rateLimit = checkRateLimit(clientIp, 60, 60000)
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            category: 'Rate Limit Error',
            message: `Too many requests. Please wait ${rateLimit.resetInSeconds} seconds before trying again.`,
            httpStatus: 429,
            possibleCauses: ['Exceeded client request limit of 60 requests per minute.'],
            recommendations: ['Wait a few moments and avoid rapid successive clicks.'],
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.resetInSeconds),
            ...corsHeaders,
          },
        }
      )
    }

    // Route API requests
    if (url.pathname.startsWith('/api/')) {
      const path = url.pathname.replace(/^\/api/, '')

      // 1. GET /api/health
      if (path === '/health' && request.method === 'GET') {
        return handleHealth(request)
      }

      // 2. POST /api/test-connection
      if (path === '/test-connection' && request.method === 'POST') {
        return handleTestConnection(request, env)
      }

      // 3. POST /api/models
      if (path === '/models' && request.method === 'POST') {
        return handleModels(request, env)
      }

      // 4. POST /api/chat/completions
      if (path === '/chat/completions' && request.method === 'POST') {
        return handleChatCompletions(request, env)
      }

      // 5. POST /api/chat/stream
      if (path === '/chat/stream' && request.method === 'POST') {
        return handleChatStream(request, env)
      }

      // 6. POST /api/benchmark
      if (path === '/benchmark' && request.method === 'POST') {
        return handleBenchmark(request, env)
      }

      // Unhandled API endpoint
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'ENDPOINT_NOT_FOUND',
            category: 'Routing Error',
            message: `API endpoint '${url.pathname}' was not found or method '${request.method}' is not supported.`,
            httpStatus: 404,
            possibleCauses: ['Incorrect API endpoint URL or HTTP method.'],
            recommendations: [
              'Use supported endpoints: GET /api/health, POST /api/test-connection, POST /api/models, POST /api/chat/completions, POST /api/chat/stream, POST /api/benchmark.',
            ],
          },
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      )
    }

    // Serve static client assets (if ASSETS binding available in Cloudflare Workers)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return new Response('Not Found', { status: 404 })
  },
}
