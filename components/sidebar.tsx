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
} from 'react-icons/hi'
import { useChatStore } from '@/store/chat-store'
import { useAgentInfo } from '@/hooks/use-agent-info'
import { AgentHeader } from '@/components/agent-header'
import { SessionList } from '@/components/session-list'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { agents, conversations, deleteConversation, userProfile } = useChatStore()
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
        <div className="p-4 border-b border-neutral-100">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <img
                src="https://raw.githubusercontent.com/wu-changxing/openonion-assets/master/imgs/Onion.png"
                alt="OpenOnion"
                width={32}
                height={32}
                className="rounded-xl group-hover:scale-105 transition-transform"
              />
              <span className="font-bold text-neutral-900 tracking-tight">oo-chat</span>
            </Link>
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <HiOutlineX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Agent Folders */}
        <div className="flex-1 overflow-y-auto py-2">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center mb-4">
                <span className="text-2xl">🤖</span>
              </div>
              <p className="text-neutral-500 text-sm font-bold">No agents yet</p>
              <p className="text-neutral-400 text-xs mt-1">Add an agent to start chatting</p>
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {agents.map(address => {
                const info = infoMap[address]
                const sessions = sessionsByAgent[address] || []
                const expanded = isExpanded(address)
                const isActive = activeAgent === address

                return (
                  <div key={address}>
                    {/* Agent Row */}
                    <div
                      className={`group flex items-center gap-1 px-2 py-2 rounded-xl transition-colors ${
                        isActive && !activeSessionId
                          ? 'bg-neutral-100'
                          : 'hover:bg-neutral-50'
                      }`}
                    >
                      {/* Expand/Collapse */}
                      <button
                        onClick={() => toggleAgent(address)}
                        className="p-1 text-neutral-400 hover:text-neutral-600 rounded transition-colors"
                      >
                        {expanded ? (
                          <HiOutlineChevronDown className="w-4 h-4" />
                        ) : (
                          <HiOutlineChevronRight className="w-4 h-4" />
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

                      {/* New Chat Button */}
                      <Link
                        href={`/${address}`}
                        onClick={onClose}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-all"
                        title="New chat"
                      >
                        <HiOutlinePlus className="w-4 h-4" />
                      </Link>
                    </div>

                    {/* Sessions (expanded) */}
                    {expanded && sessions.length > 0 && (
                      <div className="ml-6 mt-1 mb-2">
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

        {/* Add Agent */}
        <div className="px-4 py-3 border-t border-neutral-100">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50 border border-neutral-200 border-dashed transition-all"
          >
            <HiOutlinePlus className="w-4 h-4" />
            Add Agent
          </Link>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-100 space-y-4">
          {userProfile && (
            <a
              href="https://o.openonion.ai/purchase"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-4 rounded-2xl bg-neutral-50 border border-neutral-100 group transition-all duration-300 hover:border-indigo-200 hover:bg-indigo-50/30"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Balance</span>
                <span className="text-sm font-black text-neutral-900 tracking-tight">
                  ${userProfile.balance_usd.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-1 bg-neutral-200 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-neutral-900 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, (userProfile.balance_usd / Math.max(1, userProfile.credits_usd)) * 100)}%` }}
                />
              </div>
              <div className="mt-2 text-[10px] text-indigo-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                + Add Credits
              </div>
            </a>
          )}

          <Link
            href="/settings"
            onClick={onClose}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all duration-200 group ${
              isSettingsActive
                ? 'bg-neutral-900 text-white shadow-lg shadow-neutral-200'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <HiOutlineCog className={`w-5 h-5 transition-transform group-hover:rotate-45 duration-500 ${isSettingsActive ? 'text-white' : 'text-neutral-400'}`} />
            <span>Settings</span>
          </Link>
        </div>
      </aside>
    </>
  )
}
