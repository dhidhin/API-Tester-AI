import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Moon, Sun, Globe, Trash2, Monitor, Menu } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog'
import { useAppSettings, useSession, useToast } from '@/stores'
import { maskApiKey } from '@/lib/utils'
import type { Theme, Language } from '@/types'

export function Topbar() {
  const { t } = useTranslation()
  const { theme, language, setTheme, setLanguage, toggleMobileMenu } = useAppSettings()
  const { provider, connectionResult, selectedModel, clearSession } = useSession()
  const { success } = useToast()
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  const isConnected = connectionResult?.success === true

  const handleConfirmClearSession = () => {
    clearSession()
    setClearDialogOpen(false)
    success(t('common.sessionCleared') || 'Session cleared successfully')
  }

  const themeOptions: { value: Theme; label: string; icon: typeof Moon }[] = [
    { value: 'dark', label: t('common.dark') || 'Dark', icon: Moon },
    { value: 'light', label: t('common.light') || 'Light', icon: Sun },
    { value: 'system', label: t('common.system') || 'System', icon: Monitor },
  ]

  const langOptions: { value: Language; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'id', label: 'Indonesia' },
  ]

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <header className="h-14 border-b border-border flex items-center px-3 sm:px-4 gap-2 sm:gap-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-foreground -ml-1"
        onClick={toggleMobileMenu}
        aria-label="Toggle navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Provider info */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {provider ? (
          <>
            <div className={`status-dot shrink-0 ${isConnected ? 'status-dot-success' : 'status-dot-error'}`} />
            <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[120px] sm:max-w-[200px]" title={provider.name ?? provider.baseUrl}>
              {provider.name ?? provider.baseUrl}
            </span>
            {selectedModel && (
              <>
                <Separator orientation="vertical" className="h-4 hidden sm:block" />
                <Badge variant="cyan" className="text-[11px] sm:text-xs font-mono truncate max-w-[110px] sm:max-w-[180px] hidden sm:inline-flex">
                  {selectedModel}
                </Badge>
              </>
            )}
            {provider.apiKey && (
              <>
                <Separator orientation="vertical" className="h-4 hidden md:block" />
                <span className="text-xs text-muted-foreground font-mono hidden md:inline">
                  {maskApiKey(provider.apiKey)}
                </span>
              </>
            )}
          </>
        ) : (
          <span className="text-xs sm:text-sm text-muted-foreground truncate">
            {t('common.notConfigured') || 'No Provider Configured'}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1">
        {/* Theme switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Toggle theme">
              <ThemeIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuLabel className="text-xs">{t('common.theme') || 'Theme'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setTheme(value)}
                className={theme === value ? 'text-primary' : ''}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Language switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Toggle language">
              <Globe className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuLabel className="text-xs">{t('common.language') || 'Language'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {langOptions.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setLanguage(value)}
                className={language === value ? 'text-primary' : ''}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear session with confirmation modal */}
        {provider && (
          <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('common.clearSession') || 'Clear Session'}
                title={t('common.clearSession') || 'Clear Session'}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Active Session?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will completely clear your current in-memory provider credentials, connection status, discovered models, chat history, and benchmark results. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmClearSession}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear Session
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </header>
  )
}
