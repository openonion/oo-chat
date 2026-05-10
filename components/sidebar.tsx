'use client'

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
} from 'react-icons/hi'
import { useChatStore } from '@/store/chat-store'
import { useAgentInfo } from '@/hooks/use-agent-info'
import { AgentHeader } from '@/components/agent-header'
import { SessionList } from '@/components/session-list'
import { version as connectonionVersion } from 'connectonion/package.json'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { agents, conversations, deleteConversation, removeAgent, userProfile } = useChatStore()
  const infoMap = useAgentInfo(agents)

  // Track which agents are expanded (all expanded by default)
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set())

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

      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50 w-72 bg-white flex flex-col
        transform transition-transform duration-200 ease-out lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        border-r border-neutral-100
      `}>
        {/* Header with Logo */}
        <div className="px-4 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 group min-w-0">
              <img
                src="https://raw.githubusercontent.com/wu-changxing/openonion-assets/master/imgs/Onion.png"
                alt="OpenOnion"
                width={28}
                height={28}
                className="rounded-lg group-hover:scale-105 transition-transform shrink-0"
              />
              <span className="font-semibold text-[15px] text-neutral-900 tracking-tight">oo-chat</span>
            </Link>
            <a
              href={`https://www.npmjs.com/package/connectonion/v/${connectonionVersion}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`connectonion v${connectonionVersion} — view on npm`}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium text-neutral-400 bg-neutral-50 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              v{connectonionVersion}
            </a>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 -mr-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Agent Folders */}
        <div className="flex-1 overflow-y-auto px-2 pt-2 pb-3">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-neutral-50 flex items-center justify-center mb-3">
                <HiOutlineSparkles className="w-5 h-5 text-neutral-400" />
              </div>
              <p className="text-neutral-700 text-sm font-medium">No agents yet</p>
              <p className="text-neutral-400 text-xs mt-0.5">Add one below to start chatting</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {agents.map(address => {
                const info = infoMap[address]
                const sessions = sessionsByAgent[address] || []
                const expanded = isExpanded(address)
                const isActive = activeAgent === address
                const isAgentActive = isActive && !activeSessionId

                return (
                  <div key={address}>
                    {/* Agent Row */}
                    <div
                      className={`group relative flex items-center gap-1 pl-1 pr-1.5 py-1.5 rounded-lg transition-colors ${
                        isAgentActive
                          ? 'bg-neutral-100'
                          : 'hover:bg-neutral-50'
                      }`}
                    >
                      {/* Expand/Collapse */}
                      <button
                        onClick={() => toggleAgent(address)}
                        className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors shrink-0"
                        aria-label={expanded ? 'Collapse' : 'Expand'}
                      >
                        {expanded ? (
                          <HiOutlineChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <HiOutlineChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Agent Link */}
                      <Link
                        href={`/${address}`}
                        onClick={onClose}
                        className="flex-1 min-w-0"
                      >
                        <AgentHeader address={address} info={info} variant="compact" />
                      </Link>

                      {/* Action buttons (revealed on hover) */}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/${address}`}
                          onClick={onClose}
                          className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors"
                          title="New chat"
                        >
                          <HiOutlinePlus className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeAgent(address)
                            if (isActive) router.push('/')
                          }}
                          className="p-1 text-neutral-400 hover:text-red-500 rounded transition-colors"
                          title="Remove agent"
                        >
                          <HiOutlineX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Sessions (expanded) */}
                    {expanded && sessions.length > 0 && (
                      <div className="ml-5 mt-0.5 mb-1 pl-2 border-l border-neutral-100">
                        <SessionList
                          sessions={sessions}
                          agentAddress={address}
                          activeSessionId={activeSessionId}
                          variant="sidebar"
                          onDelete={handleDeleteSession}
                          onSelect={onClose}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-100 p-3 space-y-2">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 border border-dashed border-neutral-200 hover:border-neutral-300 transition-colors"
          >
            <HiOutlinePlus className="w-4 h-4" />
            Add Agent
          </Link>

          {userProfile && (
            <a
              href="https://o.openonion.ai/purchase"
              target="_blank"
              rel="noopener noreferrer"
              className="group block px-3 py-2.5 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Balance</span>
                  <span className="text-sm font-semibold text-neutral-900 tabular-nums">
                    ${userProfile.balance_usd.toFixed(2)}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-neutral-400 group-hover:text-neutral-700 transition-colors">
                  Top up →
                </span>
              </div>
              <div className="w-full h-1 bg-neutral-200/70 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-neutral-900 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (userProfile.balance_usd / Math.max(1, userProfile.credits_usd)) * 100)}%` }}
                />
              </div>
            </a>
          )}

          <Link
            href="/settings"
            onClick={onClose}
            className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
              isSettingsActive
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
            }`}
          >
            <HiOutlineCog className={`w-4 h-4 transition-transform duration-500 group-hover:rotate-45 ${isSettingsActive ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-700'}`} />
            <span>Settings</span>
          </Link>
        </div>
      </aside>
    </>
  )
}
