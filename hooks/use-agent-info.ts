'use client'

import { useState, useEffect, useCallback } from 'react'

export interface SkillInfo {
  name: string
  description: string
  location?: string  // absent in published relay profiles (which carry name + description only)
}

export interface AcceptedInputs {
  text?: boolean
  images?: boolean
  files?: { max_file_size_mb: number; max_files_per_request: number }
}

export interface AgentInfo {
  address: string
  name?: string
  tools?: string[]
  skills?: SkillInfo[]
  trust?: string
  version?: string
  model?: string
  acceptedInputs?: AcceptedInputs
  online: boolean
}

const RELAY = 'https://oo.openonion.ai'
const POLL_INTERVAL = 30000 // 30 seconds

function sortEndpoints(endpoints: string[]): string[] {
  return [...endpoints].sort((a, b) => {
    const priority = (url: string) => {
      if (url.includes('localhost') || url.includes('127.0.0.1')) return 0
      if (url.includes('192.168.') || url.includes('10.') || url.includes('172.16.')) return 1
      return 2
    }
    return priority(a) - priority(b)
  })
}

async function fetchAgentInfoFull(agentAddress: string): Promise<AgentInfo> {
  // A fetch rejection (timeout/network/CORS) or a non-2xx relay response is NOT
  // an authoritative "offline" — it means we couldn't ask. Let it throw so the
  // caller PRESERVES the last known state instead of flapping the dot to offline.
  // The browser tab gets starved during a heavy run (screenshot flood + streaming
  // re-renders), which spuriously trips AbortSignal.timeout — that must not read
  // as the agent going down.
  const relayRes = await fetch(`${RELAY}/api/relay/agents/${agentAddress}`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!relayRes.ok) throw new Error(`relay ${relayRes.status}`)

  const relayData = await relayRes.json() as { endpoints?: string[]; relay?: string | null }

  // Online = the agent holds a LIVE announce connection to the relay (`relay`
  // is non-null only while connected). last_seen/endpoints persist in the DB
  // forever, so they can't mean online — this matches the SDK's own
  // fetchAgentInfo in connect/endpoint.ts. A successful direct /info probe below
  // upgrades this to true for directly-reachable (e.g. localhost) agents whose
  // relay announce may briefly churn.
  const isOnline = Boolean(relayData.relay)
  const { endpoints = [] } = relayData
  const httpEndpoints = sortEndpoints(endpoints.filter((ep: string) => ep.startsWith('http')))

  // Base display info from the agent's published relay profile (name + skills).
  // Deployed agents announce internal container endpoints, so direct /info is
  // usually unreachable from the browser — the profile is the reliable source.
  let info: AgentInfo = { address: agentAddress, online: isOnline }
  try {
    const profileRes = await fetch(`${RELAY}/api/relay/agents/${agentAddress}/profile`, {
      signal: AbortSignal.timeout(5000),
    })
    if (profileRes.ok) {
      const { profile } = await profileRes.json() as {
        profile?: { alias?: string; name?: string; skills?: SkillInfo[]; version?: string }
      }
      if (profile) {
        info = { ...info, name: profile.name || profile.alias, skills: profile.skills, version: profile.version }
      }
    }
  } catch {
    // No reachable profile — fall through to direct /info
  }

  // Enrich with direct /info when reachable (adds tools/model/trust/inputs).
  // A SUCCESSFUL /info probe is positive proof the agent is reachable right now, so it
  // marks online=true regardless of the relay's live-announce flag — that's the reliable
  // signal for a directly-reachable (e.g. localhost) agent whose relay record may churn.
  // A FAILED probe still doesn't force offline (NAT/firewall make it unreliable for
  // deployed agents); we just fall through to the relay-based isOnline.
  for (const httpUrl of httpEndpoints) {
    try {
      const infoRes = await fetch(`${httpUrl}/info`, { signal: AbortSignal.timeout(3000) })
      if (!infoRes.ok) continue

      const direct = await infoRes.json() as {
        address?: string; name?: string; tools?: string[]
        skills?: SkillInfo[]; trust?: string; version?: string
        model?: string; accepted_inputs?: AcceptedInputs
      }
      if (direct.address === agentAddress) {
        return {
          address: agentAddress,
          name: direct.name ?? info.name,
          tools: direct.tools,
          skills: direct.skills ?? info.skills,
          trust: direct.trust,
          version: direct.version ?? info.version,
          model: direct.model,
          acceptedInputs: direct.accepted_inputs,
          online: true,  // reached it directly → definitively online
        }
      }
    } catch {
      // Direct connection failed — continue to next endpoint
    }
  }

  return info
}

/**
 * Hook to fetch info for multiple agent addresses.
 * Returns a map of address → AgentInfo.
 * Agents render immediately — info loads in background without blocking UI.
 * Polls every 30 seconds to keep status fresh.
 */
export function useAgentInfo(addresses: string[]): Record<string, AgentInfo> {
  const [infoMap, setInfoMap] = useState<Record<string, AgentInfo>>({})

  // Stable key so a new array reference on each render doesn't restart polling
  const addressesKey = addresses.join(',')

  const fetchAll = useCallback(() => {
    if (addresses.length === 0) return

    for (const addr of addresses) {
      fetchAgentInfoFull(addr).then(info => {
        setInfoMap(prev => {
          const existing = prev[addr]
          // Merge over the last good record: a cycle that resolved online-status but
          // not name/skills (e.g. the relay profile fetch blipped) must not erase
          // metadata we already have. Static fields stay sticky; online takes the
          // fresh value (it's always present in info).
          const next = { ...existing, ...info }
          if (existing && existing.online === next.online && existing.name === next.name &&
              JSON.stringify(existing.skills) === JSON.stringify(next.skills)) {
            return prev
          }
          return { ...prev, [addr]: next }
        })
      }).catch(() => {
        // Transient failure (couldn't reach the relay this cycle). PRESERVE the
        // last known state — flipping to offline here is the flap the user saw.
        // Only show offline if we have never reached the relay for this address.
        setInfoMap(prev => {
          if (prev[addr]) return prev
          return { ...prev, [addr]: { address: addr, online: false } }
        })
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressesKey])

  // Initial fetch and polling
  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchAll])

  // Re-fetch when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchAll()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchAll])

  return infoMap
}

/** Truncate address for display: 0x3d4017c3...89ab */
export function shortAddress(address: string): string {
  if (address.length <= 14) return address
  return `${address.slice(0, 8)}...${address.slice(-4)}`
}
