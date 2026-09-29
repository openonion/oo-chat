'use client'

import Image from 'next/image'
import { useState, useMemo, useEffect, useEffectEvent, useRef, type RefObject } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  HiOutlineCog,
  HiOutlineX,
  HiOutlinePlus,
  HiOutlineSearch,
  HiOutlineSparkles,
  HiOutlineDotsHorizontal,
} from 'react-icons/hi'
import { useChatStore } from '@/store/chat-store'
import { shortAddress, useAgentInfo } from '@/hooks/use-agent-info'
import { AgentAvatar } from '@/components/agent-avatar'
import { orderAgents } from '@/lib/agent-order'
import { SessionList } from '@/components/session-list'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useRecentChatSync } from '@/hooks/use-recent-chat-sync'
// O Chat consumes the React integration package directly, so this is the
// version the sidebar chip names.
import connectonionPackage from '@connectonion/react/package.json'

const connectonionVersion = connectonionPackage.version

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}

export function Sidebar({ isOpen, onClose, returnFocusRef }: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const close = useEffectEvent(onClose)

  useEffect(() => {
    if (!isOpen) return
    // The main pane becomes inert as the drawer opens. That blurs the menu
    // button, so keep its ref instead of reading document.activeElement here.
    const focusTarget = returnFocusRef.current
    // Visibility is a discrete CSS transition on this drawer. Wait for its
    // 200 ms opening transition before focusing a child of the visible panel.
    const focusTimer = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 210)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter(element => element.getClientRects().length > 0)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true })
    }
  }, [isOpen, returnFocusRef])

  const router = useRouter()
  const pathname = usePathname()
  const { agents, conversations, deleteConversation, removeAgent } = useChatStore()
  const { archiveConversation } = useRecentChatSync(agents)
  const infoMap = useAgentInfo(agents)
  // Agents whose full history is showing. The sidebar lists the newest eight and
  // offered "N older chats →" as a link to the agent's landing page — which lists
  // none of them. Measured: zero session links there. So the rest were
  // unreachable from the interface, and the reader was told where their history
  // was and found an empty room. It expands here instead, where they are looking.
  const [showAllFor, setShowAllFor] = useState<Set<string>>(new Set())

  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  const [offlineExpanded, setOfflineExpanded] = useState(false)
  const [agentQuery, setAgentQuery] = useState('')
  const [agentMenu, setAgentMenu] = useState<string | null>(null)

  // Group conversations by agent
  const sessionsByAgent = useMemo(() => {
    const map: Record<string, typeof conversations> = {}
    for (const agent of agents) {
      map[agent] = conversations.filter(c => c.agentAddress === agent)
    }
    return map
  }, [agents, conversations])

  // Parse current route to get active agent and session
  const { activeAgent, activeSessionId } = useMemo(() => {
    // Routes: /[address], /[address]/[sessionId], /settings, /
    const parts = pathname.split('/').filter(Boolean)
    if (parts[0] === 'settings') {
      return { activeAgent: null, activeSessionId: null }
    }
    if (parts.length >= 1 && agents.includes(parts[0])) {
      return {
        activeAgent: parts[0],
        activeSessionId: parts[1] || null,
      }
    }
    return { activeAgent: null, activeSessionId: null }
  }, [pathname, agents])

  const onlineCount = useMemo(
    () => agents.filter(a => infoMap[a]?.online).length,
    [agents, infoMap],
  )

  const recentActivity = useMemo(() => {
    const result: Record<string, number> = {}
    for (const conversation of conversations) {
      result[conversation.agentAddress] = Math.max(
        result[conversation.agentAddress] ?? 0,
        new Date(conversation.updatedAt).getTime(),
      )
    }
    return result
  }, [conversations])

  const orderedAgents = useMemo(
    () => orderAgents(agents, infoMap, activeAgent, recentActivity),
    [agents, infoMap, activeAgent, recentActivity],
  )
  const normalizedQuery = agentQuery.trim().toLocaleLowerCase()
  const matchingAgents = orderedAgents.filter(({ address }) => {
    if (!normalizedQuery) return true
    return address.toLocaleLowerCase().includes(normalizedQuery)
      || (infoMap[address]?.name || '').toLocaleLowerCase().includes(normalizedQuery)
  })
  const offlineAgents = matchingAgents.filter(item => item.presence === 'offline' && !item.selected)
  const primaryAgents = matchingAgents.filter(item => item.presence !== 'offline' || item.selected)
  const revealOffline = offlineExpanded || normalizedQuery.length > 0 || primaryAgents.length === 0
  const visibleAgents = revealOffline ? [...primaryAgents, ...offlineAgents] : primaryAgents

  const handleDeleteSession = async (sessionId: string) => {
    const session = conversations.find(c => c.sessionId === sessionId)
    if (!session) return
    try {
      if (session.remoteRevision !== undefined) await archiveConversation(session)
      else deleteConversation(sessionId)
    } catch (error) {
      window.alert(error instanceof Error
        ? `Could not archive this chat: ${error.message}`
        : 'Could not archive this chat')
      return
    }
    // If we deleted the active session, go to agent landing
    if (activeSessionId === sessionId) {
      router.push(`/${session.agentAddress}`)
    }
  }

  const isSettingsActive = pathname === '/settings'

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* `invisible` when closed, not just translated off-screen. A drawer that is
          only moved out of view stays in the tab order and in the accessibility
          tree: on a phone, tabbing off the menu button walked through every agent
          row, every session link, and every Remove/Delete button while the page
          appeared frozen — and those destructive buttons were activatable unseen.
          visibility also removes it from the a11y tree, costs no JS, and follows
          the lg breakpoint on its own. Transitioning it lets the slide-out finish
          before it flips; focus moves in after that transition. */}
      <aside
        ref={sidebarRef}
        role={isOpen ? 'dialog' : undefined}
        aria-modal={isOpen ? true : undefined}
        aria-label="Conversations"
        className={`
        fixed lg:relative inset-y-0 left-0 z-50 w-72 bg-white flex flex-col
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:pt-0 lg:pb-0
        transform transition-[transform,visibility] duration-200 ease-out lg:translate-x-0 lg:visible
        ${isOpen ? 'translate-x-0' : '-translate-x-full invisible'}
        border-r border-neutral-200
      `}>
        {/* Brand. The version chip names the React package this build runs on:
            it is the first thing asked for when something misbehaves. */}
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link href="/" onClick={onClose} className="flex min-w-0 items-center gap-2.5">
              <Image src="/onion-green.png" alt="OpenOnion" width={28} height={28} className="shrink-0" />
              <span className="text-[15px] font-semibold tracking-tight text-neutral-900">oo-chat</span>
            </Link>
            <a
              href={`https://www.npmjs.com/package/@connectonion/react/v/${connectonionVersion}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`@connectonion/react v${connectonionVersion} — view on npm`}
              className="inline-flex min-h-6 items-center rounded-md border border-neutral-200 bg-neutral-100 px-1.5 font-mono text-[11px] text-neutral-500 hover:text-neutral-800"
            >
              v{connectonionVersion}
            </a>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close menu"
            className="-mr-2 grid h-11 w-11 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 lg:hidden"
          >
            <HiOutlineX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-between px-4 pt-3.5 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-600">
          <span>Agents · {onlineCount} online</span>
          <span className="font-mono text-neutral-400">{agents.length}</span>
        </div>

        {agents.length > 5 && (
          <div className="px-3 pb-2">
            <label htmlFor="agent-search" className="sr-only">Search agents</label>
            <input
              id="agent-search"
              type="search"
              value={agentQuery}
              onChange={event => setAgentQuery(event.target.value)}
              placeholder="Search agents"
              className="min-h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none focus:border-primary focus:ring-[3px] focus:ring-tint"
            />
          </div>
        )}

        {/* Each agent is a small card with its conversations nested under it. The
            current agent's card is drawn; the rest sit flat, so the one you are in
            is the only box in the column. */}
        <div className="no-scrollbar flex-1 overflow-y-auto px-2 pb-3">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
              <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-neutral-100 text-neutral-400">
                <HiOutlineSparkles className="h-[18px] w-[18px]" />
              </span>
              <span className="text-sm text-neutral-800">No agents yet</span>
            </div>
          ) : (
            <div className="space-y-1">
              {visibleAgents.map(({ address, presence }, index) => {
                const info = infoMap[address]
                const sessions = sessionsByAgent[address] || []
                const isActive = activeAgent === address
                const label = info?.name || shortAddress(address)

                return (
                  <div key={address}>
                    {presence === 'offline' && !isActive && (index === 0 || visibleAgents[index - 1]?.presence !== 'offline' || visibleAgents[index - 1]?.selected) && (
                      <div className="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500">Offline</div>
                    )}
                    <div
                      data-agent-address={address}
                      className={`group relative overflow-visible rounded-xl border ${
                        isActive ? 'border-neutral-200 bg-white shadow-sm' : 'border-transparent'
                      } ${presence === 'offline' && !isActive ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-center gap-1 py-1 pr-1 pl-2">
                        <Link
                          href={`/${address}`}
                          onClick={onClose}
                          aria-current={isActive && !activeSessionId ? 'page' : undefined}
                          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1.5"
                        >
                          <AgentAvatar label={label} address={address} online={presence === 'online'} />
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm font-semibold text-neutral-900 ${label === shortAddress(address) ? 'font-mono text-[13px]' : ''}`}>
                              {label}
                            </span>
                            <span className={`block text-xs ${presence === 'online' ? 'text-primary' : 'text-neutral-500'}`}>
                              {presence === 'unknown' ? 'Checking status' : presence === 'online' ? 'Online' : 'Offline'}
                            </span>
                          </span>
                        </Link>
                        <button
                          type="button"
                          aria-label={`Actions for ${label}`}
                          aria-expanded={agentMenu === address}
                          onClick={() => setAgentMenu(current => current === address ? null : address)}
                          className={`grid h-11 w-9 shrink-0 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:opacity-100 lg:group-hover:opacity-100 ${agentMenu === address ? 'lg:opacity-100' : 'lg:opacity-0'}`}
                        >
                          <HiOutlineDotsHorizontal className="h-5 w-5" />
                        </button>
                        {agentMenu === address && (
                          <div className="absolute top-12 right-2 z-20 w-36 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
                            <Link
                              href={`/${address}`}
                              onClick={() => { setAgentMenu(null); onClose() }}
                              className="flex min-h-11 items-center rounded-md px-3 text-sm text-neutral-700 hover:bg-neutral-100"
                              aria-label="New chat"
                            >
                              New chat
                            </Link>
                            <button
                              type="button"
                              onClick={() => { setAgentMenu(null); setPendingRemove(address) }}
                              className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm text-red-700 hover:bg-red-50"
                              aria-label="Remove agent"
                            >
                              Remove agent
                            </button>
                          </div>
                        )}
                      </div>

                      {sessions.length > 0 && (
                        <div className={`p-1.5 ${isActive ? 'border-t border-neutral-200' : 'pt-0'}`}>
                          <SessionList
                            sessions={showAllFor.has(address) ? sessions : sessions.slice(0, 8)}
                            agentAddress={address}
                            activeSessionId={activeSessionId}
                            variant="sidebar"
                            onDelete={handleDeleteSession}
                            onSelect={onClose}
                          />
                          {sessions.length > 8 && !showAllFor.has(address) && (
                            <button
                              onClick={() => setShowAllFor(prev => new Set(prev).add(address))}
                              className="block min-h-8 w-full px-2 text-left text-xs text-neutral-600 transition-colors hover:text-neutral-900"
                            >
                              {sessions.length - 8} older chats
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {offlineAgents.length > 0 && !normalizedQuery && (
                <button
                  type="button"
                  aria-expanded={revealOffline}
                  onClick={() => setOfflineExpanded(value => !value)}
                  className="mt-1 flex min-h-11 w-full items-center rounded-lg px-3 text-left text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                >
                  {revealOffline ? 'Hide offline' : `Show offline (${offlineAgents.length})`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer: Add Agent (dashed, as on 2 Sep), then the two places to go. */}
        <div className="grid gap-1.5 border-t border-neutral-200 p-3">
          <Link
            href="/"
            onClick={onClose}
            className="flex h-[38px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 text-sm text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
          >
            <HiOutlinePlus aria-hidden="true" className="h-3.5 w-3.5" />
            Add Agent
          </Link>
          <Link
            href="/explore"
            onClick={onClose}
            aria-current={pathname === '/explore' ? 'page' : undefined}
            className={`flex min-h-[34px] items-center gap-2.5 rounded-lg px-2 text-sm transition-colors ${pathname === '/explore' ? 'bg-tint text-neutral-900' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'}`}
          >
            <HiOutlineSearch aria-hidden="true" className="h-[15px] w-[15px]" />
            Explore agents
          </Link>
          <Link
            href="/settings"
            onClick={onClose}
            aria-current={isSettingsActive ? 'page' : undefined}
            className={`flex min-h-[34px] items-center gap-2.5 rounded-lg px-2 text-sm transition-colors ${isSettingsActive ? 'bg-tint text-neutral-900' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'}`}
          >
            <HiOutlineCog aria-hidden="true" className="h-[15px] w-[15px]" />
            Settings
          </Link>
        </div>

        <ConfirmDialog
          open={pendingRemove !== null}
          title="Remove this agent?"
          confirmLabel="Remove"
          body={pendingRemove ? (() => {
            const count = (sessionsByAgent[pendingRemove] || []).length
            return `${infoMap[pendingRemove]?.name || 'This agent'}${count > 0 ? ` and its ${count} chat${count > 1 ? 's' : ''}` : ''} will be removed. This cannot be undone.`
          })() : undefined}
          onConfirm={() => {
            if (pendingRemove) {
              removeAgent(pendingRemove)
              if (activeAgent === pendingRemove) router.push('/')
            }
            setPendingRemove(null)
          }}
          onCancel={() => setPendingRemove(null)}
        />
      </aside>
    </>
  )
}
