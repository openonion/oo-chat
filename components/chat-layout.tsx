'use client'

import { useRef, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { HiOutlineMenu } from 'react-icons/hi'
import Image from 'next/image'
import { Sidebar } from './sidebar'
import Link from 'next/link'
import { useAgentInfo, shortAddress, isAgentAddress } from '@/hooks/use-agent-info'
import { cn } from './chat/utils'
import { TopUp } from './agent-address'
import { QrShare } from './qr-share'
import { AgentRail, RailCollapseProvider } from './agent-rail'
import { useChatStore, type Conversation } from '@/store/chat-store'
import { useRecentChatSync } from '@/hooks/use-recent-chat-sync'

/** Delete a local chat, or archive one the Host keeps, from either agent list. */
function useDeleteChat() {
  const router = useRouter()
  const pathname = usePathname()
  const { agents, deleteConversation } = useChatStore()
  const { archiveConversation } = useRecentChatSync(agents)
  return async (session: Conversation) => {
    try {
      if (session.remoteRevision !== undefined) await archiveConversation(session)
      else deleteConversation(session.sessionId)
    } catch (error) {
      window.alert(error instanceof Error
        ? `Could not archive this chat: ${error.message}`
        : 'Could not archive this chat')
      return
    }
    // Deleting the chat on screen leaves nothing to show; go to its agent.
    const href = `/${session.agentAddress}/${session.sessionId}`
    if (pathname === href) router.push(`/${session.agentAddress}`)
  }
}

interface ChatLayoutProps {
  children: React.ReactNode
}

export function ChatLayout({ children }: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // A full-screen Control Center folds the desktop rail to one circle.
  const [railCollapsed, setRailCollapsed] = useState(false)
  const deleteChat = useDeleteChat()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const params = useParams()
  const pathname = usePathname()
  // A malformed address is not an agent, so the header must not claim one: an
  // online dot and a name above a page that says the link is invalid contradict
  // each other, and the reader has no way to tell which half to believe.
  const raw = typeof params?.address === 'string' ? params.address : null
  const address = raw && isAgentAddress(raw) ? raw : null
  const agentInfoMap = useAgentInfo(address ? [address] : [])
  const agentInfo = address ? agentInfoMap[address] : undefined

  if (pathname === `/${raw}/rem`) return <>{children}</>
  // The agent's own page carries its bar at every width: name on the left,
  // balance, share and the view switch on the right. So does a full-screen
  // Control Center, which has no chat header to hold the switch. Elsewhere the bar
  // is the phone's only way into the drawer, and the desktop has the rail and
  // the chat header.
  const agentPage = address !== null && pathname === `/${address}`
  const desktopHeader = agentPage || railCollapsed

  return (
    // overflow-hidden: without it the iOS URL-bar collapse scrolls the whole
    // h-dvh shell, which drags the header off the top of the glass.
    <RailCollapseProvider value={setRailCollapsed}>
    <div className="flex h-dvh bg-neutral-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} returnFocusRef={menuButtonRef} onDeleteChat={deleteChat} />
      <AgentRail collapsed={railCollapsed} onDeleteChat={deleteChat} />

      <main inert={sidebarOpen} className="flex-1 flex flex-col min-w-0">
        {/* Mobile header — one bar: menu, identity, and the pane switch.
            The switch used to be a second bar directly beneath this one, same fill
            and same hairline, which read as a seam rather than as structure. It is
            portalled into #workspace-view-switch below by WorkspaceShell, the only
            component that knows whether there is a Control Center to switch to.

            pt-[env(safe-area-inset-top)]: nothing in this app handled insets, so on
            a notched phone the row sat under the status bar. */}
        <header className={cn(
          'flex h-14 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-3 pt-[env(safe-area-inset-top)] lg:px-4',
          !desktopHeader && 'lg:hidden',
          // Room for the rail's one circle, which floats over this corner.
          railCollapsed && 'lg:pl-16',
        )}>
          <button
            ref={menuButtonRef}
            onClick={() => setSidebarOpen(true)}
            className="-ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-neutral-100 lg:hidden"
            aria-label="Open menu"
          >
            <HiOutlineMenu className="w-5 h-5 text-neutral-600" />
          </button>

          {address ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                role="img"
                aria-label={agentInfo?.online === undefined ? 'Checking agent status' : agentInfo.online ? 'Agent online' : 'Agent offline'}
                className={cn(
                // Desktop shows presence on the rail avatar instead.
                'h-2 w-2 shrink-0 rounded-full lg:hidden',
                agentInfo?.online ? 'bg-brand-500' : 'bg-neutral-300'
              )} />
              <span className="font-semibold text-neutral-900 truncate">
                {agentInfo?.name || shortAddress(address)}
              </span>
              {agentPage && (
                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                  {agentInfo?.online === true && typeof agentInfo.balance_usd === 'number' && (
                    <TopUp address={address} balanceUsd={agentInfo.balance_usd} variant="chip" />
                  )}
                  <QrShare address={address} variant="icon" />
                </span>
              )}
            </div>
          ) : (
            <Link href="/" className="flex items-center gap-2">
              <Image src="/onion.png" alt="" width={28} height={28} />
              <span className="font-semibold text-neutral-900">oo-chat</span>
            </Link>
          )}

          {/* Portal target. `contents` so it adds no box of its own when empty. */}
          <div id="workspace-view-switch" className="contents" />
        </header>

        {children}
      </main>
    </div>
    </RailCollapseProvider>
  )
}
