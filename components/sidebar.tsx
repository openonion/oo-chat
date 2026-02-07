'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  HiOutlineChat,
  HiOutlineCog,
  HiOutlineTrash,
  HiOutlineX,
  HiOutlinePlus
} from 'react-icons/hi'
import { useChatStore } from '@/store/chat-store'
import Link from 'next/link'
import { useMemo } from 'react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

function groupByTime(conversations: Array<{ sessionId: string; title: string; createdAt: Date }>) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const groups: { label: string; items: typeof conversations }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This Week', items: [] },
    { label: 'Older', items: [] },
  ]

  for (const conv of conversations) {
    const date = new Date(conv.createdAt)
    if (date >= today) {
      groups[0].items.push(conv)
    } else if (date >= yesterday) {
      groups[1].items.push(conv)
    } else if (date >= weekAgo) {
      groups[2].items.push(conv)
    } else {
      groups[3].items.push(conv)
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

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { conversations, deleteConversation, clearActive, userProfile } = useChatStore()

  const groupedConversations = useMemo(() => groupByTime(conversations), [conversations])

  const handleDeleteConversation = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const conv = conversations.find(c => c.sessionId === sessionId)
    if (!window.confirm(`Delete "${conv?.title || 'this conversation'}"?`)) return
    deleteConversation(sessionId)

    if (pathname === `/chat/${sessionId}`) {
      router.push('/')
    }
  }

  const isSettingsActive = pathname === '/settings'
  const isHomeActive = pathname === '/'
  const activeSessionId = pathname.startsWith('/chat/') ? pathname.split('/')[2] : null

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
              <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <span className="text-white font-bold text-sm">O</span>
              </div>
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

        {/* New Chat Button */}
        <div className="p-4">
          <button
            onClick={() => {
              onClose()
              clearActive()
              router.push('/')
            }}
            className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 ${
              isHomeActive
                ? 'bg-neutral-900 text-white shadow-lg shadow-neutral-200'
                : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100 border border-neutral-200 shadow-sm'
            }`}
          >
            <HiOutlinePlus className="w-5 h-5" />
            New Chat
          </button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center mb-4">
                <HiOutlineChat className="w-7 h-7 text-neutral-300" />
              </div>
              <p className="text-neutral-500 text-sm font-bold">No chats yet</p>
              <p className="text-neutral-400 text-[11px] font-medium mt-1 leading-relaxed">Your message history will appear here once you begin.</p>
            </div>
          ) : (
            groupedConversations.map((group: { label: string; items: any[] }) => (
              <div key={group.label} className="space-y-1">
                <div className="px-3 py-1 mb-1">
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                    {group.label}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {group.items.map((conv: { sessionId: string; title: string; createdAt: Date }) => {
                    const isActive = conv.sessionId === activeSessionId
                    return (
                      <Link
                        key={conv.sessionId}
                        href={`/chat/${conv.sessionId}`}
                        onClick={onClose}
                        className={`group relative flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer transition-all duration-200 ${
                          isActive
                            ? 'bg-neutral-100 shadow-none ring-0'
                            : 'text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-neutral-900 rounded-r-full" />
                        )}
                        <HiOutlineChat className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-neutral-900' : 'text-neutral-400 group-hover:text-neutral-600'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate text-sm ${isActive ? 'font-bold text-neutral-900' : 'font-medium'}`}>
                              {conv.title}
                            </span>
                            <span className="text-[9px] font-bold text-neutral-400 tabular-nums whitespace-nowrap">
                              {formatTime(new Date(conv.createdAt))}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteConversation(conv.sessionId, e)}
                          aria-label={`Delete ${conv.title}`}
                          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-900 rounded-xl transition-all duration-200"
                        >
                          <HiOutlineTrash className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-100 space-y-4">
          {userProfile && (
            <div className="px-4 py-4 rounded-2xl bg-neutral-50 border border-neutral-100 group transition-all duration-300">
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
            </div>
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
