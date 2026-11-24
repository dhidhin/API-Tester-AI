// Shared Worker Types

export interface Env {
  ASSETS?: {
    fetch: (request: Request | string) => Promise<Response>
  }
  ENVIRONMENT?: string
}

export type AuthMethod = 'bearer' | 'x-api-key' | 'custom'

export interface AppError {
  code: string
  category?: string
  message: string
  httpStatus?: number
  possibleCauses?: string[]
  recommendations?: string[]
}

export interface WorkerSuccessResponse<T> {
  success: true
  data: T
}

export interface WorkerErrorResponse {
  success: false
  error: AppError
}

export type WorkerResponse<T> = WorkerSuccessResponse<T> | WorkerErrorResponse

export interface TestConnectionData {
  connected: boolean
  latencyMs: number
  httpStatus: number
  endpointTested: string
  modelsCount?: number
  timestamp: string
}

export interface ModelItem {
  id: string
  object?: string
  created?: number
  ownedBy?: string
  contextLength?: number
  status: 'available' | 'deprecated' | 'unavailable'
}

export interface ModelsData {
  models: ModelItem[]
  count: number
  timestamp: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ChatCompletionData {
  content: string
  reasoningContent?: string
  model: string
  latencyMs: number
  httpStatus: number
  tokenUsage?: TokenUsage
  rawResponse?: unknown
  timestamp: string
}
