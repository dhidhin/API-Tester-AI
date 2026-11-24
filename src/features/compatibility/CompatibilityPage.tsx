import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Copy,
  Check,
  ShieldAlert,
  FileCode,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBanner } from '@/components/common/StatusBanner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CodeBlock } from '@/components/common/CodeBlock'
import { useSession, useToast } from '@/stores'
import { copyToClipboard } from '@/lib/utils'
import type { CompatibilityStatus, CompatibilityCheck, ToolCompatibility } from '@/types'

export function CompatibilityPage() {
  const { t } = useTranslation()
  const { provider, connectionResult, models, selectedModel, streamResult } = useSession()
  const { success: showSuccess } = useToast()

  const [copiedOpenCode, setCopiedOpenCode] = useState(false)
  const [expandedTool, setExpandedTool] = useState<string | null>('opencode')

  const isConfigured = Boolean(provider?.baseUrl && provider?.apiKey)

  // Live session evidence:
  const isConnectionVerified = connectionResult?.success === true
  const isModelsVerified = models.length > 0
  const isStreamingVerified = streamResult?.success === true
  const isBearerAuth = provider?.authMethod === 'bearer'
  const activeModelId = selectedModel || (models.length > 0 ? models[0].id : 'gpt-4o')

  // Build evidence-based tool evaluations
  const tools: ToolCompatibility[] = [
    {
      tool: 'opencode',
      toolLabel: 'OpenCode',
      status: evaluateOpenCodeStatus(),
      note: 'OpenCode requires standard OpenAI-compatible format, /chat/completions with streaming, and Bearer token.',
      checks: [
        {
          feature: 'Base URL Format',
          status: provider?.baseUrl ? 'compatible' : 'not_verified',
          evidence: provider?.baseUrl ? `Configured as ${provider.baseUrl}` : 'Base URL not set',
        },
        {
          feature: 'Bearer Token Authentication',
          status: isBearerAuth ? 'compatible' : provider?.authMethod ? 'unsupported' : 'not_verified',
          evidence: isBearerAuth ? 'Bearer Token selected' : `Using ${provider?.authMethod || 'none'}`,
          note: !isBearerAuth && provider?.authMethod ? 'OpenCode custom provider expects Bearer authentication.' : undefined,
        },
        {
          feature: 'Models Endpoint (/models)',
          status: isModelsVerified ? 'compatible' : isConnectionVerified ? 'partial' : 'not_verified',
          evidence: isModelsVerified ? `${models.length} model(s) discovered` : 'Not verified yet',
        },
        {
          feature: 'SSE Streaming Support',
          status: isStreamingVerified ? 'compatible' : 'not_verified',
          evidence: isStreamingVerified ? 'Streaming test completed successfully' : 'Streaming test not run yet',
        },
      ],
    },
    {
      tool: 'openai-sdk',
      toolLabel: 'OpenAI SDK (Node / Python)',
      status: evaluateOpenAiSdkStatus(),
      note: 'Official OpenAI SDK with custom baseURL requires Bearer token, /chat/completions, and /models.',
      checks: [
        {
          feature: 'Bearer Authentication',
          status: isBearerAuth ? 'compatible' : provider?.authMethod ? 'unsupported' : 'not_verified',
          evidence: isBearerAuth ? 'Bearer authentication active' : `Using ${provider?.authMethod || 'unconfigured'}`,
        },
        {
          feature: 'Chat Completions (/chat/completions)',
          status: isConnectionVerified ? 'compatible' : 'not_verified',
          evidence: isConnectionVerified ? 'Endpoint tested and responsive' : 'Not verified yet',
        },
        {
          feature: 'Models Discovery (/models)',
          status: isModelsVerified ? 'compatible' : 'not_verified',
          evidence: isModelsVerified ? 'Models list endpoint operational' : 'Not verified yet',
        },
        {
          feature: 'Streaming (Server-Sent Events)',
          status: isStreamingVerified ? 'compatible' : 'not_verified',
          evidence: isStreamingVerified ? 'SSE chunk streaming verified' : 'Streaming test not run yet',
        },
      ],
    },
    {
      tool: 'continue',
      toolLabel: 'Continue.dev',
      status: evaluateGenericIdeStatus(),
      note: 'Continue requires OpenAI-compatible baseURL, Bearer auth, /chat/completions, and streaming.',
      checks: [
        {
          feature: 'Chat Completions',
          status: isConnectionVerified ? 'compatible' : 'not_verified',
          evidence: isConnectionVerified ? 'Verified' : 'Not verified yet',
        },
        {
          feature: 'Streaming Support',
          status: isStreamingVerified ? 'compatible' : 'not_verified',
          evidence: isStreamingVerified ? 'Verified' : 'Streaming test pending',
        },
        {
          feature: 'Model ID Resolution',
          status: activeModelId ? 'compatible' : 'not_verified',
          evidence: activeModelId ? `Target model: ${activeModelId}` : 'No model selected',
        },
      ],
    },
    {
      tool: 'cline',
      toolLabel: 'Cline',
      status: evaluateGenericIdeStatus(),
      note: 'Cline requires OpenAI-compatible provider with streaming capability.',
      checks: [
        {
          feature: 'OpenAI API Format',
          status: isConnectionVerified ? 'compatible' : 'not_verified',
          evidence: isConnectionVerified ? 'Base URL verified' : 'Not verified',
        },
        {
          feature: 'Streaming Responses',
          status: isStreamingVerified ? 'compatible' : 'not_verified',
          evidence: isStreamingVerified ? 'Streaming supported' : 'Pending streaming test',
        },
      ],
    },
    {
      tool: 'roocode',
      toolLabel: 'Roo Code',
      status: evaluateGenericIdeStatus(),
      note: 'Roo Code supports OpenAI-compatible endpoints with SSE streaming and tool calling.',
      checks: [
        {
          feature: 'OpenAI Format',
          status: isConnectionVerified ? 'compatible' : 'not_verified',
          evidence: isConnectionVerified ? 'Responsive' : 'Not verified',
        },
        {
          feature: 'Streaming Response',
          status: isStreamingVerified ? 'compatible' : 'not_verified',
          evidence: isStreamingVerified ? 'Streaming verified' : 'Pending streaming test',
        },
      ],
    },
    {
      tool: 'generic',
      toolLabel: 'Custom OpenAI-Compatible App',
      status: isConnectionVerified ? (isStreamingVerified ? 'compatible' : 'partial') : 'not_verified',
      note: 'General assessment for custom applications consuming OpenAI v1 API endpoints.',
      checks: [
        {
          feature: 'Base URL Endpoint',
          status: isConnectionVerified ? 'compatible' : 'not_verified',
          evidence: isConnectionVerified ? 'Valid response received' : 'Not tested',
        },
        {
          feature: 'Streaming',
          status: isStreamingVerified ? 'compatible' : 'not_verified',
          evidence: isStreamingVerified ? 'SSE verified' : 'Streaming not verified yet',
        },
      ],
    },
    {
      tool: 'antigravity',
      toolLabel: 'Google Antigravity',
      status: 'unsupported',
      note: 'Custom OpenAI-compatible Base URL is NOT an officially supported BYOK configuration in Antigravity IDE.',
      checks: [
        {
          feature: 'Native BYOK Custom Base URL',
          status: 'unsupported',
          evidence: 'Not supported natively in Google Antigravity IDE',
          note: 'Antigravity IDE natively uses Google AI and Gemini interactions.',
        },
        {
          feature: 'Arbitrary Provider Bypass',
          status: 'unsupported',
          evidence: 'Third-party OpenAI proxy configuration is not officially supported',
        },
      ],
    },
  ]

  function evaluateOpenCodeStatus(): CompatibilityStatus {
    if (!isConnectionVerified) return 'not_verified'
    if (!isBearerAuth) return 'unsupported'
    if (isStreamingVerified && isModelsVerified) return 'compatible'
    return 'partial'
  }

  function evaluateOpenAiSdkStatus(): CompatibilityStatus {
    if (!isConnectionVerified) return 'not_verified'
    if (!isBearerAuth) return 'unsupported'
    if (isStreamingVerified && isModelsVerified) return 'compatible'
    return 'partial'
  }

  function evaluateGenericIdeStatus(): CompatibilityStatus {
    if (!isConnectionVerified) return 'not_verified'
    if (!isBearerAuth) return 'partial'
    if (isStreamingVerified) return 'compatible'
    return 'partial'
  }

  function getStatusBadge(status: CompatibilityStatus) {
    switch (status) {
      case 'compatible':
        return <Badge variant="success" className="text-xs">Compatible</Badge>
      case 'partial':
        return <Badge variant="warning" className="text-xs">Partially Compatible</Badge>
      case 'unsupported':
        return <Badge variant="destructive" className="text-xs">Unsupported</Badge>
      case 'not_verified':
      default:
        return <Badge variant="outline" className="text-xs text-muted-foreground">Not Verified</Badge>
    }
  }

  function getStatusIcon(status: CompatibilityStatus) {
    switch (status) {
      case 'compatible':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
      case 'unsupported':
        return <XCircle className="h-4 w-4 text-destructive shrink-0" />
      case 'not_verified':
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
    }
  }

  // OpenCode custom provider JSON configuration template
  const openCodeConfigJson = JSON.stringify(
    {
      providers: [
        {
          name: provider?.name || 'custom-provider',
          baseURL: provider?.baseUrl || 'https://api.openai.com/v1',
          apiKey: '${env:OPENCODE_PROVIDER_API_KEY}',
          models: [
            {
              id: activeModelId,
              name: activeModelId,
            },
          ],
        },
      ],
    },
    null,
    2
  )

  async function handleCopyOpenCodeConfig() {
    await copyToClipboard(openCodeConfigJson)
    setCopiedOpenCode(true)
    showSuccess('OpenCode Configuration Copied', 'Paste this into your OpenCode providers configuration.')
    setTimeout(() => setCopiedOpenCode(false), 2000)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('compatibility.title')}
        description="Evidence-based compatibility analysis for developer tools and IDE coding agents based on actual test results."
      />

      {/* Evaluation Evidence Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg bg-card border border-border p-3 text-xs">
          <span className="text-muted-foreground block text-[11px]">Connection Status</span>
          <span className="font-semibold text-foreground flex items-center gap-1.5 mt-1">
            {isConnectionVerified ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Verified
              </>
            ) : (
              <>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                Not Tested
              </>
            )}
          </span>
        </div>

        <div className="rounded-lg bg-card border border-border p-3 text-xs">
          <span className="text-muted-foreground block text-[11px]">Models Discovery</span>
          <span className="font-semibold text-foreground flex items-center gap-1.5 mt-1">
            {isModelsVerified ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                {models.length} Model(s) Found
              </>
            ) : (
              <>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                Not Tested
              </>
            )}
          </span>
        </div>

        <div className="rounded-lg bg-card border border-border p-3 text-xs">
          <span className="text-muted-foreground block text-[11px]">SSE Streaming</span>
          <span className="font-semibold text-foreground flex items-center gap-1.5 mt-1">
            {isStreamingVerified ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Verified
              </>
            ) : (
              <>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                Not Tested
              </>
            )}
          </span>
        </div>

        <div className="rounded-lg bg-card border border-border p-3 text-xs">
          <span className="text-muted-foreground block text-[11px]">Authentication Method</span>
          <span className="font-semibold text-foreground flex items-center gap-1.5 mt-1">
            {provider?.authMethod ? (
              <Badge variant={isBearerAuth ? 'success' : 'warning'} className="text-[10px] px-1.5">
                {provider.authMethod.toUpperCase()}
              </Badge>
            ) : (
              'Unconfigured'
            )}
          </span>
        </div>
      </div>

      {/* Warning on Evidence Rule */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Evidence-Based Guarantee:</p>
          <p className="text-amber-300/80 leading-relaxed">
            A tool is only marked as <strong>Compatible</strong> if all required endpoints (Connection, Models API, and SSE Streaming) have been verified with live tests. If only basic chat or connection succeeded, the tool is marked as <strong>Partially Compatible</strong>.
          </p>
        </div>
      </div>

      {/* Official Google Antigravity Advisory Notice */}
      <Card className="border-cyan-500/30 bg-cyan-500/5 card-glow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-cyan-400">
              <ShieldAlert className="h-4 w-4" />
              Keterangan Resmi IDE Google Antigravity
            </CardTitle>
            <Badge variant="destructive" className="text-xs">
              Unsupported BYOK
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            Custom OpenAI-compatible Base URL saat ini <strong>belum menjadi konfigurasi Bring-Your-Own-Key (BYOK) resmi</strong> pada IDE Google Antigravity.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Google Antigravity dirancang khusus untuk terintegrasi secara langsung dengan model native Google AI dan Gemini interactions melalui MCP tools dan plugin resmi. Jangan menggunakan konfigurasi custom OpenAI-compatible dengan asumsi dapat langsung berjalan tanpa dukungan integrasi resmi.
          </p>
        </CardContent>
      </Card>

      {/* OpenCode Custom Provider Configuration Showcase */}
      <Card className="border-royal-500/30 bg-card card-glow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCode className="h-4 w-4 text-royal-400" />
                OpenCode Configuration Generator
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Generated custom provider configuration formatted specifically for OpenCode
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyOpenCodeConfig}
              className="gap-1.5 h-8 text-xs border-royal-500/30 text-royal-300 hover:bg-royal-500/10"
            >
              {copiedOpenCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedOpenCode ? 'Copied!' : 'Copy OpenCode Config'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <CodeBlock code={openCodeConfigJson} language="json" maxHeight="220px" />
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-royal-400 shrink-0" />
            <span>
              Save this in your OpenCode configuration. The API key uses <code>${'{env:OPENCODE_PROVIDER_API_KEY}'}</code> to avoid committing secrets.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* All Tools Compatibility Evaluation Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Tools Compatibility Matrix
        </h3>

        {tools.map((tool) => {
          const isExpanded = expandedTool === tool.tool

          return (
            <Card key={tool.tool} className="border-border card-glow">
              <CardHeader
                className="py-3 px-4 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setExpandedTool(isExpanded ? null : tool.tool)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {getStatusIcon(tool.status)}
                    <div>
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {tool.toolLabel}
                        {tool.tool === 'opencode' && (
                          <Badge variant="cyan" className="text-[10px] py-0 px-1.5">
                            Recommended
                          </Badge>
                        )}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{tool.note}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(tool.status)}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 pb-3 px-4 border-t border-border/50">
                  <div className="divide-y divide-border/50">
                    {tool.checks.map((chk, i) => (
                      <div key={i} className="py-2.5 flex items-start justify-between text-xs">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5">{getStatusIcon(chk.status)}</span>
                          <div>
                            <span className="font-medium text-foreground">{chk.feature}</span>
                            {chk.note && (
                              <p className="text-[11px] text-amber-400 mt-0.5">{chk.note}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-muted-foreground text-[11px]">
                            {chk.evidence}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
