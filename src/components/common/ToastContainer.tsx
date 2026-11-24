import { useUIStore } from '@/stores'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
      {toasts.map((toast) => {
        const Icon =
          toast.variant === 'success'
            ? CheckCircle2
            : toast.variant === 'destructive'
            ? AlertCircle
            : Info

        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 shadow-lg animate-fade-in',
              'bg-card text-card-foreground',
              toast.variant === 'destructive' && 'border-destructive/50 bg-destructive/10',
              toast.variant === 'success' && 'border-emerald-500/50 bg-emerald-500/10',
              (!toast.variant || toast.variant === 'default') && 'border-border'
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 mt-0.5 shrink-0',
                toast.variant === 'destructive' && 'text-destructive',
                toast.variant === 'success' && 'text-emerald-500',
                (!toast.variant || toast.variant === 'default') && 'text-primary'
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-none">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-muted-foreground mt-1">{toast.description}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-muted-foreground hover:text-foreground -mr-1 -mt-1"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
