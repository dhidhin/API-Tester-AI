import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  executeChatCompletion,
  executeChatStream,
  normalizeChatResponse,
} from '../worker/services/provider-client'
import { handleChatCompletions } from '../worker/routes/chat'
import { handleChatStream } from '../worker/routes/stream'
import { parseSseStream } from '../src/lib/sse-parser'

describe('Chat Playground & Streaming Test — Integration Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================
  // 1. CHAT COMPLETION INTEGRATION TESTS
  // ==========================================
  describe('1. Chat Completion Engine', () => {
    it('executes chat completion with OpenAI standard response format and token usage', async () => {
      const mockResponse = {
        id: 'chatcmpl-test123',
        object: 'chat.completion',
        created: 1715368132,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'An API Gateway is a reverse proxy that sits between clients and microservices.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 18,
          total_tokens: 33,
        },
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await executeChatCompletion({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test-secret',
        authType: 'bearer',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'What is an API Gateway?' }],
        temperature: 0.7,
        maxTokens: 1024,
      })

      expect(result.success).toBe(true)
      expect(result.httpStatus).toBe(200)
      expect(result.data).toBeDefined()
      expect(result.data?.content).toBe(
        'An API Gateway is a reverse proxy that sits between clients and microservices.'
      )
      expect(result.data?.tokenUsage).toEqual({
        promptTokens: 15,
        completionTokens: 18,
        totalTokens: 33,
      })
      expect(result.data?.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('normalizes alternate formats (Claude-like blocks, DeepSeek reasoning, text completion)', () => {
      // 1. Text completion choices[0].text
      const textFormat = {
        choices: [{ text: 'Direct text completion response' }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      }
      expect(normalizeChatResponse(textFormat).content).toBe('Direct text completion response')

      // 2. Claude-like { content: [{ type: "text", text: "Claude response" }] }
      const claudeFormat = {
        content: [{ type: 'text', text: 'Claude response text' }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }
      const normalizedClaude = normalizeChatResponse(claudeFormat)
      expect(normalizedClaude.content).toBe('Claude response text')
      expect(normalizedClaude.tokenUsage?.promptTokens).toBe(10)
      expect(normalizedClaude.tokenUsage?.completionTokens).toBe(20)

      // 3. DeepSeek reasoning_content
      const deepseekFormat = {
        choices: [
          {
            message: {
              content: 'Final Answer',
              reasoning_content: 'Step 1: calculate. Step 2: verify.',
            },
          },
        ],
      }
      const normalizedDeepSeek = normalizeChatResponse(deepseekFormat)
      expect(normalizedDeepSeek.content).toBe('Final Answer')
      expect(normalizedDeepSeek.reasoningContent).toBe('Step 1: calculate. Step 2: verify.')
    })

    it('handles authentication failure (401) with secret redaction', async () => {
      const secretKey = 'sk-sensitive-user-key-777'
      const mock401 = {
        error: {
          message: `Authentication error with API key ${secretKey}`,
          type: 'invalid_request_error',
        },
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mock401), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await executeChatCompletion({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: secretKey,
        authType: 'bearer',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      })

      expect(result.success).toBe(false)
      expect(result.httpStatus).toBe(401)
      expect(result.error?.code).toBe('AUTHENTICATION_FAILED')
      expect(result.error?.message).not.toContain(secretKey)
      expect(result.error?.message).toContain('[REDACTED_API_KEY]')
    })
  })

  // ==========================================
  // 2. STREAMING TEST (SSE) INTEGRATION TESTS
  // ==========================================
  describe('2. Streaming Engine & Robust SSE Parser', () => {
    it('streams multi-chunk Server-Sent Events incrementally and calculates TTFT', async () => {
      const ssePayload = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"!"}}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}\n\n',
        'data: [DONE]\n\n',
      ].join('')

      const mockResponse = new Response(ssePayload, {
        headers: { 'Content-Type': 'text/event-stream' },
      })

      const tokensReceived: string[] = []
      let finalDoneText = ''

      await parseSseStream(mockResponse, {
        onToken: (event) => {
          tokensReceived.push(event.delta)
        },
        onError: (err) => {
          throw err
        },
        onDone: (text) => {
          finalDoneText = text
        },
      })

      expect(tokensReceived).toEqual(['Hello', ' world', '!'])
      expect(finalDoneText).toBe('Hello world!')
    })

    it('handles fragmented / split chunks across stream buffer boundaries without data loss', async () => {
      // Simulate network slicing data lines in half across chunk reads:
      // Chunk 1: "data: {\"choices\":[{\"del"
      // Chunk 2: "ta\":{\"content\":\"Chunked text\"}}]}\n\n"
      // Chunk 3: "data: [DONE]\n\n"
      const chunks = [
        new TextEncoder().encode('data: {"choices":[{"del'),
        new TextEncoder().encode('ta":{"content":"Chunked text"}}]}\n\n'),
        new TextEncoder().encode('data: [DONE]\n\n'),
      ]

      let chunkIndex = 0
      const mockStream = new ReadableStream({
        pull(controller) {
          if (chunkIndex < chunks.length) {
            controller.enqueue(chunks[chunkIndex++])
          } else {
            controller.close()
          }
        },
      })

      const mockResponse = new Response(mockStream, {
        headers: { 'Content-Type': 'text/event-stream' },
      })

      const tokens: string[] = []
      await parseSseStream(mockResponse, {
        onToken: (event) => tokens.push(event.delta),
        onError: (err) => {
          throw err
        },
        onDone: () => {},
      })

      expect(tokens).toEqual(['Chunked text'])
    })

    it('safely skips comments, ping lines, and empty lines', async () => {
      const sseWithPings = [
        ': ping\n\n',
        'data: {"choices":[{"delta":{"content":"Active"}}]}\n\n',
        ': keep-alive\n\n',
        'data: [DONE]\n\n',
      ].join('')

      const mockResponse = new Response(sseWithPings, {
        headers: { 'Content-Type': 'text/event-stream' },
      })

      const tokens: string[] = []
      await parseSseStream(mockResponse, {
        onToken: (event) => tokens.push(event.delta),
        onError: () => {},
        onDone: () => {},
      })

      expect(tokens).toEqual(['Active'])
    })

    it('aborts streaming immediately when AbortController signal triggers', async () => {
      const controller = new AbortController()

      // Infinite stream
      const infiniteStream = new ReadableStream({
        async pull(ctrl) {
          ctrl.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"A"}}]}\n\n'))
          await new Promise((r) => setTimeout(r, 10))
        },
      })

      const mockResponse = new Response(infiniteStream, {
        headers: { 'Content-Type': 'text/event-stream' },
      })

      let tokenCount = 0
      const streamPromise = parseSseStream(
        mockResponse,
        {
          onToken: () => {
            tokenCount++
            if (tokenCount >= 2) {
              controller.abort() // Cancel after 2 tokens
            }
          },
          onError: () => {},
          onDone: () => {},
        },
        controller.signal
      )

      await streamPromise
      expect(tokenCount).toBeGreaterThanOrEqual(2)
      expect(controller.signal.aborted).toBe(true)
    })

    it('returns JSON error response immediately if upstream streaming call fails (e.g. 401)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const streamResponse = await executeChatStream({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'bad-key',
        authType: 'bearer',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'test' }],
      })

      expect(streamResponse.status).toBe(401)
      const data = (await streamResponse.json()) as { success: boolean; error: { code: string } }
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('AUTHENTICATION_FAILED')
    })
  })

  // ==========================================
  // 3. WORKER ROUTE VALIDATION TESTS
  // ==========================================
  describe('3. Worker Route Validation', () => {
    it('validates POST /api/chat/completions payload with Zod', async () => {
      // Missing messages
      const invalidReq = new Request('http://localhost:5173/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'key',
          model: 'gpt-4o',
        }),
      })

      const response = await handleChatCompletions(invalidReq, {})
      expect(response.status).toBe(400)
      const data = (await response.json()) as { success: boolean; error: { code: string } }
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('validates POST /api/chat/stream payload with Zod', async () => {
      // Missing model
      const invalidReq = new Request('http://localhost:5173/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'key',
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })

      const response = await handleChatStream(invalidReq, {})
      expect(response.status).toBe(400)
      const data = (await response.json()) as { success: boolean; error: { code: string } }
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })
})
