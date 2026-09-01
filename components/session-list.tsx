'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { HiOutlineChat, HiOutlineTrash } from 'react-icons/hi'
import { ConfirmDialog } from '@/components/confirm-dialog'
import type { Conversation } from '@/store/chat-store'

// Legacy titles were stored with raw markdown ('# LinkedIn ...') — clean at render
function cleanTitle(title: string): string {
  return title.replace(/[#*`>_~\n]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled chat'
}

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
    const date = new Date(session.updatedAt)
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
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

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
    if (onDelete) setPendingDelete(sessionId)
  }

  const pendingSession = sessions.find(s => s.sessionId === pendingDelete)
  const confirmDialog = (
    <ConfirmDialog
      open={pendingDelete !== null}
      title={pendingSession?.remoteRevision !== undefined ? 'Archive this chat?' : 'Delete this chat?'}
      body={pendingSession
        ? pendingSession.remoteRevision !== undefined
          ? `"${cleanTitle(pendingSession.title)}" will be hidden from Recent Chat on your devices.`
          : `"${cleanTitle(pendingSession.title)}" will be removed. This cannot be undone.`
        : undefined}
      onConfirm={() => { if (pendingDelete) onDelete?.(pendingDelete); setPendingDelete(null) }}
      onCancel={() => setPendingDelete(null)}
    />
  )

  if (variant === 'sidebar') {
    return (
      <div className="space-y-1">
        {sessions.map(session => {
          const isActive = session.sessionId === activeSessionId
          return (
            // Siblings, not a button inside the anchor. Interactive content inside
            // an <a> is invalid HTML and assistive technology resolves the pair
            // ambiguously — the link ends up announcing the button's label as part
            // of its own name. With a destructive control inside a navigation link
            // it is the worst version of that: the two things a thumb can land on
            // are "open this chat" and "delete it forever".
            <div
              key={session.sessionId}
              className={`group relative flex items-center rounded-lg text-sm transition-all ${
                isActive
                  ? 'bg-neutral-100 text-neutral-900 font-medium'
                  : 'text-neutral-600 hover:bg-neutral-100/70'
              }`}
            >
              <Link
                href={`/${agentAddress}/${session.sessionId}`}
                onClick={onSelect}
                className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 pr-1"
              >
                <HiOutlineChat className={`w-3.5 h-3.5 shrink-0 ${
                  isActive ? 'text-neutral-700' : 'text-neutral-400'
                }`} />
                <span className="truncate">{cleanTitle(session.title)}</span>
              </Link>
              {onDelete && (
                <button
                  onClick={(e) => handleDelete(session.sessionId, e)}
                  aria-label={session.remoteRevision !== undefined ? 'Archive chat' : 'Delete chat'}
                  className="mr-1.5 shrink-0 rounded p-1.5 text-neutral-400 opacity-100 transition-opacity hover:text-red-500 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                >
                  <HiOutlineTrash className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )
        })}
        {confirmDialog}
      </div>
    )
  }

  // Page variant - grouped by time with more details
  return (
    <div className="space-y-6">
      {groupedSessions.map(group => (
        <div key={group.label}>
          <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-2 px-1">
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
                  {cleanTitle(session.title)}
                </span>
                <span className="text-xs text-neutral-400 shrink-0 ml-3">
                  {formatTime(new Date(session.updatedAt))}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
      {confirmDialog}
    </div>
  )
}
