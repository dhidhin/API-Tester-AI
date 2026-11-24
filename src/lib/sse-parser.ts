import type { TokenUsage } from '@/types'

export interface SseChunkEvent {
  delta: string
  reasoning?: string
  index: number
  raw?: unknown
  usage?: TokenUsage
}

export interface SseParserCallbacks {
  onToken: (event: SseChunkEvent) => void
  onError: (err: Error) => void
  onDone: (totalText: string) => void
}

/**
 * Parses a Server-Sent Events ReadableStream response robustly.
 * Handles:
 * - Chunk fragmentation across boundaries
 * - Incomplete lines across buffer reads
 * - Multi-byte UTF-8 split points
 * - Non-standard delta formats (OpenAI, Claude, Ollama, DeepSeek reasoning)
 * - Trailing usage stats in final SSE event
 * - Premature disconnects
 */
export async function parseSseStream(
  response: Response,
  callbacks: SseParserCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const body = response.body
  if (!body) {
    callbacks.onError(new Error('Response body is empty'))
    return
  }

  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: false })

  let buffer = ''
  let accumulatedText = ''
  let chunkIndex = 0

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel('Stream cancelled by user')
        break
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete lines separated by \n or \r\n
      const lines = buffer.split(/\r?\n/)
      // The last line may be incomplete, hold it in buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) {
          // Empty line or comment/ping event (: ping)
          continue
        }

        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trim()

          // Check standard stream terminator
          if (payload === '[DONE]') {
            callbacks.onDone(accumulatedText)
            return
          }

          try {
            const data = JSON.parse(payload) as Record<string, unknown>
            let delta = ''
            let reasoning: string | undefined = undefined

            // 1. OpenAI standard choices
            if (Array.isArray(data.choices) && data.choices.length > 0) {
              const choice = data.choices[0] as Record<string, unknown>
              if (choice.delta && typeof choice.delta === 'object') {
                const deltaObj = choice.delta as Record<string, unknown>
                if (typeof deltaObj.content === 'string') {
                  delta = deltaObj.content
                }
                if (typeof deltaObj.reasoning_content === 'string') {
                  reasoning = deltaObj.reasoning_content
                }
              } else if (typeof choice.text === 'string') {
                delta = choice.text
              }
            }
            // 2. Claude SSE delta format: { type: "content_block_delta", delta: { type: "text_delta", text: "..." } }
            else if (data.delta && typeof data.delta === 'object') {
              const d = data.delta as Record<string, unknown>
              if (typeof d.text === 'string') delta = d.text
            }
            // 3. Ollama direct response field
            else if (typeof data.response === 'string') {
              delta = data.response
            }

            // Extract token usage if included (OpenAI stream_options: { include_usage: true })
            let usage: TokenUsage | undefined = undefined
            if (data.usage && typeof data.usage === 'object') {
              const u = data.usage as Record<string, unknown>
              usage = {
                promptTokens: Number(u.prompt_tokens ?? u.input_tokens ?? 0),
                completionTokens: Number(u.completion_tokens ?? u.output_tokens ?? 0),
                totalTokens: Number(u.total_tokens ?? 0),
              }
            }

            if (delta || reasoning || usage) {
              chunkIndex++
              accumulatedText += delta
              callbacks.onToken({
                delta,
                reasoning,
                index: chunkIndex,
                raw: data,
                usage,
              })
            }
          } catch {
            // Ignore malformed individual JSON chunks and keep consuming stream
          }
        }
      }
    }

    // Flush any remaining line in buffer
    if (buffer.trim()) {
      const trimmed = buffer.trim()
      if (trimmed.startsWith('data:')) {
        const payload = trimmed.slice(5).trim()
        if (payload !== '[DONE]') {
          try {
            const data = JSON.parse(payload) as Record<string, unknown>
            if (Array.isArray(data.choices) && data.choices.length > 0) {
              const choice = data.choices[0] as Record<string, unknown>
              const d = choice.delta as Record<string, unknown> | undefined
              if (typeof d?.content === 'string') {
                accumulatedText += d.content
                callbacks.onToken({ delta: d.content, index: ++chunkIndex, raw: data })
              }
            }
          } catch {
            // ignore
          }
        }
      }
    }

    callbacks.onDone(accumulatedText)
  } catch (err: unknown) {
    if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
      callbacks.onDone(accumulatedText)
      return
    }
    callbacks.onError(err instanceof Error ? err : new Error(String(err)))
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }
}
