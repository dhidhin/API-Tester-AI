// Application types

export type AuthMethod = 'bearer' | 'x-api-key' | 'custom'
export type Theme = 'dark' | 'light' | 'system'
export type Language = 'id' | 'en'
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'
export type TestStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled'
export type CompatibilityStatus = 'compatible' | 'partial' | 'unsupported' | 'not_verified'

// Provider / Connection
export interface ProviderConfig {
  name: string
  baseUrl: string
  apiKey: string
  authMethod: AuthMethod
  customAuthHeader?: string
  customHeaders?: Record<string, string>
  modelId?: string
}

export interface ConnectionResult {
  success: boolean
  status: ConnectionStatus
  latencyMs?: number
  httpStatus?: number
  error?: AppError
  timestamp: string
}

// Models
export interface AIModel {
  id: string
  name?: string
  ownedBy?: string
  contextLength?: number
  created?: number
  status?: 'available' | 'deprecated' | 'unavailable'
}

export interface ModelsResult {
  success: boolean
  models: AIModel[]
  error?: AppError
  timestamp: string
}

// Chat
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatParams {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ChatResult {
  success: boolean
  content?: string
  httpStatus?: number
  latencyMs?: number
  tokenUsage?: TokenUsage
  rawResponse?: unknown
  error?: AppError
  timestamp: string
}

// Streaming
export interface StreamChunk {
  delta: string
  index: number
  timestamp: number
}

export interface StreamResult {
  success: boolean
  content: string
  chunks: StreamChunk[]
  ttftMs?: number
  totalDurationMs?: number
  tokenUsage?: TokenUsage
  error?: AppError
  timestamp: string
}

// Benchmark
export interface BenchmarkRun {
  model: string
  runIndex: number
  latencyMs: number
  ttftMs?: number
  success: boolean
  tokenUsage?: TokenUsage
  error?: AppError
}

export interface BenchmarkResult {
  model: string
  runs: BenchmarkRun[]
  avgLatency: number
  minLatency: number
  maxLatency: number
  medianLatency: number
  p95Latency: number
  tokensPerSecond?: number
  successRate: number
  ttftAvg?: number
}

export interface BenchmarkSession {
  id: string
  status: TestStatus
  models: string[]
  results: BenchmarkResult[]
  currentModel?: string
  currentRun?: number
  totalRuns: number
  completedRuns: number
  timestamp: string
}

// Compatibility
export interface CompatibilityCheck {
  feature: string
  status: CompatibilityStatus
  evidence?: string
  note?: string
}

export interface ToolCompatibility {
  tool: string
  toolLabel: string
  status: CompatibilityStatus
  checks: CompatibilityCheck[]
  note?: string
}

export interface CompatibilityReport {
  provider: string
  baseUrl: string
  model?: string
  tools: ToolCompatibility[]
  timestamp: string
}

// Diagnostics
export interface ErrorDiagnostic {
  code: string
  category: string
  message: string
  httpStatus?: number
  possibleCauses: string[]
  recommendations: string[]
  timestamp: string
}

// Error
export interface AppError {
  code: string
  category?: string
  message: string
  httpStatus?: number
  possibleCauses?: string[]
  recommendations?: string[]
}

// Config Generator
export type ConfigTarget = 'opencode' | 'openai-sdk' | 'continue' | 'cline' | 'roocode' | 'generic'

export interface GeneratedConfig {
  target: ConfigTarget
  label: string
  content: string
  format: 'json' | 'jsonc' | 'typescript' | 'yaml' | 'shell'
  filename: string
}

// Reports
export interface TestReport {
  id: string
  providerName?: string
  baseUrl: string
  modelId?: string
  connection?: ConnectionResult
  models?: ModelsResult
  chat?: ChatResult
  stream?: StreamResult
  benchmark?: BenchmarkSession
  compatibility?: CompatibilityReport
  diagnostics?: ErrorDiagnostic[]
  timestamp: string
  version: string
}

// Session
export interface AppSession {
  provider?: ProviderConfig
  connectionResult?: ConnectionResult
  models: AIModel[]
  selectedModel?: string
  chatHistory: ChatMessage[]
  chatResult?: ChatResult
  streamResult?: StreamResult
  benchmarkSession?: BenchmarkSession
  compatibilityReport?: CompatibilityReport
  diagnostics: ErrorDiagnostic[]
  report?: TestReport
}

// API Worker Request/Response types
export interface WorkerTestConnectionRequest {
  baseUrl: string
  apiKey: string
  authType: AuthMethod
  customAuthHeader?: string
}

export interface WorkerModelsRequest {
  baseUrl: string
  apiKey: string
  authType: AuthMethod
  customAuthHeader?: string
}

export interface WorkerChatRequest {
  baseUrl: string
  apiKey: string
  authType: AuthMethod
  customAuthHeader?: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
}

export interface WorkerBenchmarkRequest {
  baseUrl: string
  apiKey: string
  authType: AuthMethod
  customAuthHeader?: string
  models: string[]
  prompt: string
  systemPrompt?: string
  runs: number
  temperature?: number
  maxTokens?: number
}

export interface WorkerDiagnosticsRequest {
  httpStatus?: number
  errorCode?: string
  errorMessage?: string
  endpoint?: string
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
