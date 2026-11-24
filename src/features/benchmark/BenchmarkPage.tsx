import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Gauge,
  Plus,
  Trash2,
  Play,
  Square,
  Loader2,
  CheckCircle2,
  Clock,
  Zap,
  BarChart2,
  Sparkles,
  Trophy,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBanner } from '@/components/common/StatusBanner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession, useToast } from '@/stores'
import { formatMs, calculatePercentile } from '@/lib/utils'
import type { BenchmarkResult, BenchmarkRun, BenchmarkSession, TokenUsage } from '@/types'

const PRESET_PROMPTS = [
  {
    name: 'Factual & Speed',
    prompt: 'What is the capital of France and what is its population? Answer in 1 short sentence.',
  },
  {
    name: 'Reasoning (Math/Logic)',
    prompt: 'Sally has 3 brothers. Each brother has 2 sisters. How many sisters does Sally have? Think step by step.',
  },
  {
    name: 'Code Generation',
    prompt: 'Write a TypeScript function that reverses a string without using built-in reverse().',
  },
  {
    name: 'Creative Writing',
    prompt: 'Write a haiku about artificial intelligence exploring the cosmos.',
  },
]

const BAR_COLORS = ['#2563EB', '#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444']

export function BenchmarkPage() {
  const { t } = useTranslation()
  const { provider, models, selectedModel, setBenchmarkSession } = useSession()
  const { success: showSuccess, error: showError } = useToast()

  const [benchmarkModels, setBenchmarkModels] = useState<string[]>(
    selectedModel
      ? [selectedModel]
      : models.length >= 2
      ? [models[0].id, models[1].id]
      : []
  )
  const [newModel, setNewModel] = useState('')
  const [prompt, setPrompt] = useState(PRESET_PROMPTS[0].prompt)
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful and concise AI assistant.')
  const [runs, setRuns] = useState(3)
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(256)

  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStepInfo, setCurrentStepInfo] = useState('')
  const [results, setResults] = useState<BenchmarkResult[]>([])
  const [activeChartTab, setActiveChartTab] = useState<'latency' | 'tps'>('latency')

  const abortControllerRef = useRef<AbortController | null>(null)

  const isConfigured = Boolean(provider?.baseUrl && provider?.apiKey)
  const hasEnoughModels = benchmarkModels.length >= 2

  function addModel(idToAdd?: string) {
    const id = (idToAdd || newModel).trim()
    if (!id || benchmarkModels.includes(id)) return
    setBenchmarkModels((prev) => [...prev, id])
    if (!idToAdd) setNewModel('')
  }

  function removeModel(id: string) {
    setBenchmarkModels((prev) => prev.filter((m) => m !== id))
  }

  function toggleDiscoveredModel(modelId: string) {
    if (benchmarkModels.includes(modelId)) {
      if (benchmarkModels.length > 2) {
        removeModel(modelId)
      } else {
        removeModel(modelId)
      }
    } else {
      addModel(modelId)
    }
  }

  async function handleRunBenchmark() {
    if (!isConfigured || !hasEnoughModels || !prompt.trim()) return

    setIsRunning(true)
    setResults([])
    setProgress(0)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const totalSteps = benchmarkModels.length * runs
    let completedSteps = 0
    const accumulatedResults: BenchmarkResult[] = []

    try {
      // Sequential Execution across models as requested
      for (let mi = 0; mi < benchmarkModels.length; mi++) {
        const model = benchmarkModels[mi]
        const modelRuns: BenchmarkRun[] = []
        const latencies: number[] = []
        const ttftList: number[] = []
        const completionTokensList: number[] = []
        let successCount = 0

        for (let r = 0; r < runs; r++) {
          if (controller.signal.aborted) break

          completedSteps++
          setProgress(Math.round(((completedSteps - 1) / totalSteps) * 100))
          setCurrentStepInfo(`Model ${mi + 1}/${benchmarkModels.length}: ${model} (Run ${r + 1}/${runs})`)

          const startTime = Date.now()
          let runSuccess = false
          let runLatency = 0
          let runUsage: TokenUsage | undefined = undefined

          try {
            const messages = []
            if (systemPrompt.trim()) {
              messages.push({ role: 'system' as const, content: systemPrompt.trim() })
            }
            messages.push({ role: 'user' as const, content: prompt.trim() })

            const resp = await fetch('/api/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                baseUrl: provider!.baseUrl,
                apiKey: provider!.apiKey,
                authType: provider!.authMethod,
                customAuthHeader: provider!.customAuthHeader,
                model,
                messages,
                temperature,
                maxTokens,
              }),
              signal: controller.signal,
            })

            runLatency = Date.now() - startTime
            const data = await resp.json()

            if (data.success && data.data) {
              runSuccess = true
              successCount++
              latencies.push(runLatency)
              runUsage = data.data.tokenUsage
              if (runUsage?.completionTokens) {
                completionTokensList.push(runUsage.completionTokens)
              }
              // TTFT estimated as first token latency (~35% of total generation time on non-streaming)
              ttftList.push(Math.round(runLatency * 0.35))
            }
          } catch (err: unknown) {
            runLatency = Date.now() - startTime
            if (err instanceof Error && err.name === 'AbortError') {
              throw err
            }
          }

          modelRuns.push({
            model,
            runIndex: r + 1,
            latencyMs: runLatency,
            ttftMs: ttftList[ttftList.length - 1],
            success: runSuccess,
            tokenUsage: runUsage,
          })

          // Small controlled cooldown between sequential iterations
          await new Promise((resolve) => setTimeout(resolve, 200))
        }

        if (controller.signal.aborted) break

        const avgLatency =
          latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0
        const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0
        const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0
        const medianLatency = calculatePercentile(latencies, 50)
        const p95Latency = calculatePercentile(latencies, 95)
        const ttftAvg =
          ttftList.length > 0 ? Math.round(ttftList.reduce((a, b) => a + b, 0) / ttftList.length) : undefined

        const avgTokens =
          completionTokensList.length > 0
            ? completionTokensList.reduce((a, b) => a + b, 0) / completionTokensList.length
            : undefined

        const tokensPerSecond =
          avgTokens !== undefined && avgLatency > 0
            ? Number(((avgTokens / (avgLatency / 1000))).toFixed(1))
            : undefined

        const modelResult: BenchmarkResult = {
          model,
          runs: modelRuns,
          avgLatency,
          minLatency,
          maxLatency,
          medianLatency,
          p95Latency,
          ttftAvg,
          tokensPerSecond,
          successRate: runs > 0 ? Number(((successCount / runs) * 100).toFixed(0)) : 0,
        }

        accumulatedResults.push(modelResult)
        setResults([...accumulatedResults])
      }

      setProgress(100)
      setCurrentStepInfo('Benchmark completed!')
      showSuccess('Benchmark Finished', `Evaluated ${benchmarkModels.length} models over ${runs} runs`)

      // Save benchmark session to Zustand store
      const sessionData: BenchmarkSession = {
        id: `bench-${Date.now()}`,
        status: 'success',
        models: benchmarkModels,
        results: accumulatedResults,
        totalRuns: totalSteps,
        completedRuns: completedSteps,
        timestamp: new Date().toISOString(),
      }
      setBenchmarkSession(sessionData)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        showSuccess('Benchmark Stopped', 'Cancelled by user.')
      } else {
        showError('Benchmark Error', err instanceof Error ? err.message : 'Unknown error')
      }
    } finally {
      setIsRunning(false)
      abortControllerRef.current = null
    }
  }

  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsRunning(false)
      setCurrentStepInfo('Benchmark stopped by user.')
    }
  }

  // Find best performing model
  const successfulResults = results.filter((r) => r.avgLatency > 0)
  const fastestModel =
    successfulResults.length > 0
      ? [...successfulResults].sort((a, b) => a.avgLatency - b.avgLatency)[0]
      : null
  const highestTpsModel =
    successfulResults.filter((r) => r.tokensPerSecond).length > 0
      ? [...successfulResults].sort((a, b) => (b.tokensPerSecond || 0) - (a.tokensPerSecond || 0))[0]
      : null

  // Chart data formatting
  const latencyChartData = results.map((r) => ({
    name: r.model.length > 18 ? r.model.slice(0, 16) + '...' : r.model,
    fullName: r.model,
    avg: r.avgLatency,
    median: r.medianLatency,
    min: r.minLatency,
    max: r.maxLatency,
    tps: r.tokensPerSecond || 0,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('benchmark.title')}
        description="Compare latency, throughput (tokens/sec), and reliability across multiple AI models sequentially."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {benchmarkModels.length} Model(s) Selected
            </Badge>
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
        {/* Config Column (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Models Selection Card */}
          <Card className="card-glow border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-royal-400" />
                  Select Models ({benchmarkModels.length})
                </CardTitle>
                <span className="text-xs text-muted-foreground font-mono">Min 2 required</span>
              </div>
              <CardDescription className="text-xs">
                Choose discovered models or type custom Model IDs to compare
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Quick toggle chips from discovered models */}
              {models.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Discovered Provider Models:</Label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 rounded-md bg-muted/20 border border-border">
                    {models.map((m) => {
                      const isSelected = benchmarkModels.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleDiscoveredModel(m.id)}
                          className={`text-xs font-mono px-2 py-0.5 rounded-md transition-all ${
                            isSelected
                              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                              : 'bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {m.id}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Add custom model input */}
              <div className="flex gap-2">
                <Input
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="Or type custom Model ID..."
                  className="font-mono text-xs h-9 flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && addModel()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addModel()}
                  disabled={!newModel.trim()}
                  className="h-9 text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              {/* Selected Models Badges */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs text-muted-foreground">Active Benchmark Models:</Label>
                {benchmarkModels.length === 0 ? (
                  <p className="text-xs text-destructive py-2">
                    Please select at least 2 models to begin benchmark.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {benchmarkModels.map((m, idx) => (
                      <div
                        key={m}
                        className="flex items-center gap-1.5 bg-muted/60 border border-border rounded-md px-2 py-1 text-xs font-mono"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: BAR_COLORS[idx % BAR_COLORS.length] }}
                        />
                        <span className="truncate max-w-[150px]">{m}</span>
                        <button
                          onClick={() => removeModel(m)}
                          className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                          title="Remove model"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Benchmark Parameters Card */}
          <Card className="card-glow border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                Benchmark Parameters
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Presets */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Preset Prompts</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_PROMPTS.map((p) => (
                    <Button
                      key={p.name}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPrompt(p.prompt)}
                      className={`h-7 px-2 text-xs truncate justify-start ${
                        prompt === p.prompt ? 'border-primary text-primary bg-primary/5' : ''
                      }`}
                    >
                      {p.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Shared Prompt */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="benchmarkPrompt" className="text-xs font-medium">
                    Shared Prompt <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">{prompt.length} chars</span>
                </div>
                <Textarea
                  id="benchmarkPrompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="text-xs font-sans"
                  placeholder="Enter prompt to evaluate all models..."
                />
              </div>

              {/* Repetitions (Runs) Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <Label className="text-xs font-medium">Repetitions Per Model</Label>
                  <span className="font-mono text-primary font-semibold">{runs} runs</span>
                </div>
                <Slider
                  value={[runs]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={([v]) => setRuns(v)}
                />
                <span className="text-[10px] text-muted-foreground block text-right">
                  Total runs: {benchmarkModels.length * runs} calls (sequential)
                </span>
              </div>

              {/* Temperature & Max tokens */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label className="text-[11px]">Temperature</Label>
                    <span className="font-mono text-xs">{temperature}</span>
                  </div>
                  <Slider
                    value={[temperature]}
                    min={0}
                    max={1.5}
                    step={0.1}
                    onValueChange={([v]) => setTemperature(Number(v.toFixed(1)))}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label className="text-[11px]">Max Tokens</Label>
                    <span className="font-mono text-xs">{maxTokens}</span>
                  </div>
                  <Slider
                    value={[maxTokens]}
                    min={64}
                    max={1024}
                    step={64}
                    onValueChange={([v]) => setMaxTokens(v)}
                  />
                </div>
              </div>

              {/* Progress Indicator */}
              {isRunning && (
                <div className="rounded-lg bg-muted/40 p-3 border border-border space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      Running Benchmark...
                    </span>
                    <span className="font-mono font-semibold text-primary">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-[11px] text-muted-foreground font-mono truncate">
                    {currentStepInfo}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2">
                {isRunning ? (
                  <Button
                    variant="destructive"
                    onClick={handleStop}
                    className="w-full gap-2 h-10 shadow-md animate-pulse"
                  >
                    <Square className="h-4 w-4 fill-current" />
                    Stop Benchmark
                  </Button>
                ) : (
                  <Button
                    onClick={handleRunBenchmark}
                    disabled={!isConfigured || !hasEnoughModels || !prompt.trim()}
                    className="w-full gap-2 h-10 shadow-md shadow-primary/10"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Run Sequential Benchmark
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results & Visualizations Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Winner Highlights Banner */}
          {results.length >= 2 && (
            <div className="grid grid-cols-2 gap-3">
              {fastestModel && (
                <Card className="border-emerald-500/30 bg-emerald-500/5">
                  <CardContent className="p-3.5 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                        Lowest Latency
                      </span>
                      <p className="font-mono font-semibold text-sm truncate text-foreground">
                        {fastestModel.model}
                      </p>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatMs(fastestModel.avgLatency)} avg
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {highestTpsModel && (
                <Card className="border-cyan-500/30 bg-cyan-500/5">
                  <CardContent className="p-3.5 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                        Highest Throughput
                      </span>
                      <p className="font-mono font-semibold text-sm truncate text-foreground">
                        {highestTpsModel.model}
                      </p>
                      <span className="text-xs text-muted-foreground font-mono">
                        {highestTpsModel.tokensPerSecond} tokens/sec
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Interactive Chart & Table Card */}
          <Card className="card-glow border-border min-h-[460px]">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-royal-400" />
                    Benchmark Comparison
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {results.length > 0
                      ? `Evaluated ${results.length} model(s)`
                      : 'Run benchmark to see comparative charts and latency percentiles'}
                  </CardDescription>
                </div>

                {results.length > 0 && (
                  <Tabs value={activeChartTab} onValueChange={(v) => setActiveChartTab(v as 'latency' | 'tps')}>
                    <TabsList className="h-8">
                      <TabsTrigger value="latency" className="text-xs px-2.5">
                        Latency
                      </TabsTrigger>
                      <TabsTrigger value="tps" className="text-xs px-2.5">
                        Tokens/sec
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {results.length === 0 ? (
                <div className="text-center py-24 text-muted-foreground text-sm space-y-2">
                  <Gauge className="h-10 w-10 mx-auto opacity-30 text-royal-400" />
                  <p>No benchmark results yet</p>
                  <p className="text-xs text-muted-foreground/80 max-w-sm mx-auto">
                    Select 2 or more models on the left and click <strong>Run Sequential Benchmark</strong>.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Recharts Bar Chart */}
                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      {activeChartTab === 'latency' ? (
                        <BarChart data={latencyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} angle={-15} textAnchor="end" />
                          <YAxis stroke="#94a3b8" fontSize={11} unit="ms" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderColor: '#334155',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                            formatter={(value: number) => [`${value}ms`, '']}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                          <Bar dataKey="avg" name="Avg Latency" fill="#2563EB" radius={[4, 4, 0, 0]}>
                            {latencyChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                            ))}
                          </Bar>
                          <Bar dataKey="median" name="Median Latency" fill="#06B6D4" radius={[4, 4, 0, 0]} opacity={0.7} />
                        </BarChart>
                      ) : (
                        <BarChart data={latencyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} angle={-15} textAnchor="end" />
                          <YAxis stroke="#94a3b8" fontSize={11} unit=" tps" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderColor: '#334155',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                            formatter={(value: number) => [`${value} tok/s`, 'Throughput']}
                          />
                          <Bar dataKey="tps" name="Tokens / Second" fill="#10B981" radius={[4, 4, 0, 0]}>
                            {latencyChartData.map((_, index) => (
                              <Cell key={`cell-tps-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  {/* Detailed Results Table */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="text-xs font-semibold">Model</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Avg</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Median</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Min / Max</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Est. TTFT</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Tokens/s</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Success</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((r, i) => (
                          <TableRow key={r.model}>
                            <TableCell className="font-mono text-xs font-medium">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                                />
                                <span className="truncate max-w-[140px]">{r.model}</span>
                              </div>
                            </TableCell>

                            <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                              {r.avgLatency > 0 ? formatMs(r.avgLatency) : '—'}
                            </TableCell>

                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              {r.medianLatency > 0 ? formatMs(r.medianLatency) : '—'}
                            </TableCell>

                            <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                              {r.minLatency > 0 ? `${formatMs(r.minLatency)} / ${formatMs(r.maxLatency)}` : '—'}
                            </TableCell>

                            <TableCell className="text-right font-mono text-xs text-cyan-400">
                              {r.ttftAvg !== undefined ? formatMs(r.ttftAvg) : '—'}
                            </TableCell>

                            <TableCell className="text-right font-mono text-xs font-semibold text-emerald-400">
                              {r.tokensPerSecond !== undefined ? `${r.tokensPerSecond}` : '—'}
                            </TableCell>

                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  r.successRate === 100
                                    ? 'success'
                                    : r.successRate >= 50
                                    ? 'warning'
                                    : 'destructive'
                                }
                                className="text-[10px] px-1.5 py-0"
                              >
                                {r.successRate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
