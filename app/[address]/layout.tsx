import { ChatLayout } from '@/components/chat-layout'

/**
 * Shared layout for one agent. Mounts ChatLayout (the Sidebar) ONCE and keeps it
 * across child navigation — /[address], /[address]/[sessionId], and new sessions.
 *
 * Before this, each page rendered its own <ChatLayout>, so switching or opening a
 * session unmounted+remounted the whole sidebar: a visible flicker plus a redundant
 * agent-info refetch, even though no new data was actually loading. As a persistent
 * layout, the sidebar (and its useAgentInfo poller) survives session navigation;
 * only the inner page content swaps.
 */
export default function AddressLayout({ children }: { children: React.ReactNode }) {
  return <ChatLayout>{children}</ChatLayout>
}
