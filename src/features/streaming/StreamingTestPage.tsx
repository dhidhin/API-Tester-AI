import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Zap,
  Play,
  Square,
  Clock,
  Layers,
  Loader2,
  Copy,
  Check,
  ShieldAlert,
  Sliders,
  Trash2,
  Activity,
  Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBanner } from '@/components/common/StatusBanner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { parseSseStream, type SseChunkEvent } from '@/lib/sse-parser'
import { useSession, useToast } from '@/stores'
import { formatMs, copyToClipboard } from '@/lib/utils'
import type { StreamResult, AppError } from '@/types'

export function StreamingTestPage() {
  const { t } = useTranslation()
  const { provider, models, selectedModel, setSelectedModel, addDiagnostic, setStreamResult: setGlobalStreamResult } = useSession()
  const { success: showSuccess, error: showError } = useToast()

  const [activeModel, setActiveModel] = useState<string>(
    selectedModel || (models.length > 0 ? models[0].id : 'gpt-4o')
  )
  const [customModelInput, setCustomModelInput] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.')
  const [userPrompt, setUserPrompt] = useState('Count from 1 to 15, saying one number per line with a short friendly note.')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamOutput, setStreamOutput] = useState('')
  const [streamReasoning, setStreamReasoning] = useState('')
  const [ttftMs, setTtftMs] = useState<number | undefined>(undefined)
  const [totalDurationMs, setTotalDurationMs] = useState<number | undefined>(undefined)
  const [chunkCount, setChunkCount] = useState(0)
  const [streamResult, setStreamResult] = useState<Partial<StreamResult> | null>(null)
  const [copied, setCopied] = useState(false)
  const [recentChunks, setRecentChunks] = useState<string[]>([])

  const abortControllerRef = useRef<AbortController | null>(null)
  const startTimeRef = useRef<number>(0)
  const firstTokenReceivedRef = useRef<boolean>(false)

  const isConfigured = Boolean(provider?.baseUrl && provider?.apiKey)

  function handleModelChange(val: string) {
    setActiveModel(val)
    setSelectedModel(val)
  }

  function handleApplyCustomModel() {
    const val = customModelInput.trim()
    if (!val) return
    setActiveModel(val)
    setSelectedModel(val)
    setCustomModelInput('')
    showSuccess('Model Selected', `Active model set to: ${val}`)
  }

  async function handleStartStream() {
    if (!isConfigured || !activeModel || !userPrompt.trim()) return

    setIsStreaming(true)
    setStreamOutput('')
    setStreamReasoning('')
    setTtftMs(undefined)
    setTotalDurationMs(undefined)
    setChunkCount(0)
    setRecentChunks([])
    setStreamResult(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    startTimeRef.current = Date.now()
    firstTokenReceivedRef.current = false

    try {
      const messages = []
      if (systemPrompt.trim()) {
        messages.push({ role: 'system' as const, content: systemPrompt.trim() })
      }
      messages.push({ role: 'user' as const, content: userPrompt.trim() })

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          baseUrl: provider!.baseUrl,
          apiKey: provider!.apiKey,
          authType: provider!.authMethod,
          customAuthHeader: provider!.customAuthHeader,
          model: activeModel,
          messages,
          temperature,
          maxTokens,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        // Stream failed before starting (e.g. 401, 404, 429)
        let errorData: { error?: AppError } = {}
        try {
          errorData = await response.json()
        } catch {
          // ignore
        }

        const error: AppError = errorData.error || {
          code: `HTTP_${response.status}`,
          message: `Stream request rejected with status ${response.status}`,
          httpStatus: response.status,
        }

        const streamRes: StreamResult = {
          success: false,
          content: '',
          chunks: [],
          error,
          timestamp: new Date().toISOString(),
        }
        setStreamResult(streamRes)
        setGlobalStreamResult(streamRes)

        addDiagnostic({
          code: error.code,
          category: error.category || 'Streaming Error',
          message: error.message,
          httpStatus: error.httpStatus,
          possibleCauses: error.possibleCauses || ['Provider rejected the streaming request.'],
          recommendations: error.recommendations || ['Verify that this provider supports SSE streaming on /chat/completions.'],
          timestamp: new Date().toISOString(),
        })

        showError(`Stream Error (${error.code})`, error.message)
        setIsStreaming(false)
        return
      }

      // Parse the live SSE stream incrementally!
      await parseSseStream(
        response,
        {
          onToken: (event: SseChunkEvent) => {
            // Measure TTFT on first token received
            if (!firstTokenReceivedRef.current && (event.delta || event.reasoning)) {
              firstTokenReceivedRef.current = true
              const ttft = Date.now() - startTimeRef.current
              setTtftMs(ttft)
            }

            if (event.delta) {
              setStreamOutput((prev) => prev + event.delta)
              setRecentChunks((prev) => [event.delta, ...prev.slice(0, 7)])
            }

            if (event.reasoning) {
              setStreamReasoning((prev) => prev + event.reasoning)
            }

            setChunkCount(event.index)
          },
          onError: (err: Error) => {
            const duration = Date.now() - startTimeRef.current
            setTotalDurationMs(duration)
            const streamRes: StreamResult = {
              success: false,
              content: '',
              chunks: [],
              totalDurationMs: duration,
              error: {
                code: 'STREAM_DISCONNECTED',
                message: err.message,
              },
              timestamp: new Date().toISOString(),
            }
            setStreamResult(streamRes)
            setGlobalStreamResult(streamRes)
            showError('Stream Interrupted', err.message)
          },
          onDone: (totalText: string) => {
            const duration = Date.now() - startTimeRef.current
            setTotalDurationMs(duration)
            const streamRes: StreamResult = {
              success: true,
              content: totalText,
              chunks: [],
              totalDurationMs: duration,
              timestamp: new Date().toISOString(),
            }
            setStreamResult(streamRes)
            setGlobalStreamResult(streamRes)
            showSuccess('Stream Finished', `Completed in ${formatMs(duration)}`)
          },
        },
        controller.signal
      )
    } catch (err: unknown) {
      const duration = Date.now() - startTimeRef.current
      setTotalDurationMs(duration)

      if (err instanceof Error && err.name === 'AbortError') {
        showSuccess('Cancelled', 'Streaming was halted by user.')
        return
      }

      const msg = err instanceof Error ? err.message : 'Network error'
      setStreamResult({
        success: false,
        totalDurationMs: duration,
        error: { code: 'NETWORK_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      })
      showError('Stream Error', msg)
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }

  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsStreaming(false)
      const duration = Date.now() - startTimeRef.current
      setTotalDurationMs(duration)
      showSuccess('Stream Stopped', 'Disconnected from streaming endpoint.')
    }
  }

  async function handleCopyStream() {
    if (!streamOutput) return
    await copyToClipboard(streamOutput)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('streaming.title')}
        description={t('streaming.description')}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="cyan" className="font-mono text-xs px-2.5 py-1">
              Active: {activeModel}
            </Badge>
          </div>
        }
      />

      {!isConfigured && (
        <StatusBanner
          variant="warning"
          message="No active provider configured. Please configure your Base URL and API Key in the API Playground."
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="card-glow border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-400" />
                Streaming Controls
              </CardTitle>
              <CardDescription className="text-xs">
                Tests Server-Sent Events (SSE) streaming compatibility
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Model Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Model</Label>
                {models.length > 0 ? (
                  <Select value={activeModel} onValueChange={handleModelChange}>
                    <SelectTrigger className="h-9 font-mono text-xs">
                      <SelectValue placeholder="Select model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                          {m.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={activeModel}
                    onChange={(e) => setActiveModel(e.target.value)}
                    placeholder="e.g. gpt-4o, claude-3-5-sonnet"
                    className="font-mono text-xs h-9"
                  />
                )}

                {/* Custom Model input */}
                <div className="flex gap-2 pt-1">
                  <Input
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    placeholder="Or type custom Model ID..."
                    className="font-mono text-xs h-8 flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyCustomModel()}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApplyCustomModel}
                    disabled={!customModelInput.trim()}
                    className="h-8 text-xs"
                  >
                    Apply
                  </Button>
                </div>
              </div>

              {/* System Prompt */}
              <div className="space-y-1.5">
                <Label htmlFor="streamSystem" className="text-xs font-medium">
                  {t('chat.systemPrompt')}{' '}
                  <span className="text-muted-foreground font-normal">({t('common.optional')})</span>
                </Label>
                <Textarea
                  id="streamSystem"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="System instructions..."
                  rows={2}
                  className="text-xs resize-none font-mono"
                />
              </div>

              {/* User Prompt */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="streamUser" className="text-xs font-medium">
                    {t('chat.userPrompt')} <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">{userPrompt.length} chars</span>
                </div>
                <Textarea
                  id="streamUser"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Enter prompt to stream..."
                  rows={4}
                  className="text-sm font-sans"
                />
              </div>

              {/* Parameters */}
              <div className="space-y-3 pt-1 border-t border-border">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label className="text-xs">Temperature</Label>
                    <span className="font-mono text-primary font-medium">{temperature.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[temperature]}
                    min={0}
                    max={2}
                    step={0.05}
                    onValueChange={([v]) => setTemperature(Number(v.toFixed(2)))}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label className="text-xs">Max Tokens</Label>
                    <span className="font-mono text-primary font-medium">{maxTokens}</span>
                  </div>
                  <Slider
                    value={[maxTokens]}
                    min={64}
                    max={4096}
                    step={64}
                    onValueChange={([v]) => setMaxTokens(v)}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                {isStreaming ? (
                  <Button
                    variant="destructive"
                    onClick={handleStop}
                    className="w-full gap-2 h-10 shadow-md animate-pulse"
                  >
                    <Square className="h-4 w-4 fill-current" />
                    {t('streaming.stopStream')}
                  </Button>
                ) : (
                  <Button
                    onClick={handleStartStream}
                    disabled={!isConfigured || !activeModel || !userPrompt.trim()}
                    className="w-full gap-2 h-10 shadow-md shadow-primary/10"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    {t('streaming.startStream')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Real-Time Stream Performance Telemetry */}
          {(isStreaming || streamResult || ttftMs !== undefined) && (
            <Card className="card-glow border-border">
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-royal-400" />
                    Streaming Telemetry
                  </span>
                  {isStreaming ? (
                    <Badge variant="cyan" className="animate-pulse text-[10px]">
                      Streaming Live
                    </Badge>
                  ) : streamResult?.success ? (
                    <Badge variant="success" className="text-[10px]">
                      Complete
                    </Badge>
                  ) : streamResult?.error ? (
                    <Badge variant="destructive" className="text-[10px]">
                      Failed
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  {/* TTFT */}
                  <div className="rounded-lg bg-muted/40 p-2 border border-border">
                    <span className="text-[10px] text-muted-foreground block">TTFT</span>
                    <span className="text-sm font-mono font-semibold text-cyan-400 mt-0.5 block">
                      {ttftMs !== undefined ? formatMs(ttftMs) : 'Waiting...'}
                    </span>
                  </div>

                  {/* Chunks */}
                  <div className="rounded-lg bg-muted/40 p-2 border border-border">
                    <span className="text-[10px] text-muted-foreground block">Chunks</span>
                    <span className="text-sm font-mono font-semibold text-foreground mt-0.5 block">
                      {chunkCount}
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="rounded-lg bg-muted/40 p-2 border border-border">
                    <span className="text-[10px] text-muted-foreground block">Duration</span>
                    <span className="text-sm font-mono font-semibold text-foreground mt-0.5 block">
                      {totalDurationMs !== undefined ? formatMs(totalDurationMs) : 'In progress...'}
                    </span>
                  </div>
                </div>

                {/* Live chunk preview tags */}
                {recentChunks.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Recent Chunk Deltas:</span>
                    <div className="flex flex-wrap gap-1">
                      {recentChunks.map((chunk, i) => (
                        <span
                          key={i}
                          className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border truncate max-w-[120px]"
                        >
                          {JSON.stringify(chunk)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Live Output Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="card-glow border-border min-h-[460px] flex flex-col">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <CardTitle className="text-base">{t('streaming.output')}</CardTitle>
                  {isStreaming && (
                    <span className="flex items-center gap-1 text-xs text-cyan-400 font-mono">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Receiving tokens...
                    </span>
                  )}
                </div>

                {streamOutput && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyStream}
                    className="h-7 text-xs gap-1"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? t('common.copied') : t('common.copy')}
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-4 flex flex-col">
              {!streamOutput && !isStreaming ? (
                <div className="my-auto text-center py-20 text-muted-foreground text-sm space-y-2">
                  <Zap className="h-10 w-10 mx-auto opacity-30 text-yellow-400" />
                  <p>{t('streaming.noOutput')}</p>
                  <p className="text-xs text-muted-foreground/80 max-w-sm mx-auto">
                    Click <strong>Start Stream</strong> to initiate a real-time Server-Sent Events session with token-by-token rendering.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col space-y-3">
                  {/* Reasoning block if present (e.g. DeepSeek R1) */}
                  {streamReasoning && (
                    <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-xs text-amber-300 font-mono whitespace-pre-wrap max-h-[140px] overflow-y-auto">
                      <span className="font-semibold block mb-1">Reasoning Process:</span>
                      {streamReasoning}
                    </div>
                  )}

                  {/* Main Incremental Response View */}
                  <div className="flex-1 rounded-lg bg-muted/40 p-4 text-sm font-sans whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[520px] border border-border selection:bg-primary/20">
                    {streamOutput}
                    {isStreaming && (
                      <span className="inline-block w-2 h-4 bg-primary ml-0.5 align-middle animate-pulse" />
                    )}
                  </div>

                  {/* Footer telemetry */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
                    <span>
                      {streamOutput.split(/\s+/).filter(Boolean).length} words • {streamOutput.length} chars
                    </span>
                    <span className="font-mono">
                      {ttftMs !== undefined && `TTFT: ${formatMs(ttftMs)} • `}
                      {totalDurationMs !== undefined ? `Total: ${formatMs(totalDurationMs)}` : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Error Box if stream failed */}
              {streamResult?.error && (
                <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-destructive font-semibold">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Stream Error ({streamResult.error.code})</span>
                  </div>
                  <p className="text-destructive/90 font-mono">{streamResult.error.message}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
