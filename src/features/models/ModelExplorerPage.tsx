import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Database, RefreshCw, Search, CheckCircle2, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBanner } from '@/components/common/StatusBanner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSession, useToast } from '@/stores'
import { formatNumber } from '@/lib/utils'
import type { AIModel } from '@/types'

export function ModelExplorerPage() {
  const { t } = useTranslation()
  const { provider, models, selectedModel, setModels, setSelectedModel } = useSession()
  const { error: showError } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [manualModelId, setManualModelId] = useState('')
  const [isFetching, setIsFetching] = useState(false)

  const filteredModels = models.filter((m) =>
    searchQuery
      ? m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      : true
  )

  async function handleFetchModels() {
    if (!provider) return
    setIsFetching(true)
    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          authType: provider.authMethod,
          customAuthHeader: provider.customAuthHeader,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setModels(data.data?.models ?? [])
      } else {
        showError(t('common.error'), data.error?.message)
      }
    } catch {
      showError('Worker unavailable', 'Start the Cloudflare Worker with: npm run worker:dev')
    } finally {
      setIsFetching(false)
    }
  }

  function handleSelectManualModel() {
    if (!manualModelId.trim()) return
    setSelectedModel(manualModelId.trim())
    // Add to list if not already there
    const existing = models.find((m) => m.id === manualModelId.trim())
    if (!existing) {
      setModels([...models, { id: manualModelId.trim(), status: 'available' }])
    }
    setManualModelId('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('models.title')}
        description={t('models.description')}
        actions={
          <Button
            onClick={handleFetchModels}
            disabled={!provider || isFetching}
            className="gap-2"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t('models.fetchModels')}
          </Button>
        }
      />

      {!provider && (
        <StatusBanner variant="warning" message={t('errors.noProviderConfig')} />
      )}

      {/* Manual Model ID */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('models.manualModelId')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('models.manualModelIdDesc')}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={manualModelId}
                onChange={(e) => setManualModelId(e.target.value)}
                placeholder="e.g. llama-3.3-70b-versatile, deepseek-chat, gpt-4o-mini"
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleSelectManualModel()}
              />
              <Button
                variant="outline"
                onClick={handleSelectManualModel}
                disabled={!manualModelId.trim()}
              >
                {t('models.useThisModel')}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-muted-foreground">Popular Models:</span>
              {[
                'llama-3.3-70b-versatile',
                'deepseek-chat',
                'gpt-4o-mini',
                'gemini-1.5-flash',
                'mistral-small-latest',
                'meta-llama/llama-3.3-70b-instruct:free',
              ].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setManualModelId(sug)}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60 bg-muted/30 text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" />
              {t('models.title')}
              {models.length > 0 && (
                <Badge variant="secondary">{t('models.totalModels', { count: models.length })}</Badge>
              )}
            </CardTitle>
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('models.searchModels')}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredModels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {models.length === 0 ? t('models.noModels') : 'No models match your search'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t('models.modelId')}</TableHead>
                  <TableHead>{t('models.ownedBy')}</TableHead>
                  <TableHead>{t('models.contextLength')}</TableHead>
                  <TableHead>{t('models.status')}</TableHead>
                  <TableHead className="text-right pr-4">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.map((model: AIModel) => (
                  <TableRow key={model.id} className={selectedModel === model.id ? 'bg-primary/5' : ''}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2">
                        {selectedModel === model.id && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                        <span className="font-mono text-xs">{model.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {model.ownedBy ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {model.contextLength ? formatNumber(model.contextLength) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={model.status === 'available' ? 'success' : 'outline'}
                        className="text-xs"
                      >
                        {model.status === 'available' ? t('models.available') : model.status ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      {selectedModel === model.id ? (
                        <Badge variant="cyan" className="text-xs">{t('models.selected')}</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setSelectedModel(model.id)}
                        >
                          {t('models.useThisModel')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
