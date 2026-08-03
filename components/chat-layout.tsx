'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { HiOutlineMenu } from 'react-icons/hi'
import { Sidebar } from './sidebar'
import Link from 'next/link'
import { useAgentInfo, shortAddress, isAgentAddress } from '@/hooks/use-agent-info'
import { cn } from './chat/utils'

interface ChatLayoutProps {
  children: React.ReactNode
}

export function ChatLayout({ children }: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const params = useParams()
  // A malformed address is not an agent, so the header must not claim one: an
  // online dot and a name above a page that says the link is invalid contradict
  // each other, and the reader has no way to tell which half to believe.
  const raw = typeof params?.address === 'string' ? params.address : null
  const address = raw && isAgentAddress(raw) ? raw : null
  const agentInfoMap = useAgentInfo(address ? [address] : [])
  const agentInfo = address ? agentInfoMap[address] : undefined

  return (
    // overflow-hidden: without it the iOS URL-bar collapse scrolls the whole
    // h-dvh shell, which drags the header off the top of the glass.
    <div className="flex h-dvh bg-neutral-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header — one bar: menu, identity, and the pane switch.
            The switch used to be a second bar directly beneath this one, same fill
            and same hairline, which read as a seam rather than as structure. It is
            portalled into #mobile-view-switch below by WorkspaceShell, the only
            component that knows whether there is a dashboard to switch to.

            pt-[env(safe-area-inset-top)]: nothing in this app handled insets, so on
            a notched phone the row sat under the status bar. */}
        <header className="lg:hidden flex h-14 shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 pt-[env(safe-area-inset-top)]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Open menu"
          >
            <HiOutlineMenu className="w-5 h-5 text-neutral-600" />
          </button>

          {address ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                role="img"
                aria-label={agentInfo?.online ? 'Agent online' : 'Agent offline'}
                className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                agentInfo?.online ? 'bg-brand-500' : 'bg-neutral-300'
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

          {/* Portal target. `contents` so it adds no box of its own when empty. */}
          <div id="mobile-view-switch" className="contents" />
        </header>

        {children}
      </main>
    </div>
  )
}
