import { z } from 'zod'

// Provider Config Schema
export const providerConfigSchema = z.object({
  name: z.string().optional(),
  baseUrl: z
    .string()
    .min(1, 'Base URL is required')
    .url('Must be a valid URL')
    .refine(
      (url) => url.startsWith('https://') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1'),
      'Must use HTTPS (or localhost for development)'
    ),
  apiKey: z.string().min(1, 'API Key is required'),
  authMethod: z.enum(['bearer', 'x-api-key', 'custom']),
  customAuthHeader: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
  modelId: z.string().optional(),
})

export type ProviderConfigInput = z.infer<typeof providerConfigSchema>

// Chat params schema
export const chatParamsSchema = z.object({
  model: z.string().min(1, 'Model is required'),
  systemPrompt: z.string().optional(),
  userPrompt: z.string().min(1, 'Prompt is required'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(32768).default(1024),
  topP: z.number().min(0).max(1).default(1),
  frequencyPenalty: z.number().min(-2).max(2).default(0),
  presencePenalty: z.number().min(-2).max(2).default(0),
})

export type ChatParamsInput = z.infer<typeof chatParamsSchema>

// Benchmark schema
export const benchmarkSchema = z.object({
  models: z.array(z.string().min(1)).min(2, 'Add at least 2 models'),
  prompt: z.string().min(1, 'Prompt is required'),
  systemPrompt: z.string().optional(),
  runs: z.number().int().min(1).max(10).default(3),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(4096).default(256),
})

export type BenchmarkInput = z.infer<typeof benchmarkSchema>

// Diagnostics schema
export const diagnosticsSchema = z.object({
  httpStatus: z.number().int().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  endpoint: z.string().optional(),
})

export type DiagnosticsInput = z.infer<typeof diagnosticsSchema>

// Worker request schemas (for validation on the worker side too)
export const workerTestConnectionSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  authType: z.enum(['bearer', 'x-api-key', 'custom']),
  customAuthHeader: z.string().optional(),
})

export const workerChatSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  authType: z.enum(['bearer', 'x-api-key', 'custom']),
  customAuthHeader: z.string().optional(),
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })
  ),
  temperature: z.number().optional(),
  maxTokens: z.number().int().optional(),
  topP: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  presencePenalty: z.number().optional(),
})
