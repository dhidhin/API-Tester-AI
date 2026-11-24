import { useTranslation } from 'react-i18next'
import { Moon, Sun, Globe, Monitor, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
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
} from '@/components/ui/alert-dialog'
import { useAppSettings, useSession, useToast } from '@/stores'
import type { Theme, Language } from '@/types'

export function SettingsPage() {
  const { t } = useTranslation()
  const { theme, language, setTheme, setLanguage } = useAppSettings()
  const { clearSession } = useSession()
  const { success } = useToast()

  const handleClearSession = () => {
    clearSession()
    success(t('common.sessionCleared'))
  }

  const themeOptions: { value: Theme; label: string; icon: typeof Moon }[] = [
    { value: 'dark', label: t('common.dark'), icon: Moon },
    { value: 'light', label: t('common.light'), icon: Sun },
    { value: 'system', label: t('common.system'), icon: Monitor },
  ]

  const langOptions: { value: Language; label: string }[] = [
    { value: 'en', label: t('settings.languageEn') },
    { value: 'id', label: t('settings.languageId') },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
      />

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.appearance')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">{t('settings.themeMode')}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose the visual appearance of the application
              </p>
            </div>
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    theme === value
                      ? 'bg-background text-foreground shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">{t('settings.language')}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select the display language
              </p>
            </div>
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {langOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setLanguage(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    language === value
                      ? 'bg-background text-foreground shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.session')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t('common.clearSession')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('settings.clearSessionDesc')}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2 shrink-0">
                  <Trash2 className="h-4 w-4" />
                  {t('common.clearSession')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('common.clearSession')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('settings.clearSessionWarning')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearSession}>
                    {t('common.confirm')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.about')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('settings.version')}</span>
            <span className="font-mono">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stack</span>
            <span>React + TypeScript + Vite + Cloudflare Workers</span>
          </div>
          <Separator className="my-3" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('settings.appDescription')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
