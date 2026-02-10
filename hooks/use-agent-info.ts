'use client'

import { useState, useEffect, useRef } from 'react'
import { fetchAgentInfo, type AgentInfo } from 'connectonion/react'

export type { AgentInfo } from 'connectonion/react'

/**
 * Hook to fetch info for multiple agent addresses.
 * Returns a map of address → AgentInfo.
 * Agents render immediately — info loads in background without blocking UI.
 */
export function useAgentInfo(addresses: string[]): Record<string, AgentInfo> {
  const [infoMap, setInfoMap] = useState<Record<string, AgentInfo>>({})
  const addressesKey = addresses.join(',')
  const prevKey = useRef('')

  useEffect(() => {
    if (addressesKey === prevKey.current) return
    prevKey.current = addressesKey

    if (addresses.length === 0) {
      setInfoMap({})
      return
    }

    for (const addr of addresses) {
      fetchAgentInfo(addr).then(info => {
        setInfoMap(prev => ({ ...prev, [addr]: info }))
      }).catch(() => {
        setInfoMap(prev => ({ ...prev, [addr]: { address: addr, online: false } }))
      })
    }
  }, [addressesKey, addresses])

  return infoMap
}

/** Truncate address for display: 0x3d4017c3...89ab */
export function shortAddress(address: string): string {
  if (address.length <= 14) return address
  return `${address.slice(0, 8)}...${address.slice(-4)}`
}
