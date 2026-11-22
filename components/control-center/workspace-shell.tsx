/**
 * @purpose One agent workspace, two views: Control Center and Chat. Phone and
 *   desktop share the same layout — one view at a time, full width, behind a
 *   Control Center | Chat switch.
 * @llm-note Each view is rendered exactly once and shown/hidden with CSS, so the
 *   chat's SDK subscription is never mounted twice.
 *
 *   `hasControlCenter` gates the switch. Plenty of agents have no Control Center
 *   — anything whose host predates the feature — and there is no frame that says
 *   so, only the absence of a snapshot. Without the gate those agents would open
 *   on a placeholder instead of the chat. So: no Control Center, no switch.
 *
 *   Which view opens: a conversation link always opens on Chat; the agent page
 *   opens on whatever the reader last chose for this agent, Control Center
 *   until they choose. The choice is kept per agent in localStorage.
 */
'use client'

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/components/chat/utils'
import { useCollapseRail } from '@/components/agent-rail'
import { ViewSwitch, type WorkspaceView } from './view-switch'

interface SwitchState {
  view: WorkspaceView
  choose: (view: WorkspaceView) => void
  attention: WorkspaceView | null
}

const SwitchContext = createContext<SwitchState | null>(null)

/** The switch inside the chat's own desktop header, where the conversation
 *  page has no layout header above it. */
export function WorkspaceControls() {
  const state = useContext(SwitchContext)
  if (!state) return null
  return <ViewSwitch view={state.view} onChange={state.choose} attention={state.attention} />
}

const viewKey = (address: string) => `oo-chat:view:${address}`

function subscribeToStorage(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

/** The view this reader last chose for this agent, or null if they never chose. */
function useRememberedView(address: string) {
  const stored = useSyncExternalStore(subscribeToStorage, () => localStorage.getItem(viewKey(address)), () => null)
  const remembered: WorkspaceView | null = stored === 'home' || stored === 'chat' ? stored : null
  const remember = (view: WorkspaceView) => localStorage.setItem(viewKey(address), view)
  return [remembered, remember] as const
}

interface WorkspaceShellProps {
  agentAddress: string
  /** A conversation link: open on Chat, whatever was remembered. */
  focusConversation?: boolean
  chat: React.ReactNode
  controlCenter: React.ReactNode
  /** True while the chat is holding a prompt the run cannot continue without. */
  chatAwaitsReader?: boolean
  /** A standing fact about the agent — offline, nearly out of credit. Rendered
   *  above both views because it is true of the agent rather than of the
   *  conversation: a notice living inside the chat is invisible to a reader on
   *  the Control Center, who is exactly the person watching a page that has
   *  quietly stopped updating. */
  agentNotice?: React.ReactNode
  /** O Chat-owned current task state. Agent-authored Control Center HTML is a
   *  static snapshot and must never be trusted to report live/approval/terminal state. */
  controlCenterStatus?: React.ReactNode
  /** False until the agent's Control Center actually arrives. */
  hasControlCenter?: boolean
}

export function WorkspaceShell({
  agentAddress,
  chat,
  controlCenter,
  focusConversation = false,
  hasControlCenter = false,
  chatAwaitsReader = false,
  agentNotice,
  controlCenterStatus,
}: WorkspaceShellProps) {
  const [remembered, remember] = useRememberedView(agentAddress)
  // Picked on this page; outranks both the default and the remembered choice.
  const [picked, setPicked] = useState<WorkspaceView | null>(null)
  const opening = focusConversation ? 'chat' : remembered ?? 'home'
  // Derived, not an effect: Control Center only once a snapshot exists, so
  // opening on it never means opening on a blank page.
  const view = hasControlCenter ? picked ?? opening : 'chat'
  const choose = (next: WorkspaceView) => { setPicked(next); remember(next) }
  const attention = chatAwaitsReader ? 'chat' : null

  // Full-screen Control Center folds the agent rail down to one circle.
  useCollapseRail(view === 'home')

  // The layout header above owns a slot for the switch. An effect rather than a
  // ref because that header is rendered by a layout above this tree and only
  // exists after mount. Runs once; the empty deps are the point.
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlot(document.getElementById('workspace-view-switch'))
  }, [])

  return (
    <SwitchContext.Provider value={hasControlCenter ? { view, choose, attention } : null}>
      <div className="flex min-h-0 flex-1 flex-col">
        {hasControlCenter && slot && createPortal(
          <ViewSwitch view={view} onChange={choose} attention={attention} />, slot,
        )}

        {agentNotice}
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className={cn('min-w-0 flex-1 flex-col', view === 'chat' ? 'flex' : 'hidden')}>
            {chat}
          </div>

          {hasControlCenter && (
            <section
              aria-label="Control Center"
              className={cn('min-w-0 flex-1 flex-col overflow-hidden bg-neutral-50', view === 'home' ? 'flex' : 'hidden')}
            >
              {controlCenterStatus}
              <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{controlCenter}</div>
            </section>
          )}
        </div>
      </div>
    </SwitchContext.Provider>
  )
}
