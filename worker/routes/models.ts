import { z } from 'zod'
import { validateUrlSafety } from '../services/url-validator'
import { executeFetchModels } from '../services/provider-client'
import { getCorsHeaders } from '../middleware/cors'
import type { Env, WorkerResponse, ModelsData } from '../types'

export const modelsRequestSchema = z.object({
  baseUrl: z.string().min(1, 'Base URL is required'),
  apiKey: z.string().min(1, 'API Key is required'),
  authType: z.enum(['bearer', 'x-api-key', 'custom']).default('bearer'),
  customAuthHeader: z.string().optional(),
})

export type ModelsRequest = z.infer<typeof modelsRequestSchema>

export async function handleModels(request: Request, env: Env): Promise<Response> {
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

  // Zod validation
  const parseResult = modelsRequestSchema.safeParse(body)
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
          possibleCauses: ['Missing required fields or invalid authType.'],
          recommendations: ['Provide baseUrl, apiKey, and valid authType.'],
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }

  const { baseUrl, apiKey, authType, customAuthHeader } = parseResult.data

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

  // Execute models fetch
  const result = await executeFetchModels({
    baseUrl: urlSafety.normalizedUrl || baseUrl,
    apiKey,
    authType,
    customAuthHeader,
  })

  if (result.success) {
    const responsePayload: WorkerResponse<ModelsData> = {
      success: true,
      data: {
        models: result.models,
        count: result.models.length,
        timestamp: new Date().toISOString(),
      },
    }
    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: result.error,
    }),
    {
      status: result.httpStatus >= 400 && result.httpStatus < 600 ? result.httpStatus : 502,
      headers: { 'Content-Type': 'application/json', ...cors },
    }
  )
}
