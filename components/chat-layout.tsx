'use client'

import { useState } from 'react'
import { HiOutlineMenu } from 'react-icons/hi'
import { Sidebar } from './sidebar'
import Link from 'next/link'

interface ChatLayoutProps {
  children: React.ReactNode
  agentUrl?: string
}

export function ChatLayout({ children }: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-white">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header with logo */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-neutral-200 bg-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Open menu"
          >
            <HiOutlineMenu className="w-5 h-5 text-neutral-600" />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
              <span className="text-white font-bold text-xs">O</span>
            </div>
            <span className="font-semibold text-neutral-900">oo-chat</span>
          </Link>
        </header>

        {children}
      </main>
    </div>
  )
}
