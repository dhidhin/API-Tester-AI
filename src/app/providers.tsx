import { useEffect, type ReactNode } from 'react'
import { useAppSettings } from '@/stores'
import { useTranslation } from 'react-i18next'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const { theme, language } = useAppSettings()
  const { i18n } = useTranslation()

  // Apply theme
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [theme])

  // Apply language
  useEffect(() => {
    i18n.changeLanguage(language)
    document.documentElement.lang = language
  }, [language, i18n])

  return <>{children}</>
}
