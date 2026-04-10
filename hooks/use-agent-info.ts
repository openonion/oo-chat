'use client'

import { useState, useEffect, useCallback } from 'react'

export interface SkillInfo {
  name: string
  description: string
  location: string
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
  const relayRes = await fetch(`${RELAY}/api/relay/agents/${agentAddress}`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!relayRes.ok) return { address: agentAddress, online: false }

  const relayData = await relayRes.json() as { endpoints?: string[]; last_seen?: string }

  // Online = relay has a last_seen record. Direct /info reachability is unreliable
  // (NAT, firewall, slow response) and must not gate the online indicator.
  const isOnline = !!relayData.last_seen
  const { endpoints = [] } = relayData
  const httpEndpoints = sortEndpoints(endpoints.filter((ep: string) => ep.startsWith('http')))

  // Try to enrich with direct /info — best effort, never flips online to false
  for (const httpUrl of httpEndpoints) {
    try {
      const infoRes = await fetch(`${httpUrl}/info`, { signal: AbortSignal.timeout(3000) })
      if (!infoRes.ok) continue

      const info = await infoRes.json() as {
        address?: string; name?: string; tools?: string[]
        skills?: SkillInfo[]; trust?: string; version?: string
        model?: string; accepted_inputs?: AcceptedInputs
      }
      if (info.address === agentAddress) {
        return {
          address: agentAddress,
          name: info.name,
          tools: info.tools,
          skills: info.skills,
          trust: info.trust,
          version: info.version,
          model: info.model,
          acceptedInputs: info.accepted_inputs,
          online: isOnline,
        }
      }
    } catch {
      // Direct connection failed — continue to next endpoint
    }
  }

  return { address: agentAddress, online: isOnline }
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
          if (existing?.online === info.online && existing?.name === info.name &&
              JSON.stringify(existing?.skills) === JSON.stringify(info.skills)) {
            return prev
          }
          return { ...prev, [addr]: info }
        })
      }).catch(() => {
        setInfoMap(prev => {
          if (prev[addr]?.online === false) return prev
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
