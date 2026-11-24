export function sanitizeBaseUrl(rawUrl?: string): string {
  if (!rawUrl) return ''
  try {
    const parsed = new URL(rawUrl)
    parsed.username = ''
    parsed.password = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return rawUrl.replace(/\/\/[^@/]+@/, '//')
  }
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function generateHtmlReport(report: Record<string, unknown>): string {
  const timestamp = new Date().toLocaleString()
  const provider = report.provider as Record<string, unknown> | undefined
  const connectionTest = (report.connection ?? report.connectionTest) as Record<string, unknown> | null
  const chatTest = report.chat as Record<string, unknown> | null
  const streamTest = report.stream as Record<string, unknown> | null
  const diagnostics = (report.diagnostics ?? []) as Array<Record<string, unknown>>

  const benchmark = report.benchmark as {
    modelIds?: string[]
    prompt?: string
    runs?: number
    results?: Array<{
      model: string
      runsCount: number
      avgLatency: number
      medianLatency: number
      minLatency: number
      maxLatency: number
      ttftAvg?: number
      tokensPerSecond?: number
      successRate: number
    }>
    summary?: {
      fastestModel?: string
      mostConsistentModel?: string
      totalRuns?: number
      totalDurationMs?: number
    }
  } | null

  const compatibility = report.compatibility as {
    tools?: Array<{
      id?: string
      name?: string
      tool?: string
      toolLabel?: string
      category?: string
      status: 'compatible' | 'partial' | 'unsupported' | 'not_verified'
      note?: string
      notes?: string
    }>
  } | null

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'compatible':
        return 'badge-success'
      case 'partial':
        return 'badge-warning'
      case 'unsupported':
        return 'badge-error'
      default:
        return 'badge-neutral'
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'compatible':
        return 'Compatible'
      case 'partial':
        return 'Partially Compatible'
      case 'unsupported':
        return 'Unsupported'
      default:
        return 'Not Verified'
    }
  }

  const sanitizedBaseUrl = sanitizeBaseUrl(provider?.baseUrl as string | undefined)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Tester AI — Comprehensive Test Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0b1120; color: #e2e8f0; padding: 2rem; line-height: 1.5; }
    .container { max-width: 960px; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin-bottom: 0.35rem; font-weight: 700; color: #f8fafc; letter-spacing: -0.025em; }
    h2 { font-size: 1.15rem; margin-top: 2rem; margin-bottom: 0.85rem; color: #38bdf8; border-bottom: 1px solid #1e3a5f; padding-bottom: 0.5rem; font-weight: 600; }
    .meta { color: #94a3b8; font-size: 0.875rem; margin-bottom: 2rem; }
    .card { background: #151f32; border: 1px solid #1e3a5f; border-radius: 0.625rem; padding: 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25); }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 0.55rem 0; border-bottom: 1px solid rgba(30, 58, 95, 0.4); font-size: 0.875rem; }
    .row:last-child { border: 0; }
    .label { color: #94a3b8; font-weight: 500; }
    .value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #f1f5f9; }
    .badge { display: inline-block; padding: 0.2rem 0.65rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.025em; }
    .badge-success { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-warning { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-error { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .badge-neutral { background: rgba(100, 116, 139, 0.15); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.3); }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.875rem; }
    th { text-align: left; padding: 0.65rem 0.75rem; color: #94a3b8; font-weight: 600; border-bottom: 1px solid #1e3a5f; }
    td { padding: 0.65rem 0.75rem; border-bottom: 1px solid rgba(30, 58, 95, 0.3); }
    tr:last-child td { border: 0; }
    .code-val { font-family: ui-monospace, SFMono-Regular, monospace; }
    .security-note { background: #0f172a; border: 1px solid #1e293b; border-left: 4px solid #0284c7; border-radius: 0.5rem; padding: 0.85rem 1.25rem; font-size: 0.8rem; color: #cbd5e1; margin-top: 2rem; }
    .advisory-note { background: #1e1b4b; border: 1px solid #3730a3; border-left: 4px solid #818cf8; border-radius: 0.5rem; padding: 0.85rem 1.25rem; font-size: 0.8rem; color: #c7d2fe; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔌 API Tester AI — Comprehensive Test Report</h1>
    <p class="meta">Generated: ${timestamp} • Engine Version: ${report.version ?? '1.0.0'}</p>

    <!-- Provider Information -->
    <h2>Provider Information</h2>
    <div class="card">
      <div class="row"><span class="label">Provider Name</span><span class="value">${provider?.name ?? '—'}</span></div>
      <div class="row"><span class="label">Base URL (Credentials Stripped)</span><span class="value">${sanitizedBaseUrl || '—'}</span></div>
      <div class="row"><span class="label">Auth Method</span><span class="value">${provider?.authMethod ?? '—'}</span></div>
      <div class="row"><span class="label">Selected Model</span><span class="value">${report.model ?? '—'}</span></div>
      <div class="row"><span class="label">API Key</span><span class="value" style="color:#64748b">[REDACTED FOR SECURITY]</span></div>
    </div>

    <!-- Connection Test -->
    <h2>Connection Test (FR-01)</h2>
    <div class="card">
      ${connectionTest
        ? `<div class="row"><span class="label">Connection Status</span><span class="badge ${connectionTest.success ? 'badge-success' : 'badge-error'}">${connectionTest.success ? 'SUCCESS' : 'FAILED'}</span></div>
           <div class="row"><span class="label">Ping Latency</span><span class="value">${connectionTest.latencyMs ?? '—'} ms</span></div>
           <div class="row"><span class="label">HTTP Status Code</span><span class="value">${connectionTest.httpStatus ?? '—'}</span></div>`
        : '<p style="color:#64748b;font-size:0.875rem">No connection test conducted in this session.</p>'
      }
    </div>

    <!-- Chat Playground Test -->
    <h2>Chat Playground Test (FR-03)</h2>
    <div class="card">
      ${chatTest
        ? `<div class="row"><span class="label">Chat Status</span><span class="badge ${chatTest.success ? 'badge-success' : 'badge-error'}">${chatTest.success ? 'SUCCESS' : 'FAILED'}</span></div>
           <div class="row"><span class="label">HTTP Status Code</span><span class="value">${chatTest.httpStatus ?? '—'}</span></div>
           <div class="row"><span class="label">Response Duration</span><span class="value">${chatTest.latencyMs ?? '—'} ms</span></div>
           ${chatTest.tokenUsage ? `
           <div class="row"><span class="label">Token Usage</span><span class="value">Prompt: ${(chatTest.tokenUsage as Record<string, number>).promptTokens ?? 0} | Completion: ${(chatTest.tokenUsage as Record<string, number>).completionTokens ?? 0} | Total: ${(chatTest.tokenUsage as Record<string, number>).totalTokens ?? 0}</span></div>
           ` : ''}`
        : '<p style="color:#64748b;font-size:0.875rem">No non-streaming chat test executed in this session.</p>'
      }
    </div>

    <!-- Streaming Test -->
    <h2>Streaming Test (FR-04)</h2>
    <div class="card">
      ${streamTest
        ? `<div class="row"><span class="label">Streaming Status</span><span class="badge ${streamTest.success ? 'badge-success' : 'badge-error'}">${streamTest.success ? 'SUCCESS' : 'FAILED'}</span></div>
           <div class="row"><span class="label">Time to First Token (TTFT)</span><span class="value">${streamTest.ttftMs ? `${streamTest.ttftMs} ms` : '—'}</span></div>
           <div class="row"><span class="label">Total Stream Duration</span><span class="value">${streamTest.totalDurationMs ? `${streamTest.totalDurationMs} ms` : '—'}</span></div>`
        : '<p style="color:#64748b;font-size:0.875rem">No streaming test executed in this session.</p>'
      }
    </div>

    <!-- Benchmark Results -->
    ${benchmark && benchmark.results && benchmark.results.length > 0 ? `
    <h2>Sequential Multi-Model Benchmark (FR-05)</h2>
    <div class="card">
      <div class="row"><span class="label">Total Runs</span><span class="value">${benchmark.summary?.totalRuns ?? (benchmark.results.length * (benchmark.runs ?? 1))}</span></div>
      <div class="row"><span class="label">Fastest Model</span><span class="value">${benchmark.summary?.fastestModel ?? '—'}</span></div>
      <div class="row"><span class="label">Most Consistent</span><span class="value">${benchmark.summary?.mostConsistentModel ?? '—'}</span></div>
      <table style="margin-top: 1rem;">
        <thead>
          <tr>
            <th>Model</th>
            <th>Runs</th>
            <th>Avg Latency</th>
            <th>Median</th>
            <th>Min / Max</th>
            <th>TTFT</th>
            <th>Speed</th>
            <th>Success Rate</th>
          </tr>
        </thead>
        <tbody>
          ${benchmark.results.map(r => `
            <tr>
              <td class="code-val" style="color:#38bdf8;font-weight:600;">${r.model}</td>
              <td class="code-val">${r.runsCount}</td>
              <td class="code-val">${r.avgLatency} ms</td>
              <td class="code-val">${r.medianLatency} ms</td>
              <td class="code-val">${r.minLatency} / ${r.maxLatency} ms</td>
              <td class="code-val">${r.ttftAvg ? `${r.ttftAvg} ms` : '—'}</td>
              <td class="code-val">${r.tokensPerSecond ? `${r.tokensPerSecond} tok/s` : '—'}</td>
              <td><span class="badge ${r.successRate === 100 ? 'badge-success' : r.successRate > 0 ? 'badge-warning' : 'badge-error'}">${r.successRate}%</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>` : ''}

    <!-- Coding Tool Compatibility Matrix -->
    ${compatibility && compatibility.tools && compatibility.tools.length > 0 ? `
    <h2>Coding Tool Compatibility Matrix (FR-06)</h2>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Tool / SDK</th>
            <th>Category</th>
            <th>Compatibility Status</th>
            <th>Verification Notes</th>
          </tr>
        </thead>
        <tbody>
          ${compatibility.tools.map(tool => `
            <tr>
              <td style="color:#f8fafc;font-weight:600;">${tool.name ?? tool.toolLabel ?? tool.tool}</td>
              <td style="color:#94a3b8;">${tool.category ?? 'Coding Assistant'}</td>
              <td><span class="badge ${statusBadgeClass(tool.status)}">${statusLabel(tool.status)}</span></td>
              <td style="color:#cbd5e1;font-size:0.8rem;">${tool.notes ?? tool.note ?? '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="advisory-note">
        💡 <strong>Google Antigravity Notice:</strong> Google Antigravity uses native Gemini intelligence infrastructure and does not officially support custom OpenAI-compatible BYOK endpoints in the IDE.
      </div>
    </div>` : ''}

    <!-- Diagnostics History -->
    <h2>Error Diagnostics History (${diagnostics.length})</h2>
    <div class="card">
      ${diagnostics.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>HTTP Status</th>
            <th>Error Code</th>
            <th>Category</th>
            <th>Diagnostic Message</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          ${diagnostics.map(d => `
            <tr>
              <td class="code-val">${d.httpStatus ? `HTTP ${d.httpStatus}` : '—'}</td>
              <td class="code-val" style="color:#f87171;font-weight:600;">${d.code}</td>
              <td style="color:#94a3b8;">${d.category}</td>
              <td style="color:#e2e8f0;font-size:0.8rem;">${d.message}</td>
              <td style="color:#64748b;font-size:0.75rem;">${new Date(d.timestamp as string).toLocaleTimeString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : '<p style="color:#64748b;font-size:0.875rem">No errors logged during this session.</p>'}
    </div>

    <!-- Security & Privacy Note -->
    <div class="security-note">
      🔒 <strong>Security Policy:</strong> API credentials and secrets are never included or stored in exported reports. Base URLs have any embedded credentials stripped. All evaluations were executed in-memory during this active session.
    </div>

    <div style="text-align:center;margin-top:2.5rem;font-size:0.75rem;color:#475569">
      API Tester AI • Modern Enterprise AI Testing Suite v1.0.0
    </div>
  </div>
</body>
</html>`
}
