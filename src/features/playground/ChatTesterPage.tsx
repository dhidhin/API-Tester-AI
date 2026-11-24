import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MessageSquare,
  Send,
  Square,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  Copy,
  Check,
  ShieldAlert,
  Sliders,
  Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBanner } from '@/components/common/StatusBanner'
import { CodeBlock } from '@/components/common/CodeBlock'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession, useToast } from '@/stores'
import { formatMs, copyToClipboard } from '@/lib/utils'
import type { ChatResult, AppError } from '@/types'

export function ChatTesterPage() {
  const { t } = useTranslation()
  const { provider, models, selectedModel, setSelectedModel, addDiagnostic, setChatResult: setGlobalChatResult } = useSession()
  const { success: showSuccess, error: showError } = useToast()

  const [activeModel, setActiveModel] = useState<string>(
    selectedModel || (models.length > 0 ? models[0].id : 'gpt-4o')
  )
  const [customModelInput, setCustomModelInput] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful and concise AI assistant.')
  const [userPrompt, setUserPrompt] = useState('Explain what an API Gateway is in 2 concise sentences.')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [topP, setTopP] = useState(1.0)
  const [frequencyPenalty, setFrequencyPenalty] = useState(0)
  const [presencePenalty, setPresencePenalty] = useState(0)

  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<ChatResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [showAdvancedParams, setShowAdvancedParams] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  const isConfigured = Boolean(provider?.baseUrl && provider?.apiKey)

  function handleModelChange(val: string) {
    if (val === '__custom__') return
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

  async function handleSend() {
    if (!isConfigured || !activeModel || !userPrompt.trim()) return

    setIsSending(true)
    setResult(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const startTime = Date.now()

    try {
      const messages = []
      if (systemPrompt.trim()) {
        messages.push({ role: 'system' as const, content: systemPrompt.trim() })
      }
      messages.push({ role: 'user' as const, content: userPrompt.trim() })

      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: provider!.baseUrl,
          apiKey: provider!.apiKey,
          authType: provider!.authMethod,
          customAuthHeader: provider!.customAuthHeader,
          model: activeModel,
          messages,
          temperature,
          maxTokens,
          topP,
          frequencyPenalty,
          presencePenalty,
        }),
        signal: controller.signal,
      })

      const latencyMs = Date.now() - startTime
      const data = await response.json()

      if (data.success && data.data) {
        const chatData = data.data
        const chatResult: ChatResult = {
          success: true,
          content: chatData.content,
          httpStatus: response.status,
          latencyMs: chatData.latencyMs ?? latencyMs,
          tokenUsage: chatData.tokenUsage,
          rawResponse: chatData.rawResponse,
          timestamp: new Date().toISOString(),
        }
        setResult(chatResult)
        setGlobalChatResult(chatResult)
        showSuccess('Response Received', `Received in ${formatMs(chatResult.latencyMs || latencyMs)}`)
      } else {
        const error: AppError = data.error || {
          code: `HTTP_${response.status}`,
          message: `Request failed with HTTP status ${response.status}`,
          httpStatus: response.status,
        }

        const chatResult: ChatResult = {
          success: false,
          httpStatus: response.status,
          latencyMs,
          error,
          timestamp: new Date().toISOString(),
        }
        setResult(chatResult)
        setGlobalChatResult(chatResult)

        // Save error to diagnostics store
        addDiagnostic({
          code: error.code,
          category: error.category || 'Chat Completion Error',
          message: error.message,
          httpStatus: error.httpStatus,
          possibleCauses: error.possibleCauses || ['Model rejected parameters or quota exceeded.'],
          recommendations: error.recommendations || ['Verify model name and account limits.'],
          timestamp: new Date().toISOString(),
        })

        showError(`Chat Error (${error.code})`, error.message)
      }
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime
      const wasAborted = err instanceof Error && err.name === 'AbortError'

      if (wasAborted) {
        showSuccess('Cancelled', 'Chat request was stopped by user.')
        return
      }

      const errorMsg = err instanceof Error ? err.message : 'Network error'
      const error: AppError = {
        code: 'NETWORK_ERROR',
        category: 'Network Error',
        message: `Failed to contact provider: ${errorMsg}`,
        httpStatus: 0,
      }

      setResult({
        success: false,
        httpStatus: 0,
        latencyMs,
        error,
        timestamp: new Date().toISOString(),
      })
      showError('Network Error', errorMsg)
    } finally {
      setIsSending(false)
      abortControllerRef.current = null
    }
  }

  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsSending(false)
    }
  }

  async function handleCopyResponse() {
    if (!result?.content) return
    await copyToClipboard(result.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleClearAll() {
    setUserPrompt('')
    setResult(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('chat.title')}
        description={t('chat.description')}
        actions={
          <div className="flex items-center gap-2">
            {activeModel && (
              <Badge variant="cyan" className="font-mono text-xs px-2.5 py-1">
                Active: {activeModel}
              </Badge>
            )}
          </div>
        }
      />

      {!isConfigured && (
        <StatusBanner
          variant="warning"
          message="No active provider configured. Please set your Base URL and API Key in the API Playground first."
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Panel (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="card-glow border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-royal-400" />
                  Chat Input
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Model Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Model</Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {models.length} model(s) available
                  </span>
                </div>

                <div className="flex gap-2">
                  {models.length > 0 ? (
                    <Select value={activeModel} onValueChange={handleModelChange}>
                      <SelectTrigger className="h-9 font-mono text-xs flex-1">
                        <SelectValue placeholder="Select a model..." />
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
                      placeholder="e.g. gpt-4o, llama-3.3-70b-versatile"
                      className="font-mono text-xs h-9 flex-1"
                    />
                  )}
                </div>

                {/* Custom Model input toggle */}
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
                <Label htmlFor="systemPrompt" className="text-xs font-medium">
                  {t('chat.systemPrompt')}{' '}
                  <span className="text-muted-foreground font-normal">({t('common.optional')})</span>
                </Label>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={t('chat.systemPromptPlaceholder')}
                  rows={2}
                  className="text-xs resize-none font-mono"
                />
              </div>

              {/* User Prompt */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="userPrompt" className="text-xs font-medium">
                    {t('chat.userPrompt')} <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {userPrompt.length} chars
                  </span>
                </div>
                <Textarea
                  id="userPrompt"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder={t('chat.userPromptPlaceholder')}
                  rows={4}
                  className="text-sm font-sans"
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault()
                      if (!isSending) handleSend()
                    }
                  }}
                />
                <span className="text-[10px] text-muted-foreground block text-right">
                  Press <strong>Ctrl + Enter</strong> to send
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                {isSending ? (
                  <Button
                    variant="destructive"
                    onClick={handleStop}
                    className="flex-1 gap-2 h-10 shadow-md"
                  >
                    <Square className="h-4 w-4 fill-current" />
                    Stop Request
                  </Button>
                ) : (
                  <Button
                    onClick={handleSend}
                    disabled={!isConfigured || !activeModel || !userPrompt.trim()}
                    className="flex-1 gap-2 h-10 shadow-md shadow-primary/10"
                  >
                    <Send className="h-4 w-4" />
                    {t('chat.sendMessage')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Model Parameters Accordion */}
          <Card className="border-border">
            <CardHeader
              className="py-3 px-4 cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => setShowAdvancedParams((v) => !v)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-royal-400" />
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('chat.parameters')}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    T={temperature} • Max={maxTokens} • P={topP}
                  </span>
                  {showAdvancedParams ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>

            {showAdvancedParams && (
              <CardContent className="space-y-4 pt-2 pb-4">
                {/* Temperature */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <Label className="text-xs">{t('chat.temperature')}</Label>
                    <span className="font-mono text-primary font-medium">{temperature.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[temperature]}
                    min={0}
                    max={2}
                    step={0.05}
                    onValueChange={([v]) => setTemperature(Number(v.toFixed(2)))}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Precise (0.0)</span>
                    <span>Balanced (0.7)</span>
                    <span>Creative (2.0)</span>
                  </div>
                </div>

                {/* Max Tokens */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <Label className="text-xs">{t('chat.maxTokens')}</Label>
                    <span className="font-mono text-primary font-medium">{maxTokens}</span>
                  </div>
                  <Slider
                    value={[maxTokens]}
                    min={64}
                    max={8192}
                    step={64}
                    onValueChange={([v]) => setMaxTokens(v)}
                  />
                </div>

                {/* Top P */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <Label className="text-xs">{t('chat.topP')}</Label>
                    <span className="font-mono text-primary font-medium">{topP.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[topP]}
                    min={0}
                    max={1}
                    step={0.05}
                    onValueChange={([v]) => setTopP(Number(v.toFixed(2)))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Frequency Penalty */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <Label className="text-[11px]">{t('chat.frequencyPenalty')}</Label>
                      <span className="font-mono text-xs">{frequencyPenalty.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[frequencyPenalty]}
                      min={-2}
                      max={2}
                      step={0.1}
                      onValueChange={([v]) => setFrequencyPenalty(Number(v.toFixed(1)))}
                    />
                  </div>

                  {/* Presence Penalty */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <Label className="text-[11px]">{t('chat.presencePenalty')}</Label>
                      <span className="font-mono text-xs">{presencePenalty.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[presencePenalty]}
                      min={-2}
                      max={2}
                      step={0.1}
                      onValueChange={([v]) => setPresencePenalty(Number(v.toFixed(1)))}
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Response & Metrics Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="card-glow border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  {t('chat.response')}
                </CardTitle>
                {result?.success && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyResponse}
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

            <CardContent>
              {isSending ? (
                <div className="text-center py-16 space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-foreground font-medium">Waiting for model completion...</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Model: {activeModel}
                  </p>
                </div>
              ) : !result ? (
                <div className="text-center py-16 text-muted-foreground text-sm space-y-2">
                  <MessageSquare className="h-8 w-8 mx-auto opacity-30" />
                  <p>{t('chat.noResponse')}</p>
                  <p className="text-xs text-muted-foreground/80 max-w-xs mx-auto">
                    Type a prompt on the left and click <strong>Send Message</strong>.
                  </p>
                </div>
              ) : (
                <Tabs defaultValue="response">
                  <TabsList className="mb-3 w-full grid grid-cols-3">
                    <TabsTrigger value="response">Formatted</TabsTrigger>
                    <TabsTrigger value="metrics">Metrics</TabsTrigger>
                    <TabsTrigger value="raw" disabled={!result.rawResponse}>
                      Raw JSON
                    </TabsTrigger>
                  </TabsList>

                  {/* Formatted Response Tab */}
                  <TabsContent value="response">
                    {result.success ? (
                      <div className="space-y-3">
                        <div className="rounded-lg bg-muted/40 p-4 text-sm font-sans whitespace-pre-wrap leading-relaxed min-h-[160px] max-h-[460px] overflow-y-auto border border-border selection:bg-primary/20">
                          {result.content || (
                            <span className="text-muted-foreground italic">(Empty response content)</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
                          <span>
                            {result.content?.split(/\s+/).filter(Boolean).length || 0} words •{' '}
                            {result.content?.length || 0} chars
                          </span>
                          <span className="font-mono">
                            {result.latencyMs !== undefined ? formatMs(result.latencyMs) : ''}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 space-y-2">
                        <div className="flex items-center gap-1.5 text-destructive font-semibold text-xs">
                          <ShieldAlert className="h-4 w-4" />
                          <span>{result.error?.code || 'CHAT_ERROR'}</span>
                        </div>
                        <p className="text-xs text-destructive/90 font-mono leading-relaxed">
                          {result.error?.message}
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Metrics Tab */}
                  <TabsContent value="metrics">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-muted/40 p-2.5 border border-border">
                          <span className="text-[11px] text-muted-foreground block">HTTP Status</span>
                          <span className="text-sm font-mono font-semibold mt-0.5 block">
                            {result.httpStatus ? (
                              <Badge
                                variant={result.httpStatus === 200 ? 'success' : 'destructive'}
                                className="font-mono text-xs"
                              >
                                {result.httpStatus} {result.httpStatus === 200 ? 'OK' : 'Error'}
                              </Badge>
                            ) : (
                              '0 (Network Error)'
                            )}
                          </span>
                        </div>

                        <div className="rounded-lg bg-muted/40 p-2.5 border border-border">
                          <span className="text-[11px] text-muted-foreground block">{t('chat.responseTime')}</span>
                          <span className="text-sm font-mono font-semibold flex items-center gap-1 mt-0.5 text-foreground">
                            <Clock className="h-3.5 w-3.5 text-royal-400" />
                            {result.latencyMs !== undefined ? formatMs(result.latencyMs) : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Token Usage Card */}
                      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 text-xs">
                        <p className="font-medium text-foreground flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-cyan-400" />
                          {t('chat.tokenUsage')}
                        </p>

                        {result.tokenUsage ? (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('chat.promptTokens')}</span>
                              <span className="font-mono">{result.tokenUsage.promptTokens}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('chat.completionTokens')}</span>
                              <span className="font-mono">{result.tokenUsage.completionTokens}</span>
                            </div>
                            <div className="flex justify-between font-semibold pt-1 border-t border-border">
                              <span>{t('chat.totalTokens')}</span>
                              <span className="font-mono text-primary">{result.tokenUsage.totalTokens}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-[11px]">
                            Token usage not provided by this model or provider response.
                          </p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Raw JSON Tab */}
                  {Boolean(result.rawResponse) && (
                    <TabsContent value="raw">
                      <CodeBlock
                        code={JSON.stringify(result.rawResponse, null, 2)}
                        language="json"
                        maxHeight="380px"
                      />
                    </TabsContent>
                  )}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
