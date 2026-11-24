import { create } from 'zustand'
import type {
  ProviderConfig,
  ConnectionResult,
  AIModel,
  ChatResult,
  StreamResult,
  BenchmarkSession,
  CompatibilityReport,
  ErrorDiagnostic,
  AppSession,
  Theme,
  Language,
} from '@/types'

// ---- App Settings Store ----
interface AppSettingsState {
  theme: Theme
  language: Language
  sidebarCollapsed: boolean
  mobileMenuOpen: boolean
  setTheme: (theme: Theme) => void
  setLanguage: (language: Language) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setMobileMenuOpen: (open: boolean) => void
  toggleMobileMenu: () => void
}

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return (localStorage.getItem('api-tester-theme') as Theme) ?? 'dark'
  }
  return 'dark'
}

const getInitialLanguage = (): Language => {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return (localStorage.getItem('api-tester-language') as Language) ?? 'en'
  }
  return 'en'
}

export const useAppSettings = create<AppSettingsState>((set) => ({
  theme: getInitialTheme(),
  language: getInitialLanguage(),
  sidebarCollapsed: false,
  mobileMenuOpen: false,

  setTheme: (theme) => {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      localStorage.setItem('api-tester-theme', theme)
    }
    set({ theme })
  },

  setLanguage: (language) => {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      localStorage.setItem('api-tester-language', language)
    }
    set({ language })
  },

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
}))

// ---- Session Store ----
interface SessionState extends AppSession {
  // Provider
  setProvider: (config: ProviderConfig) => void
  clearProvider: () => void

  // Connection
  setConnectionResult: (result: ConnectionResult) => void

  // Models
  setModels: (models: AIModel[]) => void
  setSelectedModel: (modelId: string) => void

  // Chat
  setChatResult: (result: ChatResult) => void
  clearChatHistory: () => void

  // Streaming
  setStreamResult: (result: StreamResult) => void

  // Benchmark
  setBenchmarkSession: (session: BenchmarkSession) => void

  // Compatibility
  setCompatibilityReport: (report: CompatibilityReport) => void

  // Diagnostics
  addDiagnostic: (diagnostic: ErrorDiagnostic) => void
  clearDiagnostics: () => void

  // Session management
  clearSession: () => void
}

const initialSession: AppSession = {
  provider: undefined,
  connectionResult: undefined,
  models: [],
  selectedModel: undefined,
  chatResult: undefined,
  chatHistory: [],
  streamResult: undefined,
  benchmarkSession: undefined,
  compatibilityReport: undefined,
  diagnostics: [],
  report: undefined,
}

export const useSession = create<SessionState>((set) => ({
  ...initialSession,

  setProvider: (provider) => set({ provider }),
  clearProvider: () => set({ provider: undefined, connectionResult: undefined, models: [], selectedModel: undefined }),

  setConnectionResult: (connectionResult) => set({ connectionResult }),

  setModels: (models) => set({ models }),
  setSelectedModel: (selectedModel) => set({ selectedModel }),

  setChatResult: (chatResult) => set({ chatResult }),
  clearChatHistory: () => set({ chatHistory: [], chatResult: undefined }),

  setStreamResult: (streamResult) => set({ streamResult }),

  setBenchmarkSession: (benchmarkSession) => set({ benchmarkSession }),

  setCompatibilityReport: (compatibilityReport) => set({ compatibilityReport }),

  addDiagnostic: (diagnostic) =>
    set((state) => ({ diagnostics: [diagnostic, ...state.diagnostics].slice(0, 50) })),
  clearDiagnostics: () => set({ diagnostics: [] }),

  clearSession: () => set(initialSession),
}))

// ---- UI State Store ----
interface UIState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
  duration?: number
}

let toastCounter = 0

export const useUIStore = create<UIState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastCounter}`
    const duration = toast.duration ?? 4000

    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

// Convenience hook for toasts
export function useToast() {
  const { addToast } = useUIStore()
  return {
    toast: addToast,
    success: (title: string, description?: string) =>
      addToast({ title, description, variant: 'success' }),
    error: (title: string, description?: string) =>
      addToast({ title, description, variant: 'destructive' }),
    info: (title: string, description?: string) =>
      addToast({ title, description }),
  }
}
