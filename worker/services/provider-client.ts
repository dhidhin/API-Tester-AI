import { buildEndpoint, validateUrlSafety } from './url-validator'
import { normalizeProviderError, redactSecrets } from './error-analyzer'
import type { AppError, ModelItem, ChatMessage, TokenUsage, ChatCompletionData } from '../types'

/**
 * Provider client service for making external requests via Fetch API
 */

export interface ProviderConnectionResult {
  success: boolean
  latencyMs: number
  httpStatus: number
  endpointTested: string
  modelsCount?: number
  error?: AppError
}

export interface ProviderModelsResult {
  success: boolean
  models: ModelItem[]
  httpStatus: number
  error?: AppError
}

export interface ProviderChatResult {
  success: boolean
  data?: ChatCompletionData
  httpStatus: number
  error?: AppError
}

/**
 * Builds standard authentication headers based on selected method
 */
export function buildAuthHeaders(
  apiKey: string,
  authType: string,
  customHeader?: string
): Record<string, string> {
  const cleanKey = apiKey.trim()
  if (authType === 'x-api-key') {
    return { 'x-api-key': cleanKey }
  }
  if (authType === 'custom' && customHeader && customHeader.trim()) {
    return { [customHeader.trim()]: cleanKey }
  }
  // Default is Bearer
  return { Authorization: `Bearer ${cleanKey}` }
}

/**
 * Executes a fetch request with Cloudflare Workers compatible 'manual' redirect handling
 * and SSRF validation for any redirect targets.
 */
async function safeFetch(
  url: string,
  init: RequestInit,
  maxRedirects = 3
): Promise<Response> {
  let currentUrl = url
  let redirectsRemaining = maxRedirects

  while (true) {
    const response = await fetch(currentUrl, {
      ...init,
      redirect: 'manual',
    })

    // If not a redirect, return immediately
    if (response.status < 300 || response.status >= 400) {
      return response
    }

    // 3xx redirect encountered
    const location = response.headers.get('Location')
    if (!location || redirectsRemaining <= 0) {
      return response
    }

    redirectsRemaining--

    // Resolve target URL
    let nextUrl: string
    try {
      nextUrl = new URL(location, currentUrl).toString()
    } catch {
      return response
    }

    // SSRF verification on redirect destination
    const targetSafety = validateUrlSafety(nextUrl)
    if (!targetSafety.safe) {
      throw new Error(`SSRF Defense: Redirect to ${nextUrl} was blocked (${targetSafety.error || 'forbidden destination'})`)
    }

    currentUrl = targetSafety.normalizedUrl || nextUrl
  }
}

/**
 * Executes a test connection to the provider's /models endpoint
 */
export async function executeTestConnection(params: {
  baseUrl: string
  apiKey: string
  authType: string
  customAuthHeader?: string
  timeoutMs?: number
}): Promise<ProviderConnectionResult> {
  const { baseUrl, apiKey, authType, customAuthHeader, timeoutMs = 12000 } = params

  const endpoint = buildEndpoint(baseUrl, 'models')
  const authHeaders = buildAuthHeaders(apiKey, authType, customAuthHeader)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const startTime = Date.now()

  try {
    const response = await safeFetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'APITesterAI/1.0',
        ...authHeaders,
      },
      signal: controller.signal,
    })

    const latencyMs = Date.now() - startTime
    clearTimeout(timeoutId)

    if (response.ok) {
      let modelsCount = 0
      try {
        const data = (await response.json()) as { data?: unknown[]; models?: unknown[] }
        if (Array.isArray(data.data)) {
          modelsCount = data.data.length
        } else if (Array.isArray(data.models)) {
          modelsCount = data.models.length
        }
      } catch {
        // Non-fatal if parsing count fails on successful connection
      }

      return {
        success: true,
        latencyMs,
        httpStatus: response.status,
        endpointTested: endpoint,
        modelsCount,
      }
    }

    const errorText = await response.text()
    const normalizedError = normalizeProviderError(response.status, errorText, [apiKey])

    return {
      success: false,
      latencyMs,
      httpStatus: response.status,
      endpointTested: endpoint,
      error: normalizedError,
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    const latencyMs = Date.now() - startTime

    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        latencyMs,
        httpStatus: 408,
        endpointTested: endpoint,
        error: {
          code: 'CONNECTION_TIMEOUT',
          category: 'Timeout Error',
          message: `Connection timed out after ${timeoutMs}ms while contacting ${endpoint}.`,
          httpStatus: 408,
          possibleCauses: ['The provider took too long to respond or is unreachable.'],
          recommendations: ['Verify network connectivity and check provider availability.'],
        },
      }
    }

    const rawMessage = err instanceof Error ? err.message : 'Network error'
    const cleanMessage = redactSecrets(rawMessage, [apiKey])

    return {
      success: false,
      latencyMs,
      httpStatus: 0,
      endpointTested: endpoint,
      error: {
        code: 'NETWORK_ERROR',
        category: 'Network Error',
        message: `Failed to connect to ${endpoint}: ${cleanMessage}`,
        httpStatus: 0,
        possibleCauses: [
          'Provider domain cannot be resolved or is offline.',
          'CORS or intermediate firewall blocked the request.',
          'Redirect was attempted and blocked for security.',
        ],
        recommendations: [
          'Verify the Base URL is accurate and publicly accessible.',
          'Check if the provider domain requires a VPN or specific network route.',
        ],
      },
    }
  }
}

/**
 * Fetches models list from the provider's /models endpoint
 */
export async function executeFetchModels(params: {
  baseUrl: string
  apiKey: string
  authType: string
  customAuthHeader?: string
  timeoutMs?: number
}): Promise<ProviderModelsResult> {
  const { baseUrl, apiKey, authType, customAuthHeader, timeoutMs = 15000 } = params

  const endpoint = buildEndpoint(baseUrl, 'models')
  const authHeaders = buildAuthHeaders(apiKey, authType, customAuthHeader)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await safeFetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'APITesterAI/1.0',
        ...authHeaders,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      const normalizedError = normalizeProviderError(response.status, errorText, [apiKey])
      return {
        success: false,
        models: [],
        httpStatus: response.status,
        error: normalizedError,
      }
    }

    const data = (await response.json()) as Record<string, unknown>
    let rawList: Array<Record<string, unknown>> = []

    if (Array.isArray(data.data)) {
      rawList = data.data as Array<Record<string, unknown>>
    } else if (Array.isArray(data.models)) {
      rawList = data.models as Array<Record<string, unknown>>
    } else if (Array.isArray(data)) {
      rawList = data as Array<Record<string, unknown>>
    }

    const models: ModelItem[] = rawList
      .map((item) => {
        const id = String(item.id || item.name || '')
        return {
          id,
          object: typeof item.object === 'string' ? item.object : undefined,
          created: typeof item.created === 'number' ? item.created : undefined,
          ownedBy:
            typeof item.owned_by === 'string'
              ? item.owned_by
              : typeof item.ownedBy === 'string'
              ? item.ownedBy
              : undefined,
          contextLength:
            typeof item.context_length === 'number'
              ? item.context_length
              : typeof item.context_window === 'number'
              ? item.context_window
              : undefined,
          status: 'available' as const,
        }
      })
      .filter((m) => m.id.length > 0)

    return {
      success: true,
      models,
      httpStatus: response.status,
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId)

    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        models: [],
        httpStatus: 408,
        error: {
          code: 'FETCH_MODELS_TIMEOUT',
          category: 'Timeout Error',
          message: `Fetching models timed out after ${timeoutMs}ms.`,
          httpStatus: 408,
          possibleCauses: ['The provider discovery endpoint is very slow or stalled.'],
          recommendations: ['Try entering your Model ID manually in the Model Explorer.'],
        },
      }
    }

    const rawMessage = err instanceof Error ? err.message : 'Network error'
    const cleanMessage = redactSecrets(rawMessage, [apiKey])

    return {
      success: false,
      models: [],
      httpStatus: 0,
      error: {
        code: 'NETWORK_ERROR',
        category: 'Network Error',
        message: `Failed to fetch models: ${cleanMessage}`,
        httpStatus: 0,
        possibleCauses: ['The provider endpoint is unreachable or discovery is unsupported.'],
        recommendations: ['Use "Manual Model ID" to specify your model directly.'],
      },
    }
  }
}

/**
 * Normalizes different provider chat completion responses
 */
export function normalizeChatResponse(raw: unknown): {
  content: string
  reasoningContent?: string
  tokenUsage?: TokenUsage
} {
  if (!raw || typeof raw !== 'object') {
    return { content: '' }
  }

  const data = raw as Record<string, unknown>
  let content = ''
  let reasoningContent: string | undefined = undefined

  // 1. OpenAI standard choices
  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const firstChoice = data.choices[0] as Record<string, unknown>
    if (firstChoice.message && typeof firstChoice.message === 'object') {
      const message = firstChoice.message as Record<string, unknown>
      if (typeof message.content === 'string') {
        content = message.content
      }
      if (typeof message.reasoning_content === 'string') {
        reasoningContent = message.reasoning_content
      }
    } else if (typeof firstChoice.text === 'string') {
      content = firstChoice.text
    }
  }
  // 2. Claude-like content blocks: { content: [{ type: "text", text: "..." }] }
  else if (Array.isArray(data.content)) {
    content = data.content
      .map((block: unknown) => {
        if (block && typeof block === 'object' && 'text' in block) {
          return String((block as { text: unknown }).text || '')
        }
        return ''
      })
      .join('\n')
  }
  // 3. Gemini-like candidates
  else if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const candidate = data.candidates[0] as Record<string, unknown>
    if (candidate.content && typeof candidate.content === 'object') {
      const cContent = candidate.content as Record<string, unknown>
      if (Array.isArray(cContent.parts)) {
        content = cContent.parts.map((p) => (p && typeof p === 'object' && 'text' in p ? String((p as { text: unknown }).text || '') : '')).join('')
      }
    }
  }
  // 4. Ollama or direct response field
  else if (typeof data.response === 'string') {
    content = data.response
  } else if (data.message && typeof data.message === 'object') {
    const msg = data.message as Record<string, unknown>
    if (typeof msg.content === 'string') content = msg.content
  }

  // Token usage extraction
  let tokenUsage: TokenUsage | undefined = undefined
  if (data.usage && typeof data.usage === 'object') {
    const usage = data.usage as Record<string, unknown>
    const prompt = Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? 0)
    const completion = Number(usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount ?? 0)
    const total = Number(usage.total_tokens ?? usage.totalTokenCount ?? (prompt + completion))
    tokenUsage = {
      promptTokens: isNaN(prompt) ? 0 : prompt,
      completionTokens: isNaN(completion) ? 0 : completion,
      totalTokens: isNaN(total) ? 0 : total,
    }
  }

  return { content, reasoningContent, tokenUsage }
}

/**
 * Executes a non-streaming chat completion request
 */
export async function executeChatCompletion(params: {
  baseUrl: string
  apiKey: string
  authType: string
  customAuthHeader?: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  timeoutMs?: number
}): Promise<ProviderChatResult> {
  const {
    baseUrl,
    apiKey,
    authType,
    customAuthHeader,
    model,
    messages,
    temperature = 0.7,
    maxTokens = 1024,
    topP = 1,
    frequencyPenalty = 0,
    presencePenalty = 0,
    timeoutMs = 60000,
  } = params

  const endpoint = buildEndpoint(baseUrl, 'chat/completions')
  const authHeaders = buildAuthHeaders(apiKey, authType, customAuthHeader)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const startTime = Date.now()

  try {
    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      stream: false,
    }

    const response = await safeFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'APITesterAI/1.0',
        ...authHeaders,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const latencyMs = Date.now() - startTime
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      const normalizedError = normalizeProviderError(response.status, errorText, [apiKey])
      return {
        success: false,
        httpStatus: response.status,
        error: normalizedError,
      }
    }

    const rawJson = (await response.json()) as Record<string, unknown>
    const normalized = normalizeChatResponse(rawJson)

    return {
      success: true,
      httpStatus: response.status,
      data: {
        content: normalized.content,
        reasoningContent: normalized.reasoningContent,
        model,
        latencyMs,
        httpStatus: response.status,
        tokenUsage: normalized.tokenUsage,
        rawResponse: rawJson,
        timestamp: new Date().toISOString(),
      },
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    const latencyMs = Date.now() - startTime

    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        httpStatus: 408,
        error: {
          code: 'CHAT_TIMEOUT',
          category: 'Timeout Error',
          message: `Chat completion timed out after ${timeoutMs}ms.`,
          httpStatus: 408,
          possibleCauses: ['The model generation took too long or the provider is overloaded.'],
          recommendations: ['Reduce Max Tokens or test with a faster model.'],
        },
      }
    }

    const rawMessage = err instanceof Error ? err.message : 'Network error'
    const cleanMessage = redactSecrets(rawMessage, [apiKey])

    return {
      success: false,
      httpStatus: 0,
      error: {
        code: 'NETWORK_ERROR',
        category: 'Network Error',
        message: `Failed to complete chat request: ${cleanMessage}`,
        httpStatus: 0,
        possibleCauses: ['Upstream provider is unreachable or connection dropped.'],
        recommendations: ['Verify Base URL and provider status.'],
      },
    }
  }
}

/**
 * Executes a streaming chat completion request using Web Streams API
 */
export async function executeChatStream(params: {
  baseUrl: string
  apiKey: string
  authType: string
  customAuthHeader?: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<Response> {
  const {
    baseUrl,
    apiKey,
    authType,
    customAuthHeader,
    model,
    messages,
    temperature = 0.7,
    maxTokens = 1024,
    topP = 1,
    frequencyPenalty = 0,
    presencePenalty = 0,
    timeoutMs = 90000,
    signal,
  } = params

  const endpoint = buildEndpoint(baseUrl, 'chat/completions')
  const authHeaders = buildAuthHeaders(apiKey, authType, customAuthHeader)

  // Combined abort signal with timeout
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs)

  if (signal) {
    signal.addEventListener('abort', () => timeoutController.abort(), { once: true })
  }

  try {
    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      stream: true,
    }

    const upstreamResponse = await safeFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
        'User-Agent': 'APITesterAI/1.0',
        ...authHeaders,
      },
      body: JSON.stringify(payload),
      signal: timeoutController.signal,
    })

    clearTimeout(timeoutId)

    // If upstream returns an error status code, parse the error and return JSON error response
    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text()
      const normalizedError = normalizeProviderError(upstreamResponse.status, errorText, [apiKey])
      return new Response(
        JSON.stringify({
          success: false,
          error: normalizedError,
        }),
        {
          status: upstreamResponse.status,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Upstream succeeded: pass the Web Streams API body directly through to the client!
    // Without waiting for the entire stream to finish.
    const body = upstreamResponse.body
    if (!body) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'EMPTY_STREAM',
            message: 'Upstream returned empty streaming body',
            httpStatus: 502,
          },
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable proxy buffering (Nginx/Cloudflare)
      },
    })
  } catch (err: unknown) {
    clearTimeout(timeoutId)

    if (err instanceof Error && err.name === 'AbortError') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'STREAM_TIMEOUT',
            category: 'Timeout Error',
            message: `Stream request timed out or was cancelled after ${timeoutMs}ms.`,
            httpStatus: 408,
            possibleCauses: ['The upstream model generation stalled or connection timed out.'],
            recommendations: ['Check model responsiveness and retry.'],
          },
        }),
        { status: 408, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const rawMessage = err instanceof Error ? err.message : 'Network error'
    const cleanMessage = redactSecrets(rawMessage, [apiKey])

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'STREAM_CONNECTION_ERROR',
          category: 'Network Error',
          message: `Failed to establish stream connection: ${cleanMessage}`,
          httpStatus: 0,
          possibleCauses: ['Upstream host unreachable or streaming not supported.'],
          recommendations: ['Ensure the provider supports streaming on /chat/completions.'],
        },
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
