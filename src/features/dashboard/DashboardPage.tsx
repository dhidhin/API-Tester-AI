import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Plug,
  Database,
  MessageSquare,
  Zap,
  Gauge,
  GitCompare,
  Bug,
  FileText,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSession } from '@/stores'
import { formatMs } from '@/lib/utils'

const steps = [
  { icon: Plug, titleKey: 'dashboard.step1', descKey: 'dashboard.step1Desc', path: '/playground' },
  { icon: CheckCircle2, titleKey: 'dashboard.step2', descKey: 'dashboard.step2Desc', path: '/playground' },
  { icon: Database, titleKey: 'dashboard.step3', descKey: 'dashboard.step3Desc', path: '/models' },
  { icon: Gauge, titleKey: 'dashboard.step4', descKey: 'dashboard.step4Desc', path: '/benchmark' },
]

const features = [
  { icon: Plug, titleKey: 'nav.apiPlayground', path: '/playground', color: 'text-blue-400' },
  { icon: Database, titleKey: 'nav.modelExplorer', path: '/models', color: 'text-cyan-400' },
  { icon: MessageSquare, titleKey: 'nav.chatTester', path: '/chat', color: 'text-violet-400' },
  { icon: Zap, titleKey: 'Streaming', path: '/streaming', color: 'text-yellow-400', customLabel: 'Streaming' },
  { icon: Gauge, titleKey: 'nav.benchmark', path: '/benchmark', color: 'text-orange-400' },
  { icon: GitCompare, titleKey: 'nav.compatibility', path: '/compatibility', color: 'text-emerald-400' },
  { icon: Bug, titleKey: 'nav.diagnostics', path: '/diagnostics', color: 'text-red-400' },
  { icon: FileText, titleKey: 'nav.reports', path: '/reports', color: 'text-pink-400' },
]

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { provider, connectionResult, models, benchmarkSession, diagnostics } = useSession()

  const isConnected = connectionResult?.success === true

  const stats = [
    {
      label: t('dashboard.statsConnection'),
      value: isConnected ? t('status.connected') : t('status.disconnected'),
      icon: isConnected ? CheckCircle2 : AlertCircle,
      color: isConnected ? 'text-emerald-400' : 'text-muted-foreground',
      detail: isConnected && connectionResult?.latencyMs
        ? formatMs(connectionResult.latencyMs)
        : undefined,
    },
    {
      label: t('dashboard.statsModels'),
      value: models.length.toString(),
      icon: Database,
      color: 'text-cyan-400',
    },
    {
      label: t('dashboard.statsBenchmark'),
      value: benchmarkSession?.completedRuns?.toString() ?? '0',
      icon: Gauge,
      color: 'text-orange-400',
    },
    {
      label: t('dashboard.statsErrors'),
      value: diagnostics.length.toString(),
      icon: Bug,
      color: 'text-red-400',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.description')}
      />

      {/* Stats */}
      {provider ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <Card key={i} className="card-glow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className={`text-lg font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                    {stat.detail && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {stat.detail}
                      </p>
                    )}
                  </div>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Welcome card when no session */
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-cyan-500/5">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/20">
                <Plug className="h-8 w-8 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2">{t('dashboard.welcome')}</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">{t('dashboard.welcomeDesc')}</p>
            <Button onClick={() => navigate('/playground')} className="gap-2">
              {t('dashboard.goToPlayground')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick start steps */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('dashboard.quickStart')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((step, index) => (
            <Card
              key={index}
              className="cursor-pointer hover:border-primary/40 transition-colors card-glow group"
              onClick={() => navigate(step.path)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <step.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
                        {index + 1}
                      </Badge>
                      <p className="text-sm font-medium truncate">{t(step.titleKey)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {t(step.descKey)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Feature grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Features
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {features.map((feature) => (
            <Card
              key={feature.path}
              className="cursor-pointer hover:border-primary/40 transition-colors group"
              onClick={() => navigate(feature.path)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <feature.icon className={`h-5 w-5 ${feature.color} shrink-0`} />
                <span className="text-sm font-medium group-hover:text-primary transition-colors">
                  {feature.customLabel ?? t(feature.titleKey)}
                </span>
                <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Provider session info */}
      {provider && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('dashboard.sessionSummary')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Provider:</span>
                <span className="ml-2 font-medium">{provider.name ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Base URL:</span>
                <span className="ml-2 font-mono text-xs truncate max-w-xs inline-block align-bottom">
                  {provider.baseUrl}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Auth:</span>
                <span className="ml-2">{provider.authMethod}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className={`ml-2 font-medium ${isConnected ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                  {isConnected ? t('status.connected') : t('status.disconnected')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
