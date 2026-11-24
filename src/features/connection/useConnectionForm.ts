import { useState, useEffect } from 'react'
import { useSession, useToast } from '@/stores'
import type { ProviderConfig, AppError, ConnectionResult } from '@/types'

export function useConnectionForm() {
  const {
    provider,
    setProvider,
    connectionResult,
    setConnectionResult,
    models,
    setModels,
    selectedModel,
    setSelectedModel,
    addDiagnostic,
  } = useSession()

  const { success: showSuccess, error: showError } = useToast()

  const [form, setForm] = useState<ProviderConfig>(
    provider ?? {
      name: '',
      baseUrl: '',
      apiKey: '',
      authMethod: 'bearer',
      customAuthHeader: '',
      modelId: selectedModel || '',
    }
  )

  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [backendHealth, setBackendHealth] = useState<'checking' | 'healthy' | 'unreachable'>('checking')

  // Check worker health on mount
  useEffect(() => {
    let mounted = true
    async function checkHealth() {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) })
        if (res.ok && mounted) {
          setBackendHealth('healthy')
        } else if (mounted) {
          setBackendHealth('unreachable')
        }
      } catch {
        if (mounted) setBackendHealth('unreachable')
      }
    }
    checkHealth()
    return () => {
      mounted = false
    }
  }, [])

  function updateField<K extends keyof ProviderConfig>(key: K, value: ProviderConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function applyPreset(
    name: string,
    baseUrl: string,
    authType: 'bearer' | 'x-api-key' = 'bearer',
    defaultModel?: string
  ) {
    setForm((prev) => ({
      ...prev,
      name,
      baseUrl,
      authMethod: authType,
      modelId: defaultModel ?? prev.modelId,
    }))
    if (defaultModel && !selectedModel) {
      setSelectedModel(defaultModel)
    }
  }

  async function handleTestConnection() {
    if (!form.baseUrl || !form.apiKey) return
    setIsTestingConnection(true)

    const startTime = Date.now()

    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: form.baseUrl.trim(),
          apiKey: form.apiKey.trim(),
          authType: form.authMethod,
          customAuthHeader: form.customAuthHeader?.trim() || undefined,
        }),
      })

      const latencyMs = Date.now() - startTime
      const data = await response.json()

      if (data.success && data.data) {
        setProvider(form)
        const result: ConnectionResult = {
          success: true,
          status: 'connected',
          latencyMs: data.data.latencyMs ?? latencyMs,
          httpStatus: data.data.httpStatus ?? response.status,
          timestamp: data.data.timestamp || new Date().toISOString(),
        }
        setConnectionResult(result)
        showSuccess('Connection Successful', `Connected to ${form.name || form.baseUrl} (${result.latencyMs}ms)`)

        if (form.modelId && form.modelId.trim()) {
          setSelectedModel(form.modelId.trim())
        }
      } else {
        const error: AppError = data.error || {
          code: `HTTP_${response.status}`,
          message: `Connection failed with status ${response.status}`,
          httpStatus: response.status,
        }

        const result: ConnectionResult = {
          success: false,
          status: 'error',
          latencyMs,
          httpStatus: response.status,
          error,
          timestamp: new Date().toISOString(),
        }
        setConnectionResult(result)

        // Add to diagnostics history
        addDiagnostic({
          code: error.code,
          category: error.category || 'Connection Error',
          message: error.message,
          httpStatus: error.httpStatus,
          possibleCauses: error.possibleCauses || ['Failed to authenticate or reach provider.'],
          recommendations: error.recommendations || ['Check credentials and Base URL.'],
          timestamp: new Date().toISOString(),
        })

        showError(`Connection Failed (${error.code})`, error.message)
      }
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime
      const errorMsg = err instanceof Error ? err.message : 'Network error'

      const error: AppError = {
        code: 'PROXY_UNREACHABLE',
        category: 'Worker Error',
        message: `Could not reach Cloudflare Worker: ${errorMsg}`,
        httpStatus: 0,
        possibleCauses: ['Cloudflare Worker is starting up or dev server proxy is not responding.'],
        recommendations: ['Check if npm run dev is running properly.'],
      }

      setConnectionResult({
        success: false,
        status: 'error',
        latencyMs,
        error,
        timestamp: new Date().toISOString(),
      })

      addDiagnostic({
        code: error.code,
        category: error.category!,
        message: error.message,
        possibleCauses: error.possibleCauses!,
        recommendations: error.recommendations!,
        timestamp: new Date().toISOString(),
      })

      showError('Connection Error', error.message)
    } finally {
      setIsTestingConnection(false)
    }
  }

  async function handleFetchModels() {
    if (!form.baseUrl || !form.apiKey) return
    setIsFetchingModels(true)

    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: form.baseUrl.trim(),
          apiKey: form.apiKey.trim(),
          authType: form.authMethod,
          customAuthHeader: form.customAuthHeader?.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (data.success && data.data) {
        setProvider(form)
        const fetchedModels = data.data.models || []
        setModels(fetchedModels)

        if (fetchedModels.length > 0 && !selectedModel) {
          setSelectedModel(fetchedModels[0].id)
        }

        showSuccess('Models Discovered', `Found ${fetchedModels.length} model(s) from provider`)
      } else {
        const error = data.error || { message: 'Failed to retrieve models list.' }
        showError('Fetch Models Failed', error.message)

        addDiagnostic({
          code: error.code || 'FETCH_MODELS_FAILED',
          category: 'Model Discovery Error',
          message: error.message,
          httpStatus: error.httpStatus || response.status,
          possibleCauses: error.possibleCauses || ['The provider may not support GET /models or requires specific privileges.'],
          recommendations: error.recommendations || ['Enter your Model ID manually if /models is restricted.'],
          timestamp: new Date().toISOString(),
        })
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Network error'
      showError('Fetch Models Error', errorMsg)
    } finally {
      setIsFetchingModels(false)
    }
  }

  function handleApplyManualModel(modelIdToApply?: string) {
    const target = (modelIdToApply || form.modelId || '').trim()
    if (!target) return

    setSelectedModel(target)
    updateField('modelId', target)

    // Add to models list if not already present
    const exists = models.some((m) => m.id === target)
    if (!exists) {
      setModels([{ id: target, status: 'available' }, ...models])
    }

    showSuccess('Model Selected', `Active model set to: ${target}`)
  }

  function handleClearForm() {
    setForm({
      name: '',
      baseUrl: '',
      apiKey: '',
      authMethod: 'bearer',
      customAuthHeader: '',
      modelId: '',
    })
  }

  return {
    form,
    isTestingConnection,
    isFetchingModels,
    backendHealth,
    connectionResult,
    handleTestConnection,
    handleFetchModels,
    handleApplyManualModel,
    handleClearForm,
    applyPreset,
    updateField,
  }
}
