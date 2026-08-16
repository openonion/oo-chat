'use client'

import Image from 'next/image'
import { useState, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  HiOutlineCog,
  HiOutlineX,
  HiOutlinePlus,
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineSparkles,
  HiOutlineDotsHorizontal,
} from 'react-icons/hi'
import { useChatStore } from '@/store/chat-store'
import { agentInitial, shortAddress, useAgentInfo } from '@/hooks/use-agent-info'
import { orderAgents } from '@/lib/agent-order'
import { SessionList } from '@/components/session-list'
import { ConfirmDialog } from '@/components/confirm-dialog'
// O Chat directly consumes the React integration package. The retired standalone
// ConnectOnion TypeScript SDK is intentionally not a dependency, so this is the
// package version the UI should expose.
import connectonionPackage from '@connectonion/react/package.json'

const connectonionVersion = connectonionPackage.version

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { agents, conversations, deleteConversation, removeAgent } = useChatStore()
  const infoMap = useAgentInfo(agents)
  // Agents whose full history is showing. The sidebar lists the newest eight and
  // offered "N older chats →" as a link to the agent's landing page — which lists
  // none of them. Measured: zero session links there. So the rest were
  // unreachable from the interface, and the reader was told where their history
  // was and found an empty room. It expands here instead, where they are looking.
  const [showAllFor, setShowAllFor] = useState<Set<string>>(new Set())

  // Track which agents are expanded (all expanded by default)
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set())
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  const [offlineExpanded, setOfflineExpanded] = useState(false)
  const [agentQuery, setAgentQuery] = useState('')
  const [agentMenu, setAgentMenu] = useState<string | null>(null)

  // Auto-expand new agents
  const isExpanded = (address: string) => !expandedAgents.has(address) // inverted: Set tracks collapsed agents

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
    [agents, infoMap]
  )

  const recentActivity = useMemo(() => {
    const result: Record<string, number> = {}
    for (const conversation of conversations) {
      result[conversation.agentAddress] = Math.max(
        result[conversation.agentAddress] ?? 0,
        new Date(conversation.createdAt).getTime(),
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

  const toggleAgent = (address: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev)
      // Set tracks collapsed agents, so toggle means add/remove from collapsed set
      if (next.has(address)) {
        next.delete(address) // expand (remove from collapsed)
      } else {
        next.add(address) // collapse (add to collapsed)
      }
      return next
    })
  }

  const handleDeleteSession = (sessionId: string) => {
    const session = conversations.find(c => c.sessionId === sessionId)
    deleteConversation(sessionId)
    // If we deleted the active session, go to agent landing
    if (activeSessionId === sessionId && session) {
      router.push(`/${session.agentAddress}`)
    }
  }

  const isSettingsActive = pathname === '/settings'

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-neutral-900/20 backdrop-blur-sm z-40 lg:hidden"
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
          before it flips (visibility is discrete: it waits the full duration going
          to hidden, and applies immediately coming back). */}
      <aside
        aria-label="Conversations"
        className={`
        fixed lg:relative inset-y-0 left-0 z-50 w-72 bg-white flex flex-col
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:pt-0 lg:pb-0
        transform transition-[transform,visibility] duration-200 ease-out lg:translate-x-0 lg:visible
        ${isOpen ? 'translate-x-0' : '-translate-x-full invisible'}
        border-r border-neutral-200
      `}>
        {/* Header with Logo */}
        <div className="px-4 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 group min-w-0">
              <Image
                src="/onion.png"
                alt="OpenOnion"
                width={28}
                height={28}
                className="rounded-lg group-hover:scale-105 transition-transform shrink-0"
              />
              <span className="font-semibold text-[15px] text-neutral-900 tracking-tight">oo-chat</span>
            </Link>
            <a
              href={`https://www.npmjs.com/package/@connectonion/react/v/${connectonionVersion}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`@connectonion/react v${connectonionVersion} — view on npm`}
              className="inline-flex min-h-6 items-center px-1.5 rounded-md text-[11px] font-mono font-medium text-neutral-400 bg-neutral-100 hover:text-neutral-700 hover:bg-neutral-200 transition-colors"
            >
              v{connectonionVersion}
            </a>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden p-1.5 -mr-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Agents section label */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
            Agents <span className="font-normal text-neutral-400">· {onlineCount} online</span>
          </span>
          <span className="text-[11px] font-mono text-neutral-500">{agents.length}</span>
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
              className="min-h-11 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
            />
          </div>
        )}

        {/* Agent Folders */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-3">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-center mb-3">
                <HiOutlineSparkles className="w-5 h-5 text-neutral-400" />
              </div>
              <p className="text-neutral-700 text-sm font-medium">No agents yet</p>
              <p className="text-neutral-400 text-xs mt-0.5">Add one below to start chatting</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleAgents.map(({ address, presence }, index) => {
                const info = infoMap[address]
                const sessions = sessionsByAgent[address] || []
                const expanded = isExpanded(address)
                const isActive = activeAgent === address

                return (
                  <div
                    key={address}
                    data-agent-address={address}
                    className={`relative overflow-visible rounded-xl border bg-white transition-shadow ${
                      isActive ? 'border-neutral-300 shadow-sm' : 'border-neutral-100 hover:border-neutral-200'
                    } ${presence === 'offline' && !isActive ? 'opacity-70' : ''}`}
                  >
                    {presence === 'offline' && !isActive && (index === 0 || visibleAgents[index - 1]?.presence !== 'offline' || visibleAgents[index - 1]?.selected) && (
                      <div className="px-2 py-1 text-[11px] font-mono uppercase tracking-[0.12em] text-neutral-400">Offline</div>
                    )}
                    <div className="flex min-h-14 items-center gap-2 px-2">
                      <Link
                        href={`/${address}`}
                        onClick={onClose}
                        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-2 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white">
                          {agentInitial(info?.name || shortAddress(address), address)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-neutral-800">
                            {info?.name || shortAddress(address)}
                          </span>
                          <span className={`block text-[11px] font-medium capitalize ${
                            presence === 'online' ? 'text-emerald-600' : 'text-neutral-400'
                          }`}>
                            {presence === 'unknown' ? 'Checking status' : presence}
                          </span>
                        </span>
                      </Link>
                      <button
                        type="button"
                        aria-label={`Actions for ${info?.name || shortAddress(address)}`}
                        aria-expanded={agentMenu === address}
                        onClick={() => setAgentMenu(current => current === address ? null : address)}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                      >
                        <HiOutlineDotsHorizontal className="h-5 w-5" />
                      </button>
                      {agentMenu === address && (
                        <div className="absolute right-2 top-12 z-20 w-36 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg">
                          <Link
                            href={`/${address}`}
                            onClick={() => { setAgentMenu(null); onClose() }}
                            className="flex min-h-11 items-center rounded-lg px-3 text-sm text-neutral-700 hover:bg-neutral-100"
                            aria-label="New chat"
                          >
                            New chat
                          </Link>
                          <button
                            type="button"
                            onClick={() => { setAgentMenu(null); setPendingRemove(address) }}
                            className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-red-600 hover:bg-red-50"
                            aria-label="Remove agent"
                          >
                            Remove agent
                          </button>
                        </div>
                      )}
                    </div>

                    {sessions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleAgent(address)}
                        aria-expanded={expanded}
                        className="flex min-h-9 w-full items-center justify-between border-t border-neutral-100 px-3 text-xs font-medium text-neutral-500 hover:bg-neutral-50"
                      >
                        <span>{sessions.length} conversation{sessions.length === 1 ? '' : 's'}</span>
                        {expanded ? <HiOutlineChevronDown className="h-3.5 w-3.5" /> : <HiOutlineChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    {expanded && sessions.length > 0 && (
                      <div className="border-t border-neutral-100 bg-neutral-50/70 px-1.5 py-1.5">
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
                            className="block w-full px-3 py-1.5 text-left text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
                          >
                            {sessions.length - 8} older chats
                          </button>
                        )}
                      </div>
                    )}
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

        {/* Footer */}
        <div className="border-t border-neutral-200 p-3 space-y-2">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 border border-dashed border-neutral-300 hover:border-neutral-400 transition-colors"
          >
            <HiOutlinePlus className="w-4 h-4" />
            Add Agent
          </Link>

          <Link
            href="/settings"
            onClick={onClose}
            className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
              isSettingsActive
                ? 'bg-neutral-100 text-neutral-900'
                : 'text-neutral-600 hover:bg-neutral-100/70 hover:text-neutral-900'
            }`}
          >
            <HiOutlineCog className={`w-4 h-4 transition-transform duration-500 group-hover:rotate-45 ${isSettingsActive ? 'text-neutral-900' : 'text-neutral-400 group-hover:text-neutral-700'}`} />
            <span>Settings</span>
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
