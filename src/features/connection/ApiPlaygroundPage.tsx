import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useConnectionForm } from './useConnectionForm'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { StatusBanner } from '@/components/common/StatusBanner'
import {
  Plug,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Server,
  ArrowRight,
  ExternalLink,
  Info,
  Sliders,
} from 'lucide-react'
import { formatMs } from '@/lib/utils'
import type { AuthMethod } from '@/types'

interface ProviderPreset {
  name: string
  url: string
  auth: 'bearer' | 'x-api-key'
  defaultModel?: string
  badge?: string
}

const PRESETS: ProviderPreset[] = [
  { name: 'Groq', url: 'https://api.groq.com/openai/v1', auth: 'bearer', defaultModel: 'llama-3.3-70b-versatile', badge: 'Free / Ultra-fast' },
  { name: 'Cerebras', url: 'https://api.cerebras.ai/v1', auth: 'bearer', defaultModel: 'llama-3.3-70b', badge: 'Free' },
  { name: 'SambaNova', url: 'https://api.sambanova.ai/v1', auth: 'bearer', defaultModel: 'Meta-Llama-3.3-70B-Instruct', badge: 'Free' },
  { name: 'DeepSeek', url: 'https://api.deepseek.com/v1', auth: 'bearer', defaultModel: 'deepseek-chat', badge: 'Popular' },
  { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', auth: 'bearer', defaultModel: 'meta-llama/llama-3.3-70b-instruct:free', badge: 'Free Models' },
  { name: 'GitHub Models', url: 'https://models.inference.ai.azure.com', auth: 'bearer', defaultModel: 'gpt-4o-mini', badge: 'Free' },
  { name: 'Mistral AI', url: 'https://api.mistral.ai/v1', auth: 'bearer', defaultModel: 'mistral-small-latest', badge: 'Free Tier' },
  { name: 'Gemini (OpenAI)', url: 'https://generativelanguage.googleapis.com/v1beta/openai', auth: 'bearer', defaultModel: 'gemini-1.5-flash', badge: 'Free Tier' },
  { name: 'Together AI', url: 'https://api.together.xyz/v1', auth: 'bearer', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  { name: 'OpenAI', url: 'https://api.openai.com/v1', auth: 'bearer', defaultModel: 'gpt-4o-mini' },
  { name: 'Ollama (Local)', url: 'http://localhost:11434/v1', auth: 'bearer', defaultModel: 'llama3', badge: 'Local' },
]

export function ApiPlaygroundPage() {
  const { t } = useTranslation()
  const [showApiKey, setShowApiKey] = useState(false)

  const {
    form,
    isTestingConnection,
    isFetchingModels,
    backendHealth,
    connectionResult,
    handleTestConnection,
    handleFetchModels,
    handleApplyManualModel,
    handleClearForm,
    applyPreset,
    updateField,
  } = useConnectionForm()

  const isConnected = connectionResult?.success === true

  const authOptions: { value: AuthMethod; label: string; desc: string }[] = [
    {
      value: 'bearer',
      label: t('connection.authBearer'),
      desc: 'Authorization: Bearer <key>',
    },
    {
      value: 'x-api-key',
      label: t('connection.authXApiKey'),
      desc: 'x-api-key: <key>',
    },
    {
      value: 'custom',
      label: t('connection.authCustom'),
      desc: 'Custom Header: <key>',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('connection.title')}
        description={t('connection.description')}
        actions={
          <div className="flex items-center gap-2">
            {backendHealth === 'healthy' ? (
              <Badge variant="success" className="gap-1.5 py-1 px-2.5 font-normal">
                <span className="status-dot-success" />
                Worker Engine Online
              </Badge>
            ) : backendHealth === 'checking' ? (
              <Badge variant="outline" className="gap-1.5 py-1 px-2.5 font-normal text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking Worker...
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1.5 py-1 px-2.5 font-normal">
                <Server className="h-3 w-3" />
                Local Worker Standby
              </Badge>
            )}
          </div>
        }
      />

      {/* Security note banner */}
      <div className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-2.5 text-xs text-cyan-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-400" />
          <span>
            <strong>Zero Persistence Guarantee:</strong> API keys remain in browser memory only and are never saved to localStorage, cookies, or databases.
          </span>
        </div>
        <span className="hidden md:inline-block text-[11px] text-muted-foreground">
          SSRF Protection Active
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Connection Form (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="card-glow border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plug className="h-4 w-4 text-royal-400" />
                    Provider Configuration
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Enter the OpenAI-compatible Base URL and credentials
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearForm}
                  className="text-muted-foreground hover:text-destructive h-8 text-xs gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('connection.clearForm')}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Quick Presets */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Quick Presets</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <Button
                      key={p.name}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset(p.name, p.url, p.auth, p.defaultModel)}
                      className={`h-7 px-2.5 text-xs ${
                        form.baseUrl === p.url ? 'border-primary text-primary bg-primary/5' : ''
                      }`}
                    >
                      {p.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Provider Name */}
              <div className="space-y-1.5">
                <Label htmlFor="providerName">
                  {t('connection.providerName')}{' '}
                  <span className="text-muted-foreground font-normal text-xs">
                    ({t('common.optional')})
                  </span>
                </Label>
                <Input
                  id="providerName"
                  value={form.name ?? ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder={t('connection.providerNamePlaceholder')}
                  className="h-9"
                />
              </div>

              {/* Base URL */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="baseUrl">
                    {t('connection.baseUrl')}{' '}
                    <span className="text-destructive text-xs">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Ends with /v1
                  </span>
                </div>
                <Input
                  id="baseUrl"
                  type="url"
                  value={form.baseUrl}
                  onChange={(e) => updateField('baseUrl', e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="font-mono text-sm h-9"
                />
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="apiKey">
                    {t('connection.apiKey')}{' '}
                    <span className="text-destructive text-xs">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    In-memory only
                  </span>
                </div>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showApiKey ? 'text' : 'password'}
                    value={form.apiKey}
                    onChange={(e) => updateField('apiKey', e.target.value)}
                    placeholder={t('connection.apiKeyPlaceholder')}
                    className="pr-10 font-mono text-sm h-9"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowApiKey((v) => !v)}
                    aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Auth Method */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label>{t('connection.authMethod')}</Label>
                  <Select
                    value={form.authMethod}
                    onValueChange={(v) => updateField('authMethod', v as AuthMethod)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {authOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex flex-col text-left">
                            <span>{opt.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Auth Header */}
                {form.authMethod === 'custom' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="customAuthHeader">{t('connection.customAuthHeader')}</Label>
                    <Input
                      id="customAuthHeader"
                      value={form.customAuthHeader ?? ''}
                      onChange={(e) => updateField('customAuthHeader', e.target.value)}
                      placeholder="e.g. api-key or Authorization"
                      className="font-mono text-sm h-9"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Auth Header Format</Label>
                    <div className="h-9 rounded-md border border-input bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground flex items-center">
                      {form.authMethod === 'bearer'
                        ? 'Authorization: Bearer <key>'
                        : 'x-api-key: <key>'}
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Model ID */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="modelId">
                    {t('connection.customModelId')}{' '}
                    <span className="text-muted-foreground font-normal text-xs">
                      ({t('common.optional')})
                    </span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    For unlisted or custom models
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="modelId"
                    value={form.modelId ?? ''}
                    onChange={(e) => updateField('modelId', e.target.value)}
                    placeholder="e.g. gpt-4o, llama-3.3-70b-versatile, claude-3-5-sonnet"
                    className="font-mono text-sm h-9 flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyManualModel()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyManualModel()}
                    disabled={!form.modelId?.trim()}
                    className="h-9 text-xs"
                  >
                    Set Active
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-muted-foreground">Quick Suggestions:</span>
                  {[
                    'llama-3.3-70b-versatile',
                    'deepseek-chat',
                    'gpt-4o-mini',
                    'gemini-1.5-flash',
                    'mistral-small-latest',
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => updateField('modelId', sug)}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60 bg-muted/30 text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3">
                <Button
                  onClick={handleTestConnection}
                  disabled={isTestingConnection || !form.baseUrl || !form.apiKey}
                  className="flex-1 gap-2 h-10 shadow-md shadow-primary/10"
                >
                  {isTestingConnection ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plug className="h-4 w-4" />
                  )}
                  {isTestingConnection ? t('connection.connecting') : t('connection.testConnection')}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleFetchModels}
                  disabled={isFetchingModels || !form.baseUrl || !form.apiKey}
                  className="gap-2 h-10"
                >
                  {isFetchingModels ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {t('connection.fetchModels')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status & Diagnostics Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Connection Status Card */}
          <Card className="card-glow border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  {isConnected ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : connectionResult?.success === false ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <div className="status-dot status-dot-idle" />
                  )}
                  {t('connection.connectionResult')}
                </CardTitle>
                {connectionResult && (
                  <Badge variant={isConnected ? 'success' : 'destructive'} className="text-xs">
                    {isConnected ? t('connection.connected') : t('connection.disconnected')}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {!connectionResult ? (
                <div className="text-center py-10 text-muted-foreground text-sm space-y-2">
                  <Plug className="h-8 w-8 mx-auto opacity-30 text-muted-foreground" />
                  <p>{t('connection.noConnectionYet')}</p>
                  <p className="text-xs max-w-xs mx-auto text-muted-foreground/80">
                    Click <strong>Test Connection</strong> to verify connectivity, authentication, and endpoint latency.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Status metrics grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/40 p-2.5 border border-border">
                      <span className="text-[11px] text-muted-foreground block">{t('connection.latency')}</span>
                      <span className="text-sm font-mono font-semibold flex items-center gap-1.5 mt-0.5 text-foreground">
                        <Clock className="h-3.5 w-3.5 text-royal-400" />
                        {connectionResult.latencyMs !== undefined ? formatMs(connectionResult.latencyMs) : '—'}
                      </span>
                    </div>

                    <div className="rounded-lg bg-muted/40 p-2.5 border border-border">
                      <span className="text-[11px] text-muted-foreground block">{t('connection.httpStatus')}</span>
                      <span className="text-sm font-mono font-semibold mt-0.5 block">
                        {connectionResult.httpStatus ? (
                          <Badge
                            variant={
                              connectionResult.httpStatus === 200
                                ? 'success'
                                : connectionResult.httpStatus < 500
                                ? 'warning'
                                : 'destructive'
                            }
                            className="font-mono text-xs px-2"
                          >
                            HTTP {connectionResult.httpStatus}
                          </Badge>
                        ) : (
                          '0 (Failed)'
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Tested Endpoint */}
                  <div className="rounded-md bg-muted/30 p-2 border border-border text-xs">
                    <span className="text-muted-foreground block text-[11px] mb-0.5">Base URL Tested:</span>
                    <span className="font-mono text-foreground break-all">
                      {form.baseUrl || '—'}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
                    <span>Verified at:</span>
                    <span>{new Date(connectionResult.timestamp).toLocaleTimeString()}</span>
                  </div>

                  {/* Next Steps CTA when connected */}
                  {isConnected && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-400 space-y-2">
                      <p className="font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Connection verified successfully!
                      </p>
                      <p className="text-[11px] text-emerald-400/90 leading-relaxed">
                        You can now fetch models or proceed directly to testing prompts.
                      </p>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-7 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                        >
                          <Link to="/models">
                            Explore Models
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          asChild
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          <Link to="/chat">
                            Open Chat Tester
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Diagnostics Box (if connection error) */}
          {connectionResult?.error && (
            <Card className="border-destructive/40 bg-destructive/5 card-glow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-destructive">
                    <ShieldAlert className="h-4 w-4" />
                    Error Diagnostics
                  </CardTitle>
                  <Badge variant="destructive" className="font-mono text-[11px]">
                    {connectionResult.error.code}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <p className="text-muted-foreground font-medium mb-0.5">Error Message:</p>
                  <p className="font-mono text-destructive/90 bg-destructive/10 p-2 rounded border border-destructive/20 break-words leading-relaxed">
                    {connectionResult.error.message}
                  </p>
                </div>

                {connectionResult.error.possibleCauses && connectionResult.error.possibleCauses.length > 0 && (
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Possible Causes:</p>
                    <ul className="space-y-1 text-muted-foreground">
                      {connectionResult.error.possibleCauses.map((cause, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-destructive">•</span>
                          <span>{cause}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {connectionResult.error.recommendations && connectionResult.error.recommendations.length > 0 && (
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Recommended Solutions:</p>
                    <ul className="space-y-1 text-foreground">
                      {connectionResult.error.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-cyan-400">
                          <span>→</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-2 border-t border-destructive/20 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                  >
                    <Link to="/diagnostics">
                      Full Diagnostics History
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
