/**
 * @purpose Two-pane agent workspace: Chat + Dashboard. Desktop shows them side by
 *   side (Dashboard collapsible); mobile shows one at a time via a Home|Chat switch.
 * @llm-note Each pane is rendered exactly once and shown/hidden with CSS, so the
 *   chat's SDK subscription is never mounted twice.
 *
 *   `hasDashboard` gates the whole Dashboard side. Plenty of agents have no
 *   dashboard.html — anything whose host predates the feature — and there is no
 *   frame that says so, only the absence of a snapshot. Without the gate those
 *   agents get a permanent half-width placeholder on desktop, and on the landing
 *   page (defaultMobileView="home") a mobile user's first view is a placeholder
 *   instead of the chat. So: no dashboard, no pane, no switch.
 */
'use client'

import { useState } from 'react'
import { HiOutlineViewGrid, HiOutlineChatAlt2, HiOutlineChevronRight } from 'react-icons/hi'
import { cn } from '@/components/chat/utils'

interface WorkspaceShellProps {
  chat: React.ReactNode
  dashboard: React.ReactNode
  defaultMobileView?: 'chat' | 'home'
  /** False until the agent's dashboard actually arrives; hides the pane until then. */
  hasDashboard?: boolean
}

export function WorkspaceShell({
  chat,
  dashboard,
  defaultMobileView = 'chat',
  hasDashboard = false,
}: WorkspaceShellProps) {
  // Null until the reader picks a side; their choice then outranks the default forever.
  const [chosenView, chooseView] = useState<'chat' | 'home' | null>(null)
  const [dashboardOpen, setDashboardOpen] = useState(true)

  // Derived, not an effect: honor defaultMobileView only once a snapshot exists, so
  // opening on Home never means opening on a blank pane.
  const mobileView = chosenView ?? (hasDashboard ? defaultMobileView : 'chat')

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Mobile Home | Chat switch — only when there is a Home to switch to */}
      {hasDashboard && (
      <div className="lg:hidden flex items-center gap-1 p-1.5 border-b border-neutral-200 bg-neutral-50">
        <button
          onClick={() => chooseView('home')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors',
            mobileView === 'home' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
          )}
        >
          <HiOutlineViewGrid className="w-4 h-4" /> Home
        </button>
        <button
          onClick={() => chooseView('chat')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors',
            mobileView === 'chat' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
          )}
        >
          <HiOutlineChatAlt2 className="w-4 h-4" /> Chat
        </button>
      </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Chat pane */}
        <div className={cn(
          'flex-1 min-w-0 flex-col',
          mobileView === 'chat' || !hasDashboard ? 'flex' : 'hidden',
          'lg:flex'
        )}>
          {chat}
        </div>

        {/* Dashboard pane */}
        {hasDashboard && (
        <aside className={cn(
          'w-full border-l border-neutral-200 bg-neutral-50 flex-col lg:w-[440px] xl:w-[500px] shrink-0',
          mobileView === 'home' ? 'flex' : 'hidden',
          dashboardOpen ? 'lg:flex' : 'lg:hidden'
        )}>
          <div className="hidden lg:flex items-center justify-between px-4 py-2 border-b border-neutral-200">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Home</span>
            <button
              onClick={() => setDashboardOpen(false)}
              className="p-1 rounded hover:bg-neutral-100 text-neutral-400"
              aria-label="Collapse dashboard"
            >
              <HiOutlineChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0">{dashboard}</div>
        </aside>
        )}

        {/* Collapsed reopen strip (desktop only) */}
        {hasDashboard && !dashboardOpen && (
          <button
            onClick={() => setDashboardOpen(true)}
            className="hidden lg:flex items-center justify-center w-8 border-l border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-400"
            aria-label="Open dashboard"
          >
            <HiOutlineViewGrid className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
