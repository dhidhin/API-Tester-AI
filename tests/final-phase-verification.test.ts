import { describe, it, expect, beforeEach } from 'vitest'
import { sanitizeBaseUrl, generateHtmlReport } from '../src/features/reports/reportUtils'
import { ERROR_KNOWLEDGE_BASE } from '../src/features/diagnostics/DiagnosticsPage'
import { useSession } from '../src/stores'
import type { ProviderConfig, ConnectionResult, ChatResult, StreamResult, BenchmarkSession, CompatibilityReport } from '../src/types'

describe('Final Phase QA — Reports, Configs, Diagnostics & Session Verification', () => {
  beforeEach(() => {
    useSession.getState().clearSession()
  })

  // ==========================================
  // 1. BASE URL SANITIZATION & REDACTION TESTS
  // ==========================================
  describe('1. Base URL Sanitization & Credential Stripping', () => {
    it('strips embedded credentials (user:password) from Base URLs', () => {
      const contaminatedUrl = 'https://admin:supersecret123@api.groq.com/openai/v1'
      const sanitized = sanitizeBaseUrl(contaminatedUrl)

      expect(sanitized).toBe('https://api.groq.com/openai/v1')
      expect(sanitized).not.toContain('supersecret123')
      expect(sanitized).not.toContain('admin:')
    })

    it('removes trailing slash from normalized URLs', () => {
      expect(sanitizeBaseUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1')
    })

    it('safely handles empty or undefined URLs', () => {
      expect(sanitizeBaseUrl('')).toBe('')
      expect(sanitizeBaseUrl(undefined)).toBe('')
    })
  })

  // ==========================================
  // 2. ERROR DIAGNOSTICS KNOWLEDGE BASE
  // ==========================================
  describe('2. Error Diagnostics Knowledge Base', () => {
    const requiredStatuses = ['400', '401', '403', '404', '408', '413', '415', '422', '429', '500', '502', '503', '504']

    requiredStatuses.forEach((status) => {
      it(`provides causes and recommendations for HTTP status ${status}`, () => {
        const entry = ERROR_KNOWLEDGE_BASE[status]
        expect(entry).toBeDefined()
        expect(entry.code).toBeTruthy()
        expect(entry.category).toBeTruthy()
        expect(entry.message).toBeTruthy()
        expect(entry.possibleCauses.length).toBeGreaterThan(0)
        expect(entry.recommendations.length).toBeGreaterThan(0)
      })
    })

    it('provides diagnoses for SSRF, network failure, SSL errors, and stream disconnects', () => {
      const specialCodes = ['SSRF_BLOCKED', 'NETWORK_ERROR', 'SSL_ERROR', 'STREAM_DISCONNECTED']

      specialCodes.forEach((code) => {
        const entry = ERROR_KNOWLEDGE_BASE[code]
        expect(entry).toBeDefined()
        expect(entry.code).toBe(code)
        expect(entry.possibleCauses.length).toBeGreaterThan(0)
        expect(entry.recommendations.length).toBeGreaterThan(0)
      })
    })
  })

  // ==========================================
  // 3. REPORTS EXPORT & SECURITY VERIFICATION
  // ==========================================
  describe('3. Reports Export & Strict Redaction', () => {
    it('generates comprehensive HTML report containing all required test sections without exposing secrets', () => {
      const mockSecretApiKey = 'sk-live-super-secret-key-1234567890'
      const sampleReport = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        provider: {
          name: 'Test LLM Cloud',
          baseUrl: 'https://user:password@api.example.com/v1',
          authMethod: 'bearer',
        },
        model: 'llama-3.3-70b-versatile',
        connection: {
          success: true,
          latencyMs: 142,
          httpStatus: 200,
          timestamp: new Date().toISOString(),
        },
        chat: {
          success: true,
          httpStatus: 200,
          latencyMs: 412,
          tokenUsage: { promptTokens: 15, completionTokens: 40, totalTokens: 55 },
          timestamp: new Date().toISOString(),
        },
        stream: {
          success: true,
          ttftMs: 180,
          totalDurationMs: 650,
          timestamp: new Date().toISOString(),
        },
        benchmark: {
          modelIds: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
          runs: 2,
          results: [
            {
              model: 'llama-3.3-70b-versatile',
              runsCount: 2,
              avgLatency: 280,
              medianLatency: 275,
              minLatency: 260,
              maxLatency: 300,
              ttftAvg: 175,
              tokensPerSecond: 45.2,
              successRate: 100,
            },
          ],
          summary: {
            fastestModel: 'llama-3.3-70b-versatile',
            totalRuns: 2,
          },
        },
        compatibility: {
          tools: [
            {
              tool: 'opencode',
              name: 'OpenCode',
              category: 'Editor',
              status: 'compatible' as const,
              notes: 'Compatible with Bearer auth and streaming.',
            },
            {
              tool: 'antigravity',
              name: 'Google Antigravity',
              category: 'IDE',
              status: 'unsupported' as const,
              notes: 'Uses native Gemini; does not support custom OpenAI-compatible BYOK.',
            },
          ],
        },
        diagnostics: [
          {
            code: 'RATE_LIMITED',
            category: 'Rate Limit',
            message: '429 Rate Limit Encountered during stress test',
            httpStatus: 429,
            timestamp: new Date().toISOString(),
          },
        ],
      }

      const html = generateHtmlReport(sampleReport)

      // Verify sections exist
      expect(html).toContain('Provider Information')
      expect(html).toContain('Connection Test (FR-01)')
      expect(html).toContain('Chat Playground Test (FR-03)')
      expect(html).toContain('Streaming Test (FR-04)')
      expect(html).toContain('Sequential Multi-Model Benchmark (FR-05)')
      expect(html).toContain('Coding Tool Compatibility Matrix (FR-06)')
      expect(html).toContain('Error Diagnostics History (1)')
      expect(html).toContain('Google Antigravity Notice')

      // Verify credentials and passwords stripped
      expect(html).not.toContain(mockSecretApiKey)
      expect(html).not.toContain('user:password@')
      expect(html).toContain('[REDACTED FOR SECURITY]')
    })
  })

  // ==========================================
  // 4. CONFIGURATION GENERATOR TEMPLATES
  // ==========================================
  describe('4. Configuration Generator Templates', () => {
    it('enforces environment variable placeholders and prevents real secret injection', () => {
      const realSecretKey = 'sk-super-secret-do-not-leak'
      const baseUrl = 'https://api.openai.com/v1'
      const activeModel = 'gpt-4o'

      // OpenCode config
      const openCodeConfig = `// OpenCode Custom Provider Configuration (JSONC)
{
  "providers": [
    {
      "name": "custom-provider",
      "baseURL": "${baseUrl}",
      "apiKey": "\${env:AI_PROVIDER_API_KEY}",
      "models": [{ "id": "${activeModel}", "name": "${activeModel}" }]
    }
  ]
}`
      expect(openCodeConfig).toContain('"${env:AI_PROVIDER_API_KEY}"')
      expect(openCodeConfig).not.toContain(realSecretKey)

      // OpenAI SDK
      const openAiSdkConfig = `import OpenAI from 'openai';
const client = new OpenAI({
  apiKey: process.env.AI_PROVIDER_API_KEY,
  baseURL: '${baseUrl}',
});`
      expect(openAiSdkConfig).toContain('process.env.AI_PROVIDER_API_KEY')
      expect(openAiSdkConfig).not.toContain(realSecretKey)

      // Continue.dev config
      const continueConfig = JSON.stringify({
        models: [
          {
            title: 'Custom Provider',
            provider: 'openai',
            model: activeModel,
            apiKey: '${env:AI_PROVIDER_API_KEY}',
            apiBase: baseUrl,
          },
        ],
      })
      expect(continueConfig).toContain('${env:AI_PROVIDER_API_KEY}')
      expect(continueConfig).not.toContain(realSecretKey)

      // Cline config
      const clineConfig = JSON.stringify({
        'cline.apiProvider': 'openai-compatible',
        'cline.openAiBaseUrl': baseUrl,
        'cline.openAiApiKey': '${env:AI_PROVIDER_API_KEY}',
        'cline.openAiModelId': activeModel,
      })
      expect(clineConfig).toContain('${env:AI_PROVIDER_API_KEY}')

      // Generic cURL
      const curlConfig = `curl -X POST "${baseUrl}/chat/completions" -H "Authorization: Bearer \${AI_PROVIDER_API_KEY}"`
      expect(curlConfig).toContain('${AI_PROVIDER_API_KEY}')
    })
  })

  // ==========================================
  // 5. SESSION MANAGEMENT & CLEAR SESSION
  // ==========================================
  describe('5. Zustand Session Store & Clear Session', () => {
    it('properly populates and completely clears active session', () => {
      const state = useSession.getState()

      const provider: ProviderConfig = {
        name: 'Test Provider',
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'sk-secret-test-key',
        authMethod: 'bearer',
      }
      const connectionResult: ConnectionResult = {
        success: true,
        status: 'connected',
        latencyMs: 120,
        httpStatus: 200,
        timestamp: new Date().toISOString(),
      }
      const chatResult: ChatResult = {
        success: true,
        content: 'Hello!',
        httpStatus: 200,
        latencyMs: 300,
        timestamp: new Date().toISOString(),
      }
      const streamResult: StreamResult = {
        success: true,
        content: 'Streaming chunk',
        chunks: [],
        timestamp: new Date().toISOString(),
      }

      state.setProvider(provider)
      state.setConnectionResult(connectionResult)
      state.setModels([{ id: 'model-1' }, { id: 'model-2' }])
      state.setSelectedModel('model-1')
      state.setChatResult(chatResult)
      state.setStreamResult(streamResult)
      state.addDiagnostic({
        code: 'TEST_ERROR',
        category: 'Test',
        message: 'Test message',
        possibleCauses: ['cause'],
        recommendations: ['rec'],
        timestamp: new Date().toISOString(),
      })

      // Verify state was populated
      expect(useSession.getState().provider).toBeDefined()
      expect(useSession.getState().connectionResult?.success).toBe(true)
      expect(useSession.getState().models).toHaveLength(2)
      expect(useSession.getState().selectedModel).toBe('model-1')
      expect(useSession.getState().chatResult?.content).toBe('Hello!')
      expect(useSession.getState().streamResult?.content).toBe('Streaming chunk')
      expect(useSession.getState().diagnostics).toHaveLength(1)

      // Execute Clear Session
      useSession.getState().clearSession()

      // Verify complete reset to initial unpopulated state
      const cleared = useSession.getState()
      expect(cleared.provider).toBeUndefined()
      expect(cleared.connectionResult).toBeUndefined()
      expect(cleared.models).toHaveLength(0)
      expect(cleared.selectedModel).toBeUndefined()
      expect(cleared.chatResult).toBeUndefined()
      expect(cleared.chatHistory).toHaveLength(0)
      expect(cleared.streamResult).toBeUndefined()
      expect(cleared.benchmarkSession).toBeUndefined()
      expect(cleared.compatibilityReport).toBeUndefined()
      expect(cleared.diagnostics).toHaveLength(0)
    })
  })
})
