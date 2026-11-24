import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bug,
  Search,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Copy,
  Check,
  Zap,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession, useToast } from '@/stores'
import type { ErrorDiagnostic, AppError } from '@/types'

const HTTP_STATUS_OPTIONS = [
  { value: '400', label: '400 Bad Request' },
  { value: '401', label: '401 Unauthorized' },
  { value: '403', label: '403 Forbidden' },
  { value: '404', label: '404 Not Found' },
  { value: '408', label: '408 Request Timeout' },
  { value: '413', label: '413 Payload Too Large' },
  { value: '415', label: '415 Unsupported Media Type' },
  { value: '422', label: '422 Unprocessable Entity' },
  { value: '429', label: '429 Rate Limit' },
  { value: '500', label: '500 Internal Server Error' },
  { value: '502', label: '502 Bad Gateway' },
  { value: '503', label: '503 Service Unavailable' },
  { value: '504', label: '504 Gateway Timeout' },
]

export const ERROR_KNOWLEDGE_BASE: Record<string, Omit<ErrorDiagnostic, 'timestamp'>> = {
  '400': {
    code: 'BAD_REQUEST',
    category: 'Request Error',
    message: '400 Bad Request — Invalid request parameters or payload formatting.',
    httpStatus: 400,
    possibleCauses: [
      'Malformed JSON syntax in request body.',
      'Unsupported generation parameters (e.g. temperature out of range 0.0-2.0 or negative max_tokens).',
      'System prompt not supported by this model architecture.',
      'Missing required fields such as "model" or "messages".',
    ],
    recommendations: [
      'Validate JSON structure using a linter before submitting.',
      'Ensure temperature is between 0.0 and 2.0 and max_tokens is a positive integer.',
      'Check if the provider requires a specific parameter schema (e.g. max_completion_tokens vs max_tokens).',
      'Inspect Raw JSON Viewer in Chat Playground for validation messages.',
    ],
  },
  '401': {
    code: 'AUTHENTICATION_FAILED',
    category: 'Authentication Error',
    message: '401 Unauthorized — Authentication failed or credential rejected.',
    httpStatus: 401,
    possibleCauses: [
      'Invalid, inactive, or expired API Key.',
      'Incorrect Authentication Method (e.g. Provider expects Bearer Token but X-API-Key was sent, or vice-versa).',
      'API Key was generated in a different organization or workspace.',
      'Provider account is pending email confirmation or credit activation.',
    ],
    recommendations: [
      'Double check your API Key in the provider dashboard and generate a fresh key.',
      'Switch between "Bearer Token" and "X-API-Key" in the Connection Settings.',
      'Ensure no extra whitespace or hidden characters are copied into the API Key input.',
      'Verify billing status on your provider portal.',
    ],
  },
  '403': {
    code: 'FORBIDDEN',
    category: 'Authorization Error',
    message: '403 Forbidden — Access denied or insufficient privileges.',
    httpStatus: 403,
    possibleCauses: [
      'API Key lacks permission scopes for the requested model (e.g., GPT-4 tier vs GPT-3.5 tier).',
      'IP address restriction or geographic region blocking by the provider.',
      'Organization account credit balance is zero or below minimum threshold.',
      'Model requires special access approval or waitlist onboarding.',
    ],
    recommendations: [
      'Check organization permissions and model access in provider dashboard.',
      'Verify that your account has available prepaid balance or active subscription.',
      'Check if provider enforces IP whitelisting on API keys.',
      'Try selecting a standard baseline model first.',
    ],
  },
  '404': {
    code: 'NOT_FOUND',
    category: 'Endpoint Error',
    message: '404 Not Found — Base URL or Model ID not found.',
    httpStatus: 404,
    possibleCauses: [
      'Base URL path is incorrect or missing the API version suffix (e.g., missing "/v1").',
      'Model ID does not exist, is misspelled, or has been decommissioned by the provider.',
      'Endpoint path differs from standard OpenAI format (e.g. Anthropic native vs OpenAI-compatible proxy).',
    ],
    recommendations: [
      'Ensure the Base URL ends with "/v1" (e.g., "https://api.openai.com/v1").',
      'Run Model Discovery to fetch active model IDs directly from the provider.',
      'If using Ollama or vLLM, verify the local server is running and the model has been pulled.',
    ],
  },
  '408': {
    code: 'REQUEST_TIMEOUT',
    category: 'Timeout Error',
    message: '408 Request Timeout — Provider took too long to acknowledge the request.',
    httpStatus: 408,
    possibleCauses: [
      'Provider backend is overloaded or experiencing cold-start delays.',
      'Network connection between edge proxy and provider is degraded.',
    ],
    recommendations: [
      'Retry after 5-10 seconds.',
      'Switch to a smaller or distilled model with lower cold-start latency.',
      'Verify the provider server status page.',
    ],
  },
  '413': {
    code: 'PAYLOAD_TOO_LARGE',
    category: 'Payload Error',
    message: '413 Payload Too Large — Prompt exceeds maximum allowed request size.',
    httpStatus: 413,
    possibleCauses: [
      'Prompt text or message history exceeds provider HTTP body limit.',
      'Context window of the target model exceeded by conversation history.',
    ],
    recommendations: [
      'Shorten user prompt or truncate system message.',
      'Clear chat history or benchmark prompt size.',
      'Select a model with a larger context window (e.g., 32k, 128k, or 1M context).',
    ],
  },
  '415': {
    code: 'UNSUPPORTED_MEDIA_TYPE',
    category: 'Header Error',
    message: '415 Unsupported Media Type — Content-Type header mismatch.',
    httpStatus: 415,
    possibleCauses: [
      'Provider expects "Content-Type: application/json" but another type was received.',
    ],
    recommendations: [
      'Ensure request headers include "Content-Type: application/json".',
      'Verify custom headers configured in connection settings do not override Content-Type with invalid media types.',
    ],
  },
  '422': {
    code: 'UNPROCESSABLE_ENTITY',
    category: 'Schema Validation Error',
    message: '422 Unprocessable Entity — Request syntax is valid but semantic parameters failed validation.',
    httpStatus: 422,
    possibleCauses: [
      'Model parameter values violate provider business logic (e.g. top_p=0 with temperature=0).',
      'Unsupported tool calling or response_format schema requested.',
    ],
    recommendations: [
      'Reset temperature and top_p to default values (0.7 and 1.0).',
      'Remove proprietary fields not part of the standard OpenAI schema.',
    ],
  },
  '429': {
    code: 'RATE_LIMITED',
    category: 'Rate Limit Error',
    message: '429 Too Many Requests — Rate limit or token quota exceeded.',
    httpStatus: 429,
    possibleCauses: [
      'Requests per minute (RPM) or tokens per minute (TPM) limit reached on provider tier.',
      'Free tier burst limit exceeded.',
      'Shared IP rate limit triggered.',
    ],
    recommendations: [
      'Reduce benchmark repetitions and ensure sequential execution is enabled.',
      'Wait 30-60 seconds for rate limit window to slide.',
      'Upgrade API tier or increase quotas in provider console.',
      'Implement exponential backoff retry policy.',
    ],
  },
  '500': {
    code: 'INTERNAL_SERVER_ERROR',
    category: 'Provider Error',
    message: '500 Internal Server Error — Upstream provider encountered an unexpected fault.',
    httpStatus: 500,
    possibleCauses: [
      'Internal engine crash or GPU driver fault in the provider cluster.',
      'Uncaught exception in provider custom inference proxy.',
    ],
    recommendations: [
      'Wait a moment and retry with a simpler prompt.',
      'Switch to an alternate model or fallback provider.',
      'Consult provider status page or community channels.',
    ],
  },
  '502': {
    code: 'BAD_GATEWAY',
    category: 'Network Error',
    message: '502 Bad Gateway — Reverse proxy or load balancer cannot reach upstream engine.',
    httpStatus: 502,
    possibleCauses: [
      'Target LLM server (vLLM, Ollama, TGI) process crashed or stopped listening.',
      'Reverse proxy (NGINX/Cloudflare/Caddy) received an invalid response from upstream.',
    ],
    recommendations: [
      'If self-hosting, check "docker logs" or systemd service for inference engine.',
      'Verify port routing and proxy configuration on the server host.',
    ],
  },
  '503': {
    code: 'SERVICE_UNAVAILABLE',
    category: 'Provider Error',
    message: '503 Service Unavailable — Provider is under scheduled maintenance or overloaded.',
    httpStatus: 503,
    possibleCauses: [
      'Provider data center maintenance.',
      'High traffic surge causing server capacity degradation.',
    ],
    recommendations: [
      'Implement circuit breaker and fallback endpoints in your client.',
      'Wait for scheduled maintenance window to complete.',
    ],
  },
  '504': {
    code: 'GATEWAY_TIMEOUT',
    category: 'Timeout Error',
    message: '504 Gateway Timeout — Gateway server timed out waiting for upstream inference.',
    httpStatus: 504,
    possibleCauses: [
      'Inference takes longer than the gateway timeout threshold (e.g. 30s or 60s proxy limit).',
      'Target model is cold-loading into VRAM.',
      'High max_tokens requested on a slow GPU.',
    ],
    recommendations: [
      'Reduce Max Tokens to 256 or 512 for faster responses.',
      'Use Streaming Test instead of Non-streaming to stream tokens immediately.',
      'Increase proxy timeout setting on reverse proxy or Cloudflare Worker if self-hosted.',
    ],
  },
  SSRF_BLOCKED: {
    code: 'SSRF_BLOCKED',
    category: 'Security Defense',
    message: 'Security Defense — Target URL was blocked to prevent Server-Side Request Forgery.',
    httpStatus: 400,
    possibleCauses: [
      'URL targets private IPv4 address (10.x, 172.16-31.x, 192.168.x).',
      'URL targets loopback address (127.0.0.1, localhost).',
      'URL targets cloud metadata service (169.254.169.254 or 100.100.100.200).',
      'URL targets internal domains (.internal, .local).',
    ],
    recommendations: [
      'Use a publicly routable HTTPS Base URL for external AI providers.',
      'If testing local models (Ollama/LM Studio), use a secure tunneling proxy or domain.',
      'Never attempt to query internal server metadata endpoints.',
    ],
  },
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    category: 'Network Error',
    message: 'Network Failure — Unable to resolve domain or establish TCP handshake.',
    httpStatus: 0,
    possibleCauses: [
      'DNS resolution failed (host domain does not exist or has typo).',
      'Port blocked by firewall or network router.',
      'Upstream server offline.',
    ],
    recommendations: [
      'Verify spelling of host domain in Base URL.',
      'Test connectivity via cURL or ping in your terminal.',
      'Ensure standard ports (443/80) are open.',
    ],
  },
  SSL_ERROR: {
    code: 'SSL_ERROR',
    category: 'TLS / Security Error',
    message: 'SSL/TLS Handshake Error — Certificate invalid, expired, or untrusted.',
    httpStatus: 0,
    possibleCauses: [
      'Self-signed certificate on private model server without trusted root CA.',
      'Expired SSL certificate on provider domain.',
      'Host name mismatch on TLS certificate.',
    ],
    recommendations: [
      'Ensure provider domain has a valid, unexpired Let\'s Encrypt or commercial SSL certificate.',
      'Verify system time is properly synchronized.',
    ],
  },
  STREAM_DISCONNECTED: {
    code: 'STREAM_DISCONNECTED',
    category: 'Streaming Error',
    message: 'SSE Stream Disconnected — Server-Sent Events stream terminated unexpectedly.',
    httpStatus: 0,
    possibleCauses: [
      'Network timeout dropped the HTTP keep-alive connection.',
      'Provider inference process crashed midway through response.',
      'Middle proxy buffer limit exceeded.',
    ],
    recommendations: [
      'Verify that upstream proxy supports SSE streaming with zero buffering (e.g. X-Accel-Buffering: no).',
      'Test non-streaming Chat Playground to confirm base inference works.',
    ],
  },
}

export function DiagnosticsPage() {
  const { t } = useTranslation()
  const { diagnostics, addDiagnostic, clearDiagnostics, connectionResult, chatResult, streamResult } = useSession()
  const { success } = useToast()

  const [httpStatus, setHttpStatus] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [searchFilter, setSearchFilter] = useState('')
  const [currentDiag, setCurrentDiag] = useState<ErrorDiagnostic | null>(null)
  const [copied, setCopied] = useState(false)

  // Find recent errors in active session
  const latestSessionError: { source: string; error: AppError } | null = (() => {
    if (chatResult?.error) return { source: 'Chat Playground', error: chatResult.error }
    if (streamResult?.error) return { source: 'Streaming Test', error: streamResult.error }
    if (connectionResult?.error) return { source: 'Connection Engine', error: connectionResult.error }
    return null
  })()

  function handleImportSessionError() {
    if (!latestSessionError) return
    const err = latestSessionError.error
    const statusStr = err.httpStatus ? String(err.httpStatus) : ''
    setHttpStatus(statusStr)
    setErrorCode(err.code || '')
    setErrorMessage(err.message || '')

    // Analyze immediately
    triggerAnalysis(statusStr, err.code, err.message)
    success(`Imported error from ${latestSessionError.source}`)
  }

  function handleSelectPreset(key: string) {
    const entry = ERROR_KNOWLEDGE_BASE[key]
    if (!entry) return
    const statusStr = entry.httpStatus ? String(entry.httpStatus) : ''
    setHttpStatus(statusStr)
    setErrorCode(entry.code)
    setErrorMessage(entry.message)
    triggerAnalysis(statusStr, entry.code, entry.message)
  }

  function triggerAnalysis(statusKey: string, codeInput: string, messageInput: string) {
    const statusNum = parseInt(statusKey, 10)
    // Check by status key first, then by code key
    const knowledge = ERROR_KNOWLEDGE_BASE[statusKey] || ERROR_KNOWLEDGE_BASE[codeInput]

    const diagnostic: ErrorDiagnostic = knowledge
      ? { ...knowledge, timestamp: new Date().toISOString() }
      : {
          code: codeInput || (statusKey ? `HTTP_${statusKey}` : 'UNKNOWN_ERROR'),
          category: 'Uncategorized Error',
          message: messageInput || (statusKey ? `HTTP ${statusKey} Error` : 'Unknown Error encountered'),
          httpStatus: isNaN(statusNum) ? undefined : statusNum,
          possibleCauses: [
            'The error code or status is not explicitly mapped in standard knowledge base.',
            'Custom provider-specific error response returned.',
          ],
          recommendations: [
            'Inspect the Raw JSON Viewer in the Playground for upstream error body details.',
            'Verify provider documentation for custom response structures.',
            'Check Base URL and model availability.',
          ],
          timestamp: new Date().toISOString(),
        }

    setCurrentDiag(diagnostic)
    addDiagnostic(diagnostic)
  }

  function handleAnalyze() {
    triggerAnalysis(httpStatus, errorCode, errorMessage)
  }

  const handleClearHistory = () => {
    clearDiagnostics()
    success('Diagnostics history cleared')
  }

  const handleCopyDiagnostic = () => {
    if (!currentDiag) return
    const text = `API Tester AI Diagnostic Report
Code: ${currentDiag.code}
Category: ${currentDiag.category}
Status: ${currentDiag.httpStatus ?? 'N/A'}
Message: ${currentDiag.message}

Possible Causes:
${currentDiag.possibleCauses.map((c) => `- ${c}`).join('\n')}

Recommendations:
${currentDiag.recommendations.map((r) => `- ${r}`).join('\n')}
`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    success('Diagnostic details copied to clipboard')
  }

  const filteredHistory = diagnostics.filter((d) => {
    if (!searchFilter.trim()) return true
    const q = searchFilter.toLowerCase()
    return (
      d.code.toLowerCase().includes(q) ||
      d.message.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      (d.httpStatus && String(d.httpStatus).includes(q))
    )
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('diagnostics.title')}
        description={t('diagnostics.description')}
      />

      {/* Quick session error alert banner */}
      {latestSessionError && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold">
                Recent Error Detected from {latestSessionError.source}
              </p>
              <p className="text-xs text-amber-300/80 font-mono truncate max-w-lg">
                [{latestSessionError.error.code}] {latestSessionError.error.message}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleImportSessionError}
            className="border-amber-500/40 text-amber-300 hover:bg-amber-500/20 gap-1.5 shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Import & Analyze Now
          </Button>
        </div>
      )}

      {/* Preset Error Quick Access */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Common Error Scenarios Knowledge Base
        </Label>
        <div className="flex flex-wrap gap-2">
          {[
            { key: '401', label: '401 Invalid API Key', badge: 'Auth' },
            { key: '403', label: '403 Forbidden Access', badge: 'Tier' },
            { key: '404', label: '404 URL / Model Missing', badge: 'Route' },
            { key: '429', label: '429 Rate Limit Exceeded', badge: 'Quota' },
            { key: '504', label: '504 Gateway Timeout', badge: 'Timeout' },
            { key: 'SSRF_BLOCKED', label: 'SSRF Blocked', badge: 'Security' },
            { key: 'NETWORK_ERROR', label: 'Network / DNS Failure', badge: 'Network' },
            { key: 'STREAM_DISCONNECTED', label: 'SSE Stream Dropped', badge: 'Stream' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => handleSelectPreset(item.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card/60 hover:bg-primary/10 hover:border-primary/40 text-xs text-foreground transition-all duration-150"
            >
              <Zap className="h-3 w-3 text-cyan-400" />
              <span>{item.label}</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1 border-muted-foreground/30">
                {item.badge}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bug className="h-4 w-4 text-primary" />
              {t('diagnostics.analyze')}
            </CardTitle>
            <CardDescription>
              Select an HTTP status code or paste an error message to identify root causes and remediation steps.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('diagnostics.httpStatus')}</Label>
              <Select value={httpStatus} onValueChange={setHttpStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select HTTP status code..." />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t('diagnostics.errorCode')}</Label>
              <Input
                value={errorCode}
                onChange={(e) => setErrorCode(e.target.value)}
                placeholder="e.g. AUTHENTICATION_FAILED, SSRF_BLOCKED, RATE_LIMITED"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('diagnostics.errorMessage')}</Label>
              <Textarea
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
                placeholder="Paste the raw error message or provider response here..."
                rows={3}
                className="text-sm"
              />
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!httpStatus && !errorCode && !errorMessage}
              className="w-full gap-2"
            >
              <Search className="h-4 w-4" />
              {t('diagnostics.analyze')}
            </Button>
          </CardContent>
        </Card>

        {/* Diagnostic Result Card */}
        <Card className="card-glow flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-cyan-400" />
                Root Cause Analysis
              </CardTitle>
              {currentDiag && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyDiagnostic}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            {!currentDiag ? (
              <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
                <Bug className="h-8 w-8 mx-auto opacity-30 text-muted-foreground" />
                <p>{t('diagnostics.noError')}</p>
                <p className="text-xs text-muted-foreground/70">
                  Select a preset above or enter an error to trigger automatic diagnosis.
                </p>
              </div>
            ) : (
              <div className="space-y-5 animate-fade-in">
                {/* Header message */}
                <div className="flex items-start gap-3 p-3.5 rounded-lg bg-card border border-border/80">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm leading-relaxed">
                      {currentDiag.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="cyan" className="text-xs font-mono">
                        {currentDiag.code}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {currentDiag.category}
                      </Badge>
                      {currentDiag.httpStatus ? (
                        <Badge variant="secondary" className="text-xs font-mono">
                          HTTP {currentDiag.httpStatus}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Possible Causes */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-blue-400" />
                    {t('diagnostics.possibleCauses')}
                  </p>
                  <ul className="space-y-1.5 bg-muted/20 p-3 rounded-lg border border-border/50">
                    {currentDiag.possibleCauses.map((cause, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-cyan-400 font-bold shrink-0">•</span>
                        <span>{cause}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommendations */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    {t('diagnostics.recommendations')}
                  </p>
                  <ul className="space-y-1.5 bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/20">
                    {currentDiag.recommendations.map((rec, i) => (
                      <li key={i} className="text-xs text-foreground/90 flex items-start gap-2">
                        <ArrowRight className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Diagnostics History */}
      {diagnostics.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  {t('diagnostics.history')}
                  <Badge variant="secondary" className="text-xs font-mono">
                    {diagnostics.length}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  (Click any entry to view full diagnostic)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter history..."
                  className="h-8 text-xs w-full sm:w-48"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearHistory}
                  className="gap-1 text-xs text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('diagnostics.clearHistory')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredHistory.map((d, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-2.5 rounded-lg border border-border/50 bg-card hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => setCurrentDiag(d)}
                >
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {d.message}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {d.category}
                      </Badge>
                      {d.httpStatus ? (
                        <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                          HTTP {d.httpStatus}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(d.timestamp).toLocaleString()} • Code: <span className="font-mono">{d.code}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
