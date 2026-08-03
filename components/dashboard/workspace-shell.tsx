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

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { HiOutlineViewGrid, HiOutlineChevronRight } from 'react-icons/hi'
import { cn } from '@/components/chat/utils'
import { usePaneWidth, MIN_PANE, MAX_PANE } from './use-pane-width'
import { ViewSwitch } from './view-switch'

interface WorkspaceShellProps {
  chat: React.ReactNode
  dashboard: React.ReactNode
  defaultMobileView?: 'chat' | 'home'
  /** True while the chat is holding a prompt the run cannot continue without. */
  chatAwaitsReader?: boolean
  /** False until the agent's dashboard actually arrives; hides the pane until then. */
  hasDashboard?: boolean
}

export function WorkspaceShell({
  chat,
  dashboard,
  defaultMobileView = 'chat',
  hasDashboard = false,
  chatAwaitsReader = false,
}: WorkspaceShellProps) {
  // Null until the reader picks a side; their choice then outranks the default forever.
  const [chosenView, chooseView] = useState<'chat' | 'home' | null>(null)
  const [dashboardOpen, setDashboardOpen] = useState(true)
  const pane = usePaneWidth()

  // Derived, not an effect: honor defaultMobileView only once a snapshot exists, so
  // opening on Home never means opening on a blank pane.
  const mobileView = chosenView ?? (hasDashboard ? defaultMobileView : 'chat')

  // The header owns the switch now; this finds the slot it left for us. An effect
  // rather than a ref because the header is rendered by a layout above this tree.
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  // The node this reads is rendered by a layout above this tree and only exists
  // after mount, so there is no render-time value to derive. Runs once; the empty
  // deps are the point.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlot(document.getElementById('mobile-view-switch'))
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Into the header, not under it: a second full-width bar in the same fill,
          divided from the first by one hairline, read as a seam. Rendered from
          here because this is the component that knows hasDashboard. */}
      {hasDashboard && slot && createPortal(
        <ViewSwitch view={mobileView} onChange={chooseView} attention={chatAwaitsReader ? 'chat' : null} />, slot,
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
        {hasDashboard && dashboardOpen && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize dashboard"
          aria-valuenow={pane.width}
          aria-valuemin={MIN_PANE}
          aria-valuemax={MAX_PANE}
          tabIndex={0}
          onPointerDown={pane.onPointerDown}
          onPointerMove={pane.onPointerMove}
          onPointerUp={pane.onPointerUp}
          onKeyDown={pane.onKeyDown}
          className={cn(
            'hidden lg:block w-1 shrink-0 cursor-col-resize',
            'hover:bg-neutral-300 focus-visible:bg-neutral-400 focus-visible:outline-none',
            pane.dragging ? 'bg-neutral-400' : 'bg-transparent'
          )}
        />
        )}

        {hasDashboard && (
        <aside
          style={{ ['--pane' as string]: `${pane.width}px` }}
          className={cn(
            'w-full border-l border-neutral-200 bg-neutral-50 flex-col shrink-0 lg:w-[var(--pane)]',
            mobileView === 'home' ? 'flex' : 'hidden',
            dashboardOpen ? 'lg:flex' : 'lg:hidden'
          )}
        >
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
          <div className={cn('flex-1 min-h-0', pane.dragging && 'pointer-events-none select-none')}>{dashboard}</div>
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
