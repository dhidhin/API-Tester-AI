import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { cn, copyToClipboard } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
  maxHeight?: string
}

export function CodeBlock({ code, language = 'json', className, maxHeight = '400px' }: CodeBlockProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await copyToClipboard(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('relative group rounded-lg overflow-hidden border border-border', className)}>
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">{language}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          title={t('common.copy')}
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
      <pre
        className="p-4 text-xs font-mono text-foreground overflow-auto bg-background/50"
        style={{ maxHeight }}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}
