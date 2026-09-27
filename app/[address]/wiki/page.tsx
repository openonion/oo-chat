'use client'

/**
 * `/{agentAddress}/wiki` — the owner's private Wiki as one full page
 * (connectonion#1637). `co wiki open` opens this URL. ChatLayout renders this
 * route bare: no sidebar, header or Control Center.
 *
 * Before this route existed the path fell through to `[sessionId]` and opened a
 * chat session named "wiki" (connectonion#1828).
 */
import { useParams } from 'next/navigation'
import { useIdentity } from '@/hooks/use-identity'
import { isAgentAddress, useAgentInfo } from '@/hooks/use-agent-info'
import { InvalidAddress } from '@/components/invalid-address'
import { WikiLoading, WikiNotice, WikiReader } from '@/components/wiki/wiki-view'

export default function WikiPage() {
  const { address } = useParams<{ address: string }>()
  const valid = isAgentAddress(address)
  const { identity } = useIdentity()
  const info = useAgentInfo(valid ? [address] : [])[address]

  if (!valid) {
    return <main className="flex min-h-dvh flex-col bg-neutral-50"><InvalidAddress address={address} /></main>
  }
  // Offline is decided before any socket opens: the relay directory already knows,
  // and dialling a Host that is not there only turns into a slow timeout.
  if (info?.online === false) return <WikiNotice problem={{ kind: 'offline' }} />
  if (!info || !identity) return <WikiLoading label="Looking for the Host…" />
  return <WikiReader address={address} browserAddress={identity.address} />
}
