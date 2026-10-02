'use client'

/**
 * `/{agentAddress}/rem` — the owner's private co rem as one full page
 * (connectonion#1637). `co rem open --live` opens this URL. ChatLayout renders this
 * route bare: no sidebar, header or Control Center.
 *
 * Before the original /wiki route existed the path fell through to `[sessionId]`
 * and opened a chat session named "wiki" (connectonion#1828).
 */
import { useParams } from 'next/navigation'
import { useIdentity } from '@/hooks/use-identity'
import { isAgentAddress, useAgentInfo } from '@/hooks/use-agent-info'
import { InvalidAddress } from '@/components/invalid-address'
import { RemLoading, RemNotice, RemReader } from '@/components/rem/rem-view'

export default function RemPage() {
  const { address } = useParams<{ address: string }>()
  const valid = isAgentAddress(address)
  const { identity } = useIdentity()
  const info = useAgentInfo(valid ? [address] : [])[address]

  if (!valid) {
    return <main className="flex min-h-dvh flex-col bg-neutral-50"><InvalidAddress address={address} /></main>
  }
  // Offline is decided before any socket opens: the relay directory already knows,
  // and dialling a Host that is not there only turns into a slow timeout.
  if (info?.online === false) return <RemNotice problem={{ kind: 'offline' }} />
  if (!info || !identity) return <RemLoading label="Looking for the Host…" />
  return <RemReader address={address} browserAddress={identity.address} />
}
