/**
 * @purpose Desktop agent navigation: a 56px rail of round agent avatars, with
 *   Add Agent under them and Explore / Settings at the bottom. Hovering or
 *   focusing an avatar shows a card with the agent's name, status and recent chats.
 * @llm-note Two shapes. Docked: the rail sits in the layout beside the content.
 *   Collapsed (a full-screen Control Center asked for it via useCollapseRail):
 *   only the current agent's avatar shows, top-left; hover or focus slides the
 *   whole rail out over the content — an overlay, so nothing underneath moves —
 *   and leaving or Escape puts it away.
 *
 *   The card is position:fixed so the scrolling avatar list cannot clip it. That
 *   only holds while no ancestor sets transform, filter or backdrop-filter (each
 *   makes a new containing block for fixed children), which is why the collapsed
 *   rail slides by animating `left`, not `translate`.
 *
 *   Phones never see this: they keep the Sidebar drawer behind the menu button.
 */
'use client'

import Link from 'next/link'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { HiOutlineCog, HiOutlinePlus, HiOutlineSearch, HiOutlineTrash } from 'react-icons/hi'
import type { AgentInfo } from '@connectonion/react'
import { useChatStore, type Conversation } from '@/store/chat-store'
import { agentInitial, shortAddress, useAgentInfo } from '@/hooks/use-agent-info'
import { orderAgents, type AgentPresence } from '@/lib/agent-order'
import { cleanTitle, formatTime } from '@/components/session-list'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { cn } from '@/components/chat/utils'

const RailCollapse = createContext<(collapsed: boolean) => void>(() => {})
export const RailCollapseProvider = RailCollapse.Provider

/** Ask the layout to fold the rail to one circle while `collapsed` is true. */
export function useCollapseRail(collapsed: boolean) {
  const setCollapsed = useContext(RailCollapse)
  useEffect(() => {
    setCollapsed(collapsed)
    return () => setCollapsed(false)
  }, [collapsed, setCollapsed])
}

const STATUS: Record<AgentPresence, string> = { online: 'Online', offline: 'Offline', unknown: 'Checking status' }

interface AgentRailProps {
  collapsed: boolean
  onDeleteChat: (session: Conversation) => void
}

export function AgentRail({ collapsed, onDeleteChat }: AgentRailProps) {
  const [open, setOpen] = useState(false)
  const circleRef = useRef<HTMLButtonElement>(null)
  // Escape hands focus back to the circle, and that focus must not reopen the rail.
  const skipFocus = useRef(false)
  const items = useRailAgents()
  const current = items.find(item => item.active)

  if (!collapsed) return <RailPanel items={items} onDeleteChat={onDeleteChat} className="relative" />

  const close = () => {
    setOpen(false)
    if (document.activeElement === circleRef.current) return
    skipFocus.current = true
    circleRef.current?.focus({ preventScroll: true })
  }
  const openOnFocus = () => {
    if (skipFocus.current) { skipFocus.current = false; return }
    setOpen(true)
  }

  return (
    <div
      className="hidden lg:block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={openOnFocus}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
      onKeyDown={event => { if (event.key === 'Escape') close() }}
    >
      <button
        ref={circleRef}
        type="button"
        aria-label="Show agents"
        aria-expanded={open}
        className="fixed top-2.5 left-2.5 z-30 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      >
        {current
          ? <RailAvatar label={current.label} address={current.address} presence={current.presence} active={false} />
          : <span className="block h-9 w-9 rounded-full bg-neutral-200" />}
      </button>
      <RailPanel
        items={items}
        onDeleteChat={onDeleteChat}
        className={cn(
          'fixed inset-y-0 z-40 shadow-2xl transition-[left,visibility] duration-200 ease-out motion-reduce:transition-none',
          open ? 'left-0 visible' : '-left-16 invisible',
        )}
      />
    </div>
  )
}

interface RailItem {
  address: string
  label: string
  presence: AgentPresence
  active: boolean
  info?: AgentInfo
  sessions: Conversation[]
}

/** Every saved agent, current one first, each with its newest chats. */
function useRailAgents(): RailItem[] {
  const pathname = usePathname()
  const { agents, conversations } = useChatStore()
  const infoMap = useAgentInfo(agents)
  const activeAgent = agents.find(agent => pathname.split('/')[1] === agent) ?? null

  return useMemo(() => {
    const newest: Record<string, number> = {}
    for (const conversation of conversations) {
      newest[conversation.agentAddress] = Math.max(newest[conversation.agentAddress] ?? 0, new Date(conversation.updatedAt).getTime())
    }
    return orderAgents(agents, infoMap, activeAgent, newest).map(({ address, presence, selected }) => ({
      address,
      presence,
      active: selected,
      info: infoMap[address],
      label: infoMap[address]?.name || shortAddress(address),
      sessions: conversations
        .filter(conversation => conversation.agentAddress === address)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    }))
  }, [agents, conversations, infoMap, activeAgent])
}

function RailPanel({ items, onDeleteChat, className }: { items: RailItem[]; onDeleteChat: (session: Conversation) => void; className?: string }) {
  const pathname = usePathname()
  const [peek, setPeek] = useState<{ address: string; top: number } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null)

  const show = (address: string, row: HTMLElement) => {
    // Level with the avatar, but never hanging off the bottom of the window.
    const top = Math.max(8, Math.min(row.getBoundingClientRect().top - 6, window.innerHeight - 400))
    setPeek({ address, top })
  }

  return (
    <nav
      aria-label="Agents"
      className={cn('hidden h-full w-14 shrink-0 flex-col items-center border-r border-neutral-200 bg-white lg:flex', className)}
    >
      <ul className="no-scrollbar flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto pt-2.5 pb-2">
        {items.map(item => (
          <RailAgent
            key={item.address}
            item={item}
            peeking={peek?.address === item.address}
            top={peek?.top ?? 0}
            onPeek={show}
            onLeave={() => setPeek(null)}
            onDeleteChat={setPendingDelete}
          />
        ))}
        <li>
          <Link
            href="/"
            aria-label="Add Agent"
            title="Add Agent"
            className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-neutral-300 text-neutral-500 transition-colors hover:border-neutral-500 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            <HiOutlinePlus aria-hidden className="h-4 w-4" />
          </Link>
        </li>
      </ul>

      <div className="flex flex-col items-center gap-1 border-t border-neutral-100 py-2.5">
        <RailLink href="/explore" label="Explore agents" current={pathname === '/explore'} icon={<HiOutlineSearch aria-hidden className="h-[18px] w-[18px]" />} />
        <RailLink href="/settings" label="Settings" current={pathname === '/settings'} icon={<HiOutlineCog aria-hidden className="h-[18px] w-[18px]" />} />
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.remoteRevision !== undefined ? 'Archive this chat?' : 'Delete this chat?'}
        body={pendingDelete
          ? pendingDelete.remoteRevision !== undefined
            ? `"${cleanTitle(pendingDelete.title)}" will be hidden from Recent Chat on your devices.`
            : `"${cleanTitle(pendingDelete.title)}" will be removed. This cannot be undone.`
          : undefined}
        confirmLabel={pendingDelete?.remoteRevision !== undefined ? 'Archive' : 'Delete'}
        onConfirm={() => { if (pendingDelete) onDeleteChat(pendingDelete); setPendingDelete(null) }}
        onCancel={() => setPendingDelete(null)}
      />
    </nav>
  )
}

function RailLink({ href, label, current, icon }: { href: string; label: string; current: boolean; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'grid h-10 w-10 place-items-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-neutral-900',
        current ? 'bg-tint text-tint-fg' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900',
      )}
    >
      {icon}
    </Link>
  )
}

interface RailAgentProps {
  item: RailItem
  peeking: boolean
  top: number
  onPeek: (address: string, row: HTMLElement) => void
  onLeave: () => void
  onDeleteChat: (session: Conversation) => void
}

function RailAgent({ item, peeking, top, onPeek, onLeave, onDeleteChat }: RailAgentProps) {
  return (
    <li
      data-agent-address={item.address}
      className="flex w-full justify-center"
      onMouseEnter={event => onPeek(item.address, event.currentTarget)}
      onMouseLeave={onLeave}
      onFocus={event => onPeek(item.address, event.currentTarget)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) onLeave() }}
    >
      <Link
        href={`/${item.address}`}
        aria-label={`${item.label}, ${STATUS[item.presence].toLowerCase()}`}
        aria-current={item.active ? 'page' : undefined}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900"
      >
        <RailAvatar label={item.label} address={item.address} presence={item.presence} active={item.active} />
      </Link>
      {peeking && <AgentCard item={item} top={top} onDeleteChat={onDeleteChat} />}
    </li>
  )
}

/** A round avatar: the agent's initial, a green dot when it is online, a ring when it is the one open. */
function RailAvatar({ label, address, presence, active }: { label: string; address: string; presence: AgentPresence; active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-full bg-tint text-sm font-semibold text-tint-fg transition-shadow',
        active && 'ring-2 ring-primary ring-offset-2 ring-offset-white',
        presence === 'offline' && !active && 'opacity-60',
      )}
    >
      {agentInitial(label, address)}
      {presence === 'online' && (
        <span className="absolute -right-px -bottom-px h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" />
      )}
    </span>
  )
}

function AgentCard({ item, top, onDeleteChat }: { item: RailItem; top: number; onDeleteChat: (session: Conversation) => void }) {
  return (
    // pl-2 is a bridge, not decoration: the pointer crosses it on the way from
    // the avatar to the card, and a gap there would close the card under it.
    <div data-agent-card className="fixed left-14 z-50 pl-2" style={{ top }}>
      <div className="w-80 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-2xl">
        <Link href={`/${item.address}`} className="block rounded-xl px-3 pt-2.5 pb-2 hover:bg-neutral-50">
          <span className={cn('block truncate text-body font-semibold text-neutral-900', item.label === shortAddress(item.address) && 'font-mono text-ui')}>
            {item.label}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
            <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', item.presence === 'online' ? 'bg-brand-500' : 'bg-neutral-300')} />
            {STATUS[item.presence]}
            <span aria-hidden className="text-neutral-300">·</span>
            <span className="font-mono text-meta text-neutral-400">{shortAddress(item.address)}</span>
          </span>
        </Link>

        <div className="mt-1 border-t border-neutral-100 pt-1.5">
          <p className="px-3 pt-1 pb-1 text-meta font-medium uppercase tracking-[0.08em] text-neutral-400">Recent</p>
          {item.sessions.length === 0
            ? <p className="px-3 pb-2.5 text-ui text-neutral-500">No conversations yet</p>
            : (
              <ul className="no-scrollbar max-h-[296px] overflow-y-auto">
                {item.sessions.map(session => <CardChat key={session.sessionId} session={session} onDelete={onDeleteChat} />)}
              </ul>
            )}
        </div>
      </div>
    </div>
  )
}

function CardChat({ session, onDelete }: { session: Conversation; onDelete: (session: Conversation) => void }) {
  const pathname = usePathname()
  const href = `/${session.agentAddress}/${session.sessionId}`
  const title = cleanTitle(session.title)
  const archive = session.remoteRevision !== undefined
  return (
    <li className={cn('group flex min-h-9 items-center rounded-lg text-ui', pathname === href ? 'bg-tint text-neutral-900' : 'text-neutral-700 hover:bg-neutral-50')}>
      <Link href={href} aria-current={pathname === href ? 'page' : undefined} className="flex min-w-0 flex-1 items-baseline gap-3 py-2 pl-3 pr-1">
        <span className="min-w-0 flex-1 truncate" title={title}>{title}</span>
        <span className="shrink-0 text-meta text-neutral-400">{formatTime(new Date(session.updatedAt))}</span>
      </Link>
      <button
        type="button"
        onClick={() => onDelete(session)}
        aria-label={archive ? 'Archive chat' : 'Delete chat'}
        className="mr-1 shrink-0 rounded-md p-1.5 text-neutral-400 opacity-0 transition-opacity hover:text-danger-600 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <HiOutlineTrash aria-hidden className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}
