/**
 * @purpose Two-pane agent workspace: Chat + Dashboard. Desktop shows them side by
 *   side (Dashboard collapsible); mobile shows one at a time via a Home|Chat switch.
 * @llm-note Each pane is rendered exactly once and shown/hidden with CSS, so the
 *   chat's SDK subscription is never mounted twice.
 */
'use client'

import { useState } from 'react'
import { HiOutlineViewGrid, HiOutlineChatAlt2, HiOutlineChevronRight } from 'react-icons/hi'
import { cn } from '@/components/chat/utils'

interface WorkspaceShellProps {
  chat: React.ReactNode
  dashboard: React.ReactNode
  defaultMobileView?: 'chat' | 'home'
}

export function WorkspaceShell({ chat, dashboard, defaultMobileView = 'chat' }: WorkspaceShellProps) {
  const [mobileView, setMobileView] = useState<'chat' | 'home'>(defaultMobileView)
  const [dashboardOpen, setDashboardOpen] = useState(true)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Mobile Home | Chat switch */}
      <div className="lg:hidden flex items-center gap-1 p-1.5 border-b border-neutral-200 bg-neutral-50">
        <button
          onClick={() => setMobileView('home')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors',
            mobileView === 'home' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
          )}
        >
          <HiOutlineViewGrid className="w-4 h-4" /> Home
        </button>
        <button
          onClick={() => setMobileView('chat')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors',
            mobileView === 'chat' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
          )}
        >
          <HiOutlineChatAlt2 className="w-4 h-4" /> Chat
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Chat pane */}
        <div className={cn(
          'flex-1 min-w-0 flex-col',
          mobileView === 'chat' ? 'flex' : 'hidden',
          'lg:flex'
        )}>
          {chat}
        </div>

        {/* Dashboard pane */}
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

        {/* Collapsed reopen strip (desktop only) */}
        {!dashboardOpen && (
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
