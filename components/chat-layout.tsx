'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { HiOutlineMenu } from 'react-icons/hi'
import { Sidebar } from './sidebar'
import Link from 'next/link'
import { useAgentInfo, shortAddress } from '@/hooks/use-agent-info'
import { cn } from './chat/utils'

interface ChatLayoutProps {
  children: React.ReactNode
}

export function ChatLayout({ children }: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const params = useParams()
  const address = typeof params?.address === 'string' ? params.address : null
  const agentInfoMap = useAgentInfo(address ? [address] : [])
  const agentInfo = address ? agentInfoMap[address] : undefined

  return (
    <div className="flex h-dvh bg-neutral-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header — agent name + status on session pages, logo elsewhere */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-neutral-200 bg-neutral-50">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Open menu"
          >
            <HiOutlineMenu className="w-5 h-5 text-neutral-600" />
          </button>

          {address ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                agentInfo?.online ? 'bg-green-500' : 'bg-neutral-300'
              )} />
              <span className="font-semibold text-neutral-900 truncate">
                {agentInfo?.name || shortAddress(address)}
              </span>
            </div>
          ) : (
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
                <span className="text-white font-bold text-xs">O</span>
              </div>
              <span className="font-semibold text-neutral-900">oo-chat</span>
            </Link>
          )}
        </header>

        {children}
      </main>
    </div>
  )
}
