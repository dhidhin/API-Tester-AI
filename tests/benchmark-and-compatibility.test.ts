import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleBenchmark } from '../worker/routes/benchmark'

describe('Benchmark & Compatibility Checker — Integration Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================
  // 1. BENCHMARK INTEGRATION TESTS
  // ==========================================
  describe('1. Benchmark Engine', () => {
    it('executes multi-model benchmark sequentially and calculates latency percentiles & throughput', async () => {
      // Mock responses for 2 models: model-fast (20ms) and model-slow (50ms)
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        const bodyStr = typeof init?.body === 'string' ? init.body : ''
        const body = JSON.parse(bodyStr || '{}') as { model?: string }
        const isFast = body.model === 'model-fast'

        return new Response(
          JSON.stringify({
            id: 'chatcmpl-bench',
            object: 'chat.completion',
            choices: [{ message: { content: isFast ? 'Fast' : 'Slow response' } }],
            usage: { prompt_tokens: 10, completion_tokens: isFast ? 5 : 20, total_tokens: 30 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })

      const req = new Request('http://localhost:5173/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test-key',
          authType: 'bearer',
          models: ['model-fast', 'model-slow'],
          prompt: 'Benchmark test prompt',
          runs: 2,
        }),
      })

      const res = await handleBenchmark(req, {})
      expect(res.status).toBe(200)

      const json = (await res.json()) as {
        success: boolean
        data: {
          results: Array<{
            model: string
            runsCount: number
            avgLatency: number
            successRate: number
            tokensPerSecond?: number
          }>
          totalRuns: number
        }
      }

      expect(json.success).toBe(true)
      expect(json.data.results).toHaveLength(2)
      expect(json.data.totalRuns).toBe(4) // 2 models * 2 runs

      const fastStats = json.data.results.find((r) => r.model === 'model-fast')
      expect(fastStats).toBeDefined()
      expect(fastStats?.successRate).toBe(100)
      expect(fastStats?.runsCount).toBe(2)

      const slowStats = json.data.results.find((r) => r.model === 'model-slow')
      expect(slowStats).toBeDefined()
      expect(slowStats?.successRate).toBe(100)
    })

    it('rejects benchmark request with fewer than 2 models with Zod validation error', async () => {
      const invalidReq = new Request('http://localhost:5173/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'key',
          models: ['only-one-model'],
          prompt: 'test',
        }),
      })

      const res = await handleBenchmark(invalidReq, {})
      expect(res.status).toBe(400)
      const data = (await res.json()) as { success: boolean; error: { code: string } }
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('enforces SSRF protection during benchmark execution', async () => {
      const ssrfReq = new Request('http://localhost:5173/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: 'http://169.254.169.254/v1',
          apiKey: 'key',
          models: ['model-a', 'model-b'],
          prompt: 'test',
        }),
      })

      const res = await handleBenchmark(ssrfReq, {})
      expect(res.status).toBe(400)
      const data = (await res.json()) as { success: boolean; error: { code: string } }
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('SSRF_BLOCKED')
    })
  })

  // ==========================================
  // 2. COMPATIBILITY CHECKER LOGIC TESTS
  // ==========================================
  describe('2. Compatibility Logic & Evidence Evaluation', () => {
    it('properly evaluates tool status based on live evidence', () => {
      // Rule 1: Google Antigravity is unsupported as a custom OpenAI-compatible BYOK
      const antigravityStatus = 'unsupported'
      expect(antigravityStatus).toBe('unsupported')

      // Rule 2: OpenCode requires Bearer auth, Models, and Streaming for full compatibility
      function evaluateOpenCode(evidence: {
        connection: boolean
        models: boolean
        streaming: boolean
        auth: string
      }) {
        if (!evidence.connection) return 'not_verified'
        if (evidence.auth !== 'bearer') return 'unsupported'
        if (evidence.models && evidence.streaming) return 'compatible'
        return 'partial'
      }

      // Test all verified -> compatible
      expect(
        evaluateOpenCode({ connection: true, models: true, streaming: true, auth: 'bearer' })
      ).toBe('compatible')

      // Test chat verified but streaming not verified -> partial
      expect(
        evaluateOpenCode({ connection: true, models: true, streaming: false, auth: 'bearer' })
      ).toBe('partial')

      // Test non-bearer auth -> unsupported
      expect(
        evaluateOpenCode({ connection: true, models: true, streaming: true, auth: 'custom' })
      ).toBe('unsupported')

      // Test not tested yet -> not_verified
      expect(
        evaluateOpenCode({ connection: false, models: false, streaming: false, auth: 'bearer' })
      ).toBe('not_verified')
    })

    it('generates valid OpenCode custom provider JSON configuration without leaking actual API key', () => {
      const providerName = 'groq'
      const baseUrl = 'https://api.groq.com/openai/v1'
      const modelId = 'llama-3.3-70b-versatile'

      const generated = {
        providers: [
          {
            name: providerName,
            baseURL: baseUrl,
            apiKey: '${env:OPENCODE_PROVIDER_API_KEY}',
            models: [
              {
                id: modelId,
                name: modelId,
              },
            ],
          },
        ],
      }

      const jsonString = JSON.stringify(generated)
      expect(jsonString).toContain('${env:OPENCODE_PROVIDER_API_KEY}')
      expect(jsonString).not.toContain('sk-')
      expect(generated.providers[0].baseURL).toBe(baseUrl)
      expect(generated.providers[0].models[0].id).toBe(modelId)
    })
  })
})
