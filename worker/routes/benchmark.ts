import { z } from 'zod'
import { validateUrlSafety } from '../services/url-validator'
import { executeChatCompletion } from '../services/provider-client'
import { getCorsHeaders } from '../middleware/cors'
import type { Env, WorkerResponse } from '../types'

export const benchmarkRequestSchema = z.object({
  baseUrl: z.string().min(1, 'Base URL is required'),
  apiKey: z.string().min(1, 'API Key is required'),
  authType: z.enum(['bearer', 'x-api-key', 'custom']).default('bearer'),
  customAuthHeader: z.string().optional(),
  models: z.array(z.string().min(1)).min(2, 'At least 2 models are required for benchmark'),
  prompt: z.string().min(1, 'Prompt is required'),
  systemPrompt: z.string().optional(),
  runs: z.number().int().min(1).max(10).default(3),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(16).max(4096).optional(),
})

export interface BenchmarkModelStats {
  model: string
  runsCount: number
  avgLatency: number
  minLatency: number
  maxLatency: number
  medianLatency: number
  tokensPerSecond?: number
  successRate: number
  avgCompletionTokens?: number
}

export interface BenchmarkResponseData {
  results: BenchmarkModelStats[]
  totalRuns: number
  timestamp: string
}

function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

export async function handleBenchmark(request: Request, env: Env): Promise<Response> {
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
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }

  const parseResult = benchmarkRequestSchema.safeParse(body)
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
    models,
    prompt,
    systemPrompt,
    runs,
    temperature = 0.7,
    maxTokens = 256,
  } = parseResult.data

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
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }

  const results: BenchmarkModelStats[] = []
  const messages = []
  if (systemPrompt && systemPrompt.trim()) {
    messages.push({ role: 'system' as const, content: systemPrompt.trim() })
  }
  messages.push({ role: 'user' as const, content: prompt.trim() })

  // Sequential execution as per PRD
  for (const model of models) {
    const latencies: number[] = []
    const completionTokensList: number[] = []
    let successCount = 0

    for (let r = 0; r < runs; r++) {
      const chatRes = await executeChatCompletion({
        baseUrl: urlSafety.normalizedUrl || baseUrl,
        apiKey,
        authType,
        customAuthHeader,
        model,
        messages,
        temperature,
        maxTokens,
        timeoutMs: 30000,
      })

      if (chatRes.success && chatRes.data) {
        successCount++
        latencies.push(chatRes.data.latencyMs)
        if (chatRes.data.tokenUsage?.completionTokens) {
          completionTokensList.push(chatRes.data.tokenUsage.completionTokens)
        }
      }
    }

    const avgLatency =
      latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0
    const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0
    const medianLatency = calculatePercentile(latencies, 50)

    const avgTokens =
      completionTokensList.length > 0
        ? completionTokensList.reduce((a, b) => a + b, 0) / completionTokensList.length
        : undefined

    const tokensPerSecond =
      avgTokens !== undefined && avgLatency > 0
        ? Number(((avgTokens / (avgLatency / 1000))).toFixed(1))
        : undefined

    results.push({
      model,
      runsCount: runs,
      avgLatency,
      minLatency,
      maxLatency,
      medianLatency,
      tokensPerSecond,
      successRate: runs > 0 ? Number(((successCount / runs) * 100).toFixed(0)) : 0,
      avgCompletionTokens: avgTokens !== undefined ? Math.round(avgTokens) : undefined,
    })
  }

  const responsePayload: WorkerResponse<BenchmarkResponseData> = {
    success: true,
    data: {
      results,
      totalRuns: models.length * runs,
      timestamp: new Date().toISOString(),
    },
  }

  return new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}
