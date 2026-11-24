import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeBaseUrl, validateUrlSafety, buildEndpoint } from '../worker/services/url-validator'
import { normalizeProviderError, redactSecrets } from '../worker/services/error-analyzer'
import { executeTestConnection, executeFetchModels, buildAuthHeaders } from '../worker/services/provider-client'
import { checkRateLimit } from '../worker/middleware/rate-limit'
import { handleTestConnection } from '../worker/routes/test-connection'
import { handleHealth } from '../worker/routes/health'

describe('API Connection Engine — Automated Integration Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================
  // SCENARIO 1: Uji Menggunakan Mock Provider
  // ==========================================
  describe('1. Mock Provider Integration', () => {
    it('successfully connects to mock provider and parses models count and latency', async () => {
      const mockModelsResponse = {
        object: 'list',
        data: [
          { id: 'gpt-4o', object: 'model', created: 1715368132, owned_by: 'system' },
          { id: 'gpt-4o-mini', object: 'model', created: 1721297597, owned_by: 'system' },
          { id: 'text-embedding-3-small', object: 'model', created: 1705948997, owned_by: 'system' },
        ],
      }

      // Mock fetch returning 200 OK with model list
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockModelsResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await executeTestConnection({
        baseUrl: 'https://mock.api.example.com/v1',
        apiKey: 'sk-mock-valid-key-1234567890',
        authType: 'bearer',
      })

      expect(result.success).toBe(true)
      expect(result.httpStatus).toBe(200)
      expect(result.modelsCount).toBe(3)
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
      expect(result.endpointTested).toBe('https://mock.api.example.com/v1/models')
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://mock.api.example.com/v1/models',
        expect.objectContaining({ redirect: 'manual' })
      )
    })

    it('successfully fetches and normalizes models from mock provider', async () => {
      const mockModelsResponse = {
        data: [
          { id: 'claude-3-5-sonnet', owned_by: 'anthropic', context_window: 200000 },
          { id: 'claude-3-haiku', owned_by: 'anthropic', context_window: 200000 },
        ],
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockModelsResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await executeFetchModels({
        baseUrl: 'https://mock.api.example.com/v1',
        apiKey: 'mock-key',
        authType: 'bearer',
      })

      expect(result.success).toBe(true)
      expect(result.models).toHaveLength(2)
      expect(result.models[0].id).toBe('claude-3-5-sonnet')
      expect(result.models[0].ownedBy).toBe('anthropic')
      expect(result.models[0].status).toBe('available')
    })

    it('correctly constructs Bearer, X-API-Key, and Custom headers', () => {
      const bearer = buildAuthHeaders('sk-test-secret', 'bearer')
      expect(bearer).toEqual({ Authorization: 'Bearer sk-test-secret' })

      const xApiKey = buildAuthHeaders('sk-test-secret', 'x-api-key')
      expect(xApiKey).toEqual({ 'x-api-key': 'sk-test-secret' })

      const custom = buildAuthHeaders('sk-test-secret', 'custom', 'X-Custom-Auth')
      expect(custom).toEqual({ 'X-Custom-Auth': 'sk-test-secret' })
    })

    it('properly normalizes Base URL without creating /v1/v1', () => {
      expect(normalizeBaseUrl('  https://api.openai.com/v1///  ')).toBe('https://api.openai.com/v1')
      expect(normalizeBaseUrl('https://api.openai.com/v1/v1')).toBe('https://api.openai.com/v1')
      expect(buildEndpoint('https://api.openai.com/v1', 'models')).toBe('https://api.openai.com/v1/models')
      expect(buildEndpoint('https://api.openai.com', 'models')).toBe('https://api.openai.com/v1/models')
    })
  })

  // ==========================================
  // SCENARIO 2: Uji Authentication Failure
  // ==========================================
  describe('2. Authentication Failure Integration', () => {
    it('handles 401 Unauthorized with normalized error structure and redacted secrets', async () => {
      const secretKey = 'sk-super-secret-user-api-key-9988'
      const mock401Response = {
        error: {
          message: `Incorrect API key provided: ${secretKey}. You can find your API key at https://platform.openai.com/account/api-keys.`,
          type: 'invalid_request_error',
          param: null,
          code: 'invalid_api_key',
        },
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mock401Response), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await executeTestConnection({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: secretKey,
        authType: 'bearer',
      })

      expect(result.success).toBe(false)
      expect(result.httpStatus).toBe(401)
      expect(result.error).toBeDefined()
      expect(result.error?.code).toBe('AUTHENTICATION_FAILED')
      expect(result.error?.category).toBe('Authentication Error')
      expect(result.error?.possibleCauses).toBeDefined()
      expect(result.error?.recommendations).toBeDefined()

      // Verify SECRET REDACTION: Secret key MUST NOT be present in error message
      expect(result.error?.message).not.toContain(secretKey)
      expect(result.error?.message).toContain('[REDACTED_API_KEY]')
    })

    it('redacts Authorization Bearer tokens in plain text', () => {
      const leakedLog = 'Request failed: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret'
      const redacted = redactSecrets(leakedLog)
      expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
      expect(redacted).toContain('Bearer [REDACTED]')
    })
  })

  // ==========================================
  // SCENARIO 3: Uji Invalid URL
  // ==========================================
  describe('3. Invalid URL Handling', () => {
    it('rejects malformed or empty URLs', () => {
      expect(validateUrlSafety('').safe).toBe(false)
      expect(validateUrlSafety('not-a-valid-url').safe).toBe(false)
      expect(validateUrlSafety('ftp://files.example.com').safe).toBe(false)
    })

    it('rejects URLs with embedded username or password credentials', () => {
      const result = validateUrlSafety('https://admin:supersecret@api.example.com/v1')
      expect(result.safe).toBe(false)
      expect(result.error).toContain('embedded username or password')
    })

    it('rejects unauthorized or arbitrary custom ports', () => {
      const result = validateUrlSafety('https://api.example.com:22/v1')
      expect(result.safe).toBe(false)
      expect(result.error).toContain('Port 22 is not in the allowed list')
    })

    it('enforces HTTPS when in production mode', () => {
      const result = validateUrlSafety('http://api.example.com/v1', { isProduction: true })
      expect(result.safe).toBe(false)
      expect(result.error).toContain('HTTPS is strictly required in production')
    })
  })

  // ==========================================
  // SCENARIO 4: Uji Endpoint yang Tidak Tersedia
  // ==========================================
  describe('4. Unavailable / Not Found Endpoints', () => {
    it('normalizes 404 Not Found response when /models is unsupported', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Cannot GET /v1/models', {
          status: 404,
          statusText: 'Not Found',
        })
      )

      const result = await executeTestConnection({
        baseUrl: 'https://custom-gateway.example.com/v1',
        apiKey: 'test-key',
        authType: 'bearer',
      })

      expect(result.success).toBe(false)
      expect(result.httpStatus).toBe(404)
      expect(result.error?.code).toBe('NOT_FOUND')
      expect(result.error?.category).toBe('Endpoint / Model Error')
      expect(result.error?.recommendations?.[1]).toContain('Manual Model ID')
    })

    it('handles network drop or DNS resolution failure gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new TypeError('getaddrinfo ENOTFOUND unreachable-domain-999.xyz')
      )

      const result = await executeTestConnection({
        baseUrl: 'https://unreachable-domain-999.xyz/v1',
        apiKey: 'test-key',
        authType: 'bearer',
      })

      expect(result.success).toBe(false)
      expect(result.httpStatus).toBe(0)
      expect(result.error?.code).toBe('NETWORK_ERROR')
      expect(result.error?.message).toContain('Failed to connect')
    })
  })

  // ==========================================
  // SCENARIO 5: Uji SSRF Protection
  // ==========================================
  describe('5. SSRF Protection', () => {
    it('blocks localhost and loopback targets in production', () => {
      expect(validateUrlSafety('https://localhost:8080/v1', { isProduction: true }).safe).toBe(false)
      expect(validateUrlSafety('https://127.0.0.1/v1', { isProduction: true }).safe).toBe(false)
      expect(validateUrlSafety('https://127.0.1.1/v1').safe).toBe(false)
    })

    it('blocks AWS, GCP, and Azure cloud metadata endpoints', () => {
      const metadata = validateUrlSafety('http://169.254.169.254/latest/meta-data/')
      expect(metadata.safe).toBe(false)
      expect(metadata.error).toContain('SSRF protection')

      const googleMeta = validateUrlSafety('http://metadata.google.internal/computeMetadata/v1/')
      expect(googleMeta.safe).toBe(false)
      expect(googleMeta.error).toContain('SSRF protection')

      const alibabaMeta = validateUrlSafety('http://100.100.100.200/latest/meta-data/')
      expect(alibabaMeta.safe).toBe(false)
    })

    it('blocks private RFC 1918 IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)', () => {
      expect(validateUrlSafety('http://10.0.0.1:8080/v1').safe).toBe(false)
      expect(validateUrlSafety('http://172.16.0.5:8000/v1').safe).toBe(false)
      expect(validateUrlSafety('http://172.31.255.255/v1').safe).toBe(false)
      expect(validateUrlSafety('http://192.168.1.100/v1').safe).toBe(false)
    })

    it('blocks internal domain patterns (.internal, .local, .corp, .lan)', () => {
      expect(validateUrlSafety('https://ai-cluster.internal/v1').safe).toBe(false)
      expect(validateUrlSafety('https://my-macbook.local:11434/v1').safe).toBe(false)
      expect(validateUrlSafety('https://vault.corp/v1').safe).toBe(false)
      expect(validateUrlSafety('https://router.lan/v1').safe).toBe(false)
    })
  })

  // ==========================================
  // SCENARIO 6: Worker Route Handler & Middleware
  // ==========================================
  describe('6. Worker Route Handlers & Rate Limiting', () => {
    it('handles GET /api/health with healthy status', () => {
      const request = new Request('http://localhost:5173/api/health', { method: 'GET' })
      const response = handleHealth(request)
      expect(response.status).toBe(200)
    })

    it('rejects invalid JSON or missing fields with Zod validation error', async () => {
      const request = new Request('http://localhost:5173/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: 'https://api.openai.com/v1' }), // Missing apiKey!
      })

      const response = await handleTestConnection(request, {})
      expect(response.status).toBe(400)
      const data = await response.json() as { success: boolean; error: { code: string } }
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('blocks SSRF target when requested through handleTestConnection route', async () => {
      const request = new Request('http://localhost:5173/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: 'http://169.254.169.254/v1',
          apiKey: 'test-key',
          authType: 'bearer',
        }),
      })

      const response = await handleTestConnection(request, {})
      expect(response.status).toBe(400)
      const data = await response.json() as { success: boolean; error: { code: string } }
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('SSRF_BLOCKED')
    })

    it('enforces client rate limiting after exceeding request limit', () => {
      const testIp = '198.51.100.42'
      // 5 requests within limit
      for (let i = 0; i < 5; i++) {
        const res = checkRateLimit(testIp, 5, 10000)
        expect(res.allowed).toBe(true)
      }
      // 6th request must be blocked
      const blockedRes = checkRateLimit(testIp, 5, 10000)
      expect(blockedRes.allowed).toBe(false)
      expect(blockedRes.remaining).toBe(0)
    })
  })
})
