import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function formatNumber(n: number): string {
  return n.toLocaleString()
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function sanitizeBaseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`
  } catch {
    return url
  }
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••'
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
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

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

export function getStatusColor(status: 'success' | 'error' | 'warning' | 'idle' | 'running'): string {
  const map: Record<string, string> = {
    success: 'text-emerald-500',
    error: 'text-red-500',
    warning: 'text-amber-500',
    idle: 'text-muted-foreground',
    running: 'text-blue-400',
  }
  return map[status] ?? 'text-muted-foreground'
}

export function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (['success', 'compatible', 'connected'].includes(status.toLowerCase())) return 'default'
  if (['error', 'failed', 'unsupported'].includes(status.toLowerCase())) return 'destructive'
  if (['warning', 'partial', 'partially'].includes(status.toLowerCase())) return 'secondary'
  return 'outline'
}

export function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
