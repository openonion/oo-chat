import type { AgentInfo } from '@connectonion/react'

export type AgentPresence = 'online' | 'unknown' | 'offline'

export interface AgentOrderItem {
  address: string
  presence: AgentPresence
  selected: boolean
}

export function agentPresence(info?: AgentInfo): AgentPresence {
  if (info?.online === true) return 'online'
  if (info?.online === false) return 'offline'
  return 'unknown'
}

/** Stable, shared ordering for navigation and management surfaces. */
export function orderAgents(
  addresses: string[],
  infoMap: Record<string, AgentInfo | undefined>,
  selectedAddress?: string | null,
  recentActivity: Record<string, number> = {},
): AgentOrderItem[] {
  const rank: Record<AgentPresence, number> = { online: 0, unknown: 1, offline: 2 }

  return addresses.map(address => ({
    address,
    presence: agentPresence(infoMap[address]),
    selected: address === selectedAddress,
  })).sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1
    if (rank[a.presence] !== rank[b.presence]) return rank[a.presence] - rank[b.presence]
    const activityDelta = (recentActivity[b.address] ?? 0) - (recentActivity[a.address] ?? 0)
    if (activityDelta) return activityDelta
    const aName = (infoMap[a.address]?.name || '').trim().toLocaleLowerCase()
    const bName = (infoMap[b.address]?.name || '').trim().toLocaleLowerCase()
    const nameDelta = aName.localeCompare(bName)
    return nameDelta || a.address.localeCompare(b.address)
  })
}
