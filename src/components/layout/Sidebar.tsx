import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Plug,
  Database,
  MessageSquare,
  Zap,
  GitCompare,
  Bug,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Gauge,
  X,
} from 'lucide-react'
import { useAppSettings } from '@/stores'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'

const navItems = [
  { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', end: true },
  { to: '/playground', icon: Plug, labelKey: 'nav.apiPlayground' },
  { to: '/models', icon: Database, labelKey: 'nav.modelExplorer' },
  { to: '/chat', icon: MessageSquare, labelKey: 'nav.chatTester' },
  { to: '/streaming', icon: Zap, labelKey: 'nav.benchmark', customLabel: 'Streaming Test' },
  { to: '/benchmark', icon: Gauge, labelKey: 'nav.benchmark' },
  { to: '/compatibility', icon: GitCompare, labelKey: 'nav.compatibility' },
  { to: '/diagnostics', icon: Bug, labelKey: 'nav.diagnostics' },
  { to: '/reports', icon: FileText, labelKey: 'nav.reports' },
]

const bottomItems = [
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
]

function NavItem({
  to,
  icon: Icon,
  label,
  end,
  collapsed,
  onClick,
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  end?: boolean
  collapsed: boolean
  onClick?: () => void
}) {
  const item = (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
          'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold',
          collapsed && 'justify-center px-2'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return item
}

interface SidebarProps {
  isMobile?: boolean
  onNavigate?: () => void
}

export function Sidebar({ isMobile = false, onNavigate }: SidebarProps) {
  const { t } = useTranslation()
  const { sidebarCollapsed, toggleSidebar, setMobileMenuOpen } = useAppSettings()

  const isCollapsed = isMobile ? false : sidebarCollapsed

  const navLabels: Record<string, string> = {
    'nav.dashboard': t('nav.dashboard') || 'Dashboard',
    'nav.apiPlayground': t('nav.apiPlayground') || 'API Playground',
    'nav.modelExplorer': t('nav.modelExplorer') || 'Model Explorer',
    'nav.chatTester': t('nav.chatTester') || 'Chat Tester',
    'nav.benchmark': t('nav.benchmark') || 'Benchmark',
    'nav.compatibility': t('nav.compatibility') || 'Compatibility',
    'nav.diagnostics': t('nav.diagnostics') || 'Diagnostics',
    'nav.reports': t('nav.reports') || 'Reports',
    'nav.settings': t('nav.settings') || 'Settings',
  }

  const streamingLabel = 'Streaming Test'

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 shrink-0 select-none',
          isMobile ? 'w-full' : isCollapsed ? 'w-14' : 'w-60'
        )}
      >
        {/* Logo and Mobile Close */}
        <div
          className={cn(
            'flex items-center border-b border-sidebar-border h-14',
            !isMobile && isCollapsed ? 'justify-center px-2' : 'px-4 justify-between'
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md">
              <Plug className="h-4 w-4 text-white" />
            </div>
            {(!isCollapsed || isMobile) && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-sidebar-foreground leading-none tracking-tight">
                  API Tester
                </span>
                <span className="text-[11px] text-cyan-400 font-semibold leading-none mt-1">AI ENTERPRISE</span>
              </div>
            )}
          </div>
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground/70"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3">
          <nav className={cn('flex flex-col gap-0.5', isCollapsed ? 'px-1' : 'px-2')}>
            {navItems.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={
                  item.to === '/streaming'
                    ? streamingLabel
                    : navLabels[item.labelKey] ?? item.labelKey
                }
                end={item.end}
                collapsed={isCollapsed}
                onClick={onNavigate}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* Bottom nav */}
        <div className={cn('border-t border-sidebar-border py-2', isCollapsed ? 'px-1' : 'px-2')}>
          {bottomItems.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={navLabels[item.labelKey] ?? item.labelKey}
              collapsed={isCollapsed}
              onClick={onNavigate}
            />
          ))}
        </div>

        {/* Desktop Collapse toggle */}
        {!isMobile && (
          <div
            className={cn(
              'border-t border-sidebar-border p-2 flex',
              isCollapsed ? 'justify-center' : 'justify-end'
            )}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleSidebar}
              className="text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              aria-label="Toggle sidebar"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </aside>
    </TooltipProvider>
  )
}
