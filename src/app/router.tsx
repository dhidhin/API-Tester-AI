import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ApiPlaygroundPage } from '@/features/connection/ApiPlaygroundPage'
import { ModelExplorerPage } from '@/features/models/ModelExplorerPage'
import { ChatTesterPage } from '@/features/playground/ChatTesterPage'
import { StreamingTestPage } from '@/features/streaming/StreamingTestPage'
import { BenchmarkPage } from '@/features/benchmark/BenchmarkPage'
import { CompatibilityPage } from '@/features/compatibility/CompatibilityPage'
import { DiagnosticsPage } from '@/features/diagnostics/DiagnosticsPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="playground" element={<ApiPlaygroundPage />} />
          <Route path="models" element={<ModelExplorerPage />} />
          <Route path="chat" element={<ChatTesterPage />} />
          <Route path="streaming" element={<StreamingTestPage />} />
          <Route path="benchmark" element={<BenchmarkPage />} />
          <Route path="compatibility" element={<CompatibilityPage />} />
          <Route path="diagnostics" element={<DiagnosticsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
