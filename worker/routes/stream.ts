import { z } from 'zod'
import { validateUrlSafety } from '../services/url-validator'
import { executeChatStream } from '../services/provider-client'
import { getCorsHeaders } from '../middleware/cors'
import type { Env } from '../types'

export const streamRequestSchema = z.object({
  baseUrl: z.string().min(1, 'Base URL is required'),
  apiKey: z.string().min(1, 'API Key is required'),
  authType: z.enum(['bearer', 'x-api-key', 'custom']).default('bearer'),
  customAuthHeader: z.string().optional(),
  model: z.string().min(1, 'Model ID is required'),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      })
    )
    .min(1, 'At least one message is required'),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(32768).optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
})

export async function handleChatStream(request: Request, env: Env): Promise<Response> {
  const cors = getCorsHeaders(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_JSON',
          category: 'Request Error',
          message: 'Malformed JSON payload in request body.',
          httpStatus: 400,
          possibleCauses: ['The request body is not valid JSON.'],
          recommendations: ['Ensure request body is valid application/json.'],
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }

  // Zod request validation
  const parseResult = streamRequestSchema.safeParse(body)
  if (!parseResult.success) {
    const errorDetails = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          category: 'Validation Error',
          message: `Validation failed: ${errorDetails}`,
          httpStatus: 400,
          possibleCauses: ['Missing required fields or invalid parameters for streaming.'],
          recommendations: ['Provide baseUrl, apiKey, model, and at least one user message.'],
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }

  const {
    baseUrl,
    apiKey,
    authType,
    customAuthHeader,
    model,
    messages,
    temperature,
    maxTokens,
    topP,
    frequencyPenalty,
    presencePenalty,
  } = parseResult.data

  // SSRF & URL safety check
  const isProduction = env.ENVIRONMENT === 'production'
  const urlSafety = validateUrlSafety(baseUrl, {
    allowLocalhost: !isProduction,
    isProduction,
  })

  if (!urlSafety.safe) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'SSRF_BLOCKED',
          category: 'Security Error',
          message: `URL security validation failed: ${urlSafety.error}`,
          httpStatus: 400,
          possibleCauses: ['Target points to a restricted address or internal network.'],
          recommendations: ['Use a publicly accessible HTTPS Base URL.'],
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }

  // Execute chat stream
  const streamResponse = await executeChatStream({
    baseUrl: urlSafety.normalizedUrl || baseUrl,
    apiKey,
    authType,
    customAuthHeader,
    model,
    messages,
    temperature,
    maxTokens,
    topP,
    frequencyPenalty,
    presencePenalty,
    signal: request.signal, // Forward client cancellation
  })

  // Append CORS headers to the response
  const responseHeaders = new Headers(streamResponse.headers)
  for (const [k, v] of Object.entries(cors)) {
    responseHeaders.set(k, v)
  }

  return new Response(streamResponse.body, {
    status: streamResponse.status,
    statusText: streamResponse.statusText,
    headers: responseHeaders,
  })
}
