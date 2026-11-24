import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ToastContainer } from '../common/ToastContainer'
import { useAppSettings } from '@/stores'

export function DashboardLayout() {
  const { mobileMenuOpen, setMobileMenuOpen } = useAppSettings()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer panel */}
          <div className="relative z-10 w-64 max-w-[80vw] h-full shadow-2xl bg-sidebar flex flex-col border-r border-sidebar-border">
            <Sidebar isMobile onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="container mx-auto max-w-7xl p-3 sm:p-5 lg:p-6 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}
