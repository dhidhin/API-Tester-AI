import { AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatusBannerProps {
  variant?: 'info' | 'warning' | 'error'
  message: string
  className?: string
}

export function StatusBanner({ variant = 'info', message, className }: StatusBannerProps) {
  const styles = {
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
  }

  const Icon = variant === 'info' ? Info : AlertTriangle

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-4 py-3 text-sm',
        styles[variant],
        className
      )}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
