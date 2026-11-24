import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileText,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  MessageSquare,
  Plug,
  Gauge,
  GitCompare,
  Bug,
  Code2,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBanner } from '@/components/common/StatusBanner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CodeBlock } from '@/components/common/CodeBlock'
import { useSession } from '@/stores'
import { downloadJson, downloadHtml, generateHtmlReport, sanitizeBaseUrl } from './reportUtils'
import type { ConfigTarget } from '@/types'

export function ReportsPage() {
  const { t } = useTranslation()
  const {
    provider,
    connectionResult,
    models,
    selectedModel,
    chatResult,
    streamResult,
    benchmarkSession,
    compatibilityReport,
    diagnostics,
  } = useSession()

  const [activeTab, setActiveTab] = useState<'report' | 'config'>('report')
  const [configTarget, setConfigTarget] = useState<ConfigTarget>('opencode')
  const [copiedConfig, setCopiedConfig] = useState(false)

  const hasData = Boolean(provider || connectionResult || chatResult || streamResult || benchmarkSession)
  const activeModel = selectedModel || (models[0]?.id ?? 'gpt-4o')
  const sanitizedUrl = sanitizeBaseUrl(provider?.baseUrl) || 'https://api.example.com/v1'

  function buildReport() {
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      provider: {
        name: provider?.name ?? 'Custom AI Provider',
        baseUrl: sanitizeBaseUrl(provider?.baseUrl),
        authMethod: provider?.authMethod ?? 'bearer',
        // Note: apiKey is strictly excluded per security policy
      },
      model: selectedModel ?? (models[0]?.id || null),
      connection: connectionResult
        ? {
            success: connectionResult.success,
            latencyMs: connectionResult.latencyMs,
            httpStatus: connectionResult.httpStatus,
            error: connectionResult.error,
            timestamp: connectionResult.timestamp,
          }
        : null,
      chat: chatResult
        ? {
            success: chatResult.success,
            httpStatus: chatResult.httpStatus,
            latencyMs: chatResult.latencyMs,
            tokenUsage: chatResult.tokenUsage,
            timestamp: chatResult.timestamp,
          }
        : null,
      stream: streamResult
        ? {
            success: streamResult.success,
            ttftMs: streamResult.ttftMs,
            totalDurationMs: streamResult.totalDurationMs,
            timestamp: streamResult.timestamp,
          }
        : null,
      modelsDiscovered: models.map((m) => ({
        id: m.id,
        ownedBy: m.ownedBy,
        contextLength: m.contextLength,
      })),
      benchmark: benchmarkSession ?? null,
      compatibility: compatibilityReport ?? null,
      diagnostics: diagnostics.map((d) => ({
        code: d.code,
        category: d.category,
        message: d.message,
        httpStatus: d.httpStatus,
        timestamp: d.timestamp,
      })),
    }
  }

  function handleDownloadJson() {
    const report = buildReport()
    downloadJson(report, `api-tester-report-${Date.now()}.json`)
  }

  function handleDownloadHtml() {
    const report = buildReport()
    const html = generateHtmlReport(report)
    downloadHtml(html, `api-tester-report-${Date.now()}.html`)
  }

  const configTemplates: Record<ConfigTarget, string> = {
    opencode: `// OpenCode Custom Provider Configuration (JSONC)
// Place this configuration in ~/.config/opencode/config.jsonc or project root
{
  "providers": [
    {
      "name": "${provider?.name ?? 'custom-provider'}",
      "baseURL": "${sanitizedUrl}",
      // Security: use environment variable placeholder, never store real secrets
      "apiKey": "\${env:AI_PROVIDER_API_KEY}",
      "models": [
        {
          "id": "${activeModel}",
          "name": "${activeModel}"
        }
      ]
    }
  ]
}`,
    'openai-sdk': `// OpenAI SDK Integration (Node.js / TypeScript)
import OpenAI from 'openai';

// Initialize client with custom Base URL and environment variable
const client = new OpenAI({
  apiKey: process.env.AI_PROVIDER_API_KEY, // Set in your .env or environment
  baseURL: '${sanitizedUrl}',
});

async function main() {
  const completion = await client.chat.completions.create({
    model: '${activeModel}',
    messages: [
      { role: 'system', content: 'You are a helpful coding assistant.' },
      { role: 'user', content: 'Hello from OpenAI SDK compatible client!' }
    ],
    temperature: 0.7,
  });

  console.log(completion.choices[0].message.content);
}

main().catch(console.error);`,
    continue: `// Continue.dev Model Configuration (JSON)
// Place this inside ~/.continue/config.json under the "models" array
{
  "models": [
    {
      "title": "${provider?.name ?? 'Custom AI Provider'}",
      "provider": "openai",
      "model": "${activeModel}",
      "apiKey": "\${env:AI_PROVIDER_API_KEY}",
      "apiBase": "${sanitizedUrl}"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Autocomplete Model",
    "provider": "openai",
    "model": "${activeModel}",
    "apiKey": "\${env:AI_PROVIDER_API_KEY}",
    "apiBase": "${sanitizedUrl}"
  }
}`,
    cline: `// Cline Custom Provider Configuration
// Configure in VS Code settings.json or Cline settings pane
{
  "cline.apiProvider": "openai-compatible",
  "cline.openAiBaseUrl": "${sanitizedUrl}",
  "cline.openAiApiKey": "\${env:AI_PROVIDER_API_KEY}",
  "cline.openAiModelId": "${activeModel}"
}`,
    roocode: `// Roo Code (Roo Cline) Custom Provider Configuration
// Configure in VS Code settings.json or Roo Code provider tab
{
  "roo-cline.apiProvider": "openai-compatible",
  "roo-cline.openAiBaseUrl": "${sanitizedUrl}",
  "roo-cline.openAiApiKey": "\${env:AI_PROVIDER_API_KEY}",
  "roo-cline.openAiModelId": "${activeModel}"
}`,
    generic: `#!/usr/bin/env bash
# Generic REST API Call using curl
# Set your environment variable before running:
# export AI_PROVIDER_API_KEY="your-actual-api-key"

BASE_URL="${sanitizedUrl}"
MODEL="${activeModel}"

curl -X POST "\${BASE_URL}/chat/completions" \\
  -H "Authorization: Bearer \${AI_PROVIDER_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "'"$MODEL"'",
    "messages": [
      { "role": "system", "content": "You are a helpful assistant." },
      { "role": "user", "content": "Hello from API Tester AI!" }
    ],
    "temperature": 0.7,
    "max_tokens": 512
  }'`,
  }

  const configTargetOptions: { value: ConfigTarget; label: string; format: string }[] = [
    { value: 'opencode', label: 'OpenCode (JSONC)', format: 'jsonc' },
    { value: 'openai-sdk', label: 'OpenAI SDK (Node.js / TS)', format: 'typescript' },
    { value: 'continue', label: 'Continue.dev', format: 'json' },
    { value: 'cline', label: 'Cline', format: 'json' },
    { value: 'roocode', label: 'Roo Code', format: 'json' },
    { value: 'generic', label: 'Generic REST API (cURL)', format: 'shell' },
  ]

  async function handleCopyConfig() {
    await navigator.clipboard.writeText(configTemplates[configTarget])
    setCopiedConfig(true)
    setTimeout(() => setCopiedConfig(false), 2000)
  }

  function handleDownloadConfig() {
    const content = configTemplates[configTarget]
    const ext =
      configTarget === 'openai-sdk'
        ? 'ts'
        : configTarget === 'generic'
        ? 'sh'
        : configTarget === 'opencode'
        ? 'jsonc'
        : 'json'
    const filename = `${configTarget}-config.${ext}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reports.title')}
        description={t('reports.description')}
      />

      {!hasData && (
        <StatusBanner variant="warning" message={t('reports.noReport')} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'report'
              ? 'bg-background text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('report')}
        >
          {t('reports.title')}
        </button>
        <button
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'config'
              ? 'bg-background text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('config')}
        >
          {t('config.title')}
        </button>
      </div>

      {activeTab === 'report' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadJson}
                disabled={!hasData}
                className="gap-2 text-xs"
              >
                <Download className="h-4 w-4" />
                {t('reports.downloadJson')}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadHtml}
                disabled={!hasData}
                className="gap-2 text-xs"
              >
                <Download className="h-4 w-4" />
                {t('reports.downloadHtml')}
              </Button>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>All secrets are redacted in exports</span>
            </div>
          </div>

          {hasData && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Provider Info Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Plug className="h-4 w-4 text-primary" />
                    {t('reports.providerInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{provider?.name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Base URL:</span>
                    <span className="font-mono truncate max-w-[170px]" title={sanitizedUrl}>
                      {sanitizedUrl}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auth Method:</span>
                    <span className="font-mono uppercase">{provider?.authMethod ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API Key:</span>
                    <span className="text-muted-foreground italic">{t('reports.apiKeyRemoved')}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Connection Status Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Plug className="h-4 w-4 text-cyan-400" />
                    {t('reports.connectionTest')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  {connectionResult ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={connectionResult.success ? 'success' : 'destructive'} className="text-[10px]">
                          {connectionResult.success ? 'SUCCESS' : 'FAILED'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Latency:</span>
                        <span className="font-mono">{connectionResult.latencyMs ?? '—'} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">HTTP Status:</span>
                        <span className="font-mono">{connectionResult.httpStatus ?? '—'}</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{t('common.noData')}</span>
                  )}
                </CardContent>
              </Card>

              {/* Chat Playground Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-400" />
                    Chat Playground Test
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  {chatResult ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={chatResult.success ? 'success' : 'destructive'} className="text-[10px]">
                          {chatResult.success ? 'SUCCESS' : 'FAILED'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Latency:</span>
                        <span className="font-mono">{chatResult.latencyMs ?? '—'} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Tokens:</span>
                        <span className="font-mono">{chatResult.tokenUsage?.totalTokens ?? '—'}</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{t('common.noData')}</span>
                  )}
                </CardContent>
              </Card>

              {/* Streaming Test Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    Streaming Test
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  {streamResult ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={streamResult.success ? 'success' : 'destructive'} className="text-[10px]">
                          {streamResult.success ? 'SUCCESS' : 'FAILED'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">TTFT:</span>
                        <span className="font-mono">{streamResult.ttftMs ? `${streamResult.ttftMs} ms` : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duration:</span>
                        <span className="font-mono">
                          {streamResult.totalDurationMs ? `${streamResult.totalDurationMs} ms` : '—'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{t('common.noData')}</span>
                  )}
                </CardContent>
              </Card>

              {/* Benchmark Summary Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-emerald-400" />
                    Benchmark Test
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  {benchmarkSession ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Models Evaluated:</span>
                        <span className="font-mono">{benchmarkSession.models.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Completed Runs:</span>
                        <span className="font-mono">
                          {benchmarkSession.completedRuns} / {benchmarkSession.totalRuns}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fastest Model:</span>
                        <span className="font-mono text-cyan-400 truncate max-w-[140px]">
                          {benchmarkSession.results[0]?.model ?? '—'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{t('common.noData')}</span>
                  )}
                </CardContent>
              </Card>

              {/* Compatibility Summary Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <GitCompare className="h-4 w-4 text-purple-400" />
                    Compatibility Matrix
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  {compatibilityReport ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Evaluated Tools:</span>
                        <span className="font-mono">{compatibilityReport.tools.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Compatible:</span>
                        <span className="font-mono text-emerald-400">
                          {compatibilityReport.tools.filter((t) => t.status === 'compatible').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Partially:</span>
                        <span className="font-mono text-amber-400">
                          {compatibilityReport.tools.filter((t) => t.status === 'partial').length}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Evaluated on Compatibility Tab</span>
                  )}
                </CardContent>
              </Card>

              {/* Diagnostics & Timestamp */}
              <Card className="md:col-span-2 lg:col-span-3">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Bug className="h-4 w-4 text-amber-400" />
                      Session Diagnostics & Audit Meta
                    </CardTitle>
                    <span className="text-xs text-muted-foreground font-mono">
                      Generated: {new Date().toLocaleString()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={diagnostics.length > 0 ? 'warning' : 'secondary'} className="text-[10px]">
                      {diagnostics.length} Error(s) Logged
                    </Badge>
                    <Badge variant="cyan" className="text-[10px] font-mono">
                      Active Model: {activeModel}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {models.length} Models Discovered
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-primary" />
                    {t('config.title')}
                  </CardTitle>
                  <CardDescription>
                    Export ready-to-use configuration files for popular AI coding extensions and tools.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyConfig} className="gap-1.5 text-xs">
                    {copiedConfig ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedConfig ? t('common.copied') : t('config.copyConfig')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadConfig} className="gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    {t('config.downloadConfig')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('config.selectTarget')}</Label>
                <Select value={configTarget} onValueChange={(v) => setConfigTarget(v as ConfigTarget)}>
                  <SelectTrigger className="w-full sm:w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {configTargetOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
                🔒 <strong>Security Warning:</strong> {t('config.apiKeyNote')} Always populate real secrets using environment variables in your deployment environment.
              </div>

              <CodeBlock
                code={configTemplates[configTarget]}
                language={
                  configTarget === 'openai-sdk'
                    ? 'typescript'
                    : configTarget === 'generic'
                    ? 'bash'
                    : 'json'
                }
                maxHeight="440px"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
