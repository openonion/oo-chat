'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchAgentInfo, type AgentInfo } from 'connectonion/react'

export type { AgentInfo } from 'connectonion/react'

const POLL_INTERVAL = 30000 // 30 seconds

/**
 * Hook to fetch info for multiple agent addresses.
 * Returns a map of address → AgentInfo.
 * Agents render immediately — info loads in background without blocking UI.
 * Polls every 30 seconds to keep status fresh.
 */
export function useAgentInfo(addresses: string[]): Record<string, AgentInfo> {
  const [infoMap, setInfoMap] = useState<Record<string, AgentInfo>>({})

  const fetchAll = useCallback(() => {
    if (addresses.length === 0) return

    for (const addr of addresses) {
      fetchAgentInfo(addr).then(info => {
        setInfoMap(prev => {
          // Only update if status changed to avoid unnecessary re-renders
          if (prev[addr]?.online === info.online && prev[addr]?.name === info.name) {
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
  }, [addresses])

  // Initial fetch and polling
  useEffect(() => {
    fetchAll()

    const interval = setInterval(fetchAll, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchAll])

  // Re-fetch when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchAll()
      }
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
