'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { HiOutlineChat, HiOutlineTrash } from 'react-icons/hi'
import type { Conversation } from '@/store/chat-store'

interface SessionListProps {
  sessions: Conversation[]
  agentAddress: string
  activeSessionId?: string | null
  variant?: 'sidebar' | 'page'
  onDelete?: (sessionId: string) => void
  onSelect?: () => void
}

function groupByTime(sessions: Conversation[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This Week', items: [] },
    { label: 'Older', items: [] },
  ]

  for (const session of sessions) {
    const date = new Date(session.createdAt)
    if (date >= today) {
      groups[0].items.push(session)
    } else if (date >= yesterday) {
      groups[1].items.push(session)
    } else if (date >= weekAgo) {
      groups[2].items.push(session)
    } else {
      groups[3].items.push(session)
    }
  }

  return groups.filter(g => g.items.length > 0)
}

function formatTime(date: Date) {
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24 && date.toDateString() === now.toDateString()) {
    return `${diffInHours}h ago`
  }

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }

  const isThisWeek = now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000
  if (isThisWeek) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function SessionList({
  sessions,
  agentAddress,
  activeSessionId,
  variant = 'sidebar',
  onDelete,
  onSelect,
}: SessionListProps) {
  const groupedSessions = useMemo(() => groupByTime(sessions), [sessions])

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center mb-3">
          <HiOutlineChat className="w-6 h-6 text-neutral-300" />
        </div>
        <p className="text-neutral-500 text-sm font-medium">No chats yet</p>
      </div>
    )
  }

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onDelete) {
      const session = sessions.find(s => s.sessionId === sessionId)
      if (window.confirm(`Delete "${session?.title || 'this chat'}"?`)) {
        onDelete(sessionId)
      }
    }
  }

  if (variant === 'sidebar') {
    return (
      <div className="space-y-1">
        {sessions.map(session => {
          const isActive = session.sessionId === activeSessionId
          return (
            <Link
              key={session.sessionId}
              href={`/${agentAddress}/${session.sessionId}`}
              onClick={onSelect}
              className={`group relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                isActive
                  ? 'bg-neutral-100 text-neutral-900 font-medium'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <HiOutlineChat className={`w-3.5 h-3.5 shrink-0 ${
                isActive ? 'text-neutral-700' : 'text-neutral-400'
              }`} />
              <span className="truncate flex-1">{session.title}</span>
              {onDelete && (
                <button
                  onClick={(e) => handleDelete(session.sessionId, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-neutral-600 rounded transition-opacity"
                >
                  <HiOutlineTrash className="w-3 h-3" />
                </button>
              )}
            </Link>
          )
        })}
      </div>
    )
  }

  // Page variant - grouped by time with more details
  return (
    <div className="space-y-6">
      {groupedSessions.map(group => (
        <div key={group.label}>
          <div className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 px-1">
            {group.label}
          </div>
          <div className="space-y-1">
            {group.items.map(session => (
              <Link
                key={session.sessionId}
                href={`/${agentAddress}/${session.sessionId}`}
                onClick={onSelect}
                className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-neutral-50 transition-colors group"
              >
                <span className="font-medium text-neutral-900 group-hover:text-neutral-700 truncate">
                  {session.title}
                </span>
                <span className="text-xs text-neutral-400 shrink-0 ml-3">
                  {formatTime(new Date(session.createdAt))}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
