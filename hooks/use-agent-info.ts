'use client'

// React wrapper around the SDK's fetchAgentInfo: polls every 30s and re-fetches
// on tab focus. All field mapping (relay profile, direct /info merge, online
// detection) lives in the SDK — this file must not duplicate it.
import { useState, useEffect, useCallback } from 'react'
import { fetchAgentInfo } from 'connectonion/react'
import type { AgentInfo } from 'connectonion/react'

export type { AgentInfo, SkillInfo, AgentAcceptedInputs } from 'connectonion/react'

const POLL_INTERVAL = 600000 // 10 minutes — info is cache-first + refetched on tab focus/mount; this is just a slow background revalidate for liveness/profile changes, not a tight poll

// Last-known info per address, kept at module scope so it survives component
// remounts. The Sidebar and agent pages live inside each route's subtree (there
// is no shared app/[address]/layout.tsx), so navigating between sessions — or
// creating a new one — remounts them and resets a plain useState({}) back to
// empty, blanking the online indicator until the next fetch resolves (the
// "offline flicker"). Seeding from this cache shows the last-known status
// immediately; the 30s poll still refreshes it. Mirrors the SDK's module-level
// storeCache, which solves the same survive-remount problem for sessions.
const infoCache: Record<string, AgentInfo> = {}

/**
 * Hook to fetch info for multiple agent addresses.
 * Returns a map of address → AgentInfo.
 * Agents render immediately — info loads in background without blocking UI.
 * Polls every 30 seconds to keep status fresh.
 */
export function useAgentInfo(addresses: string[]): Record<string, AgentInfo> {
  // Seed from the module cache so a remount renders last-known status instantly
  // instead of blanking the indicator until the first fetch returns.
  const [infoMap, setInfoMap] = useState<Record<string, AgentInfo>>(() => {
    const seed: Record<string, AgentInfo> = {}
    for (const addr of addresses) {
      if (infoCache[addr]) seed[addr] = infoCache[addr]
    }
    return seed
  })

  // Stable key so a new array reference on each render doesn't restart polling
  const addressesKey = addresses.join(',')

  const fetchAll = useCallback(() => {
    if (addresses.length === 0) return

    for (const addr of addresses) {
      fetchAgentInfo(addr).then(info => {
        infoCache[addr] = info // authoritative result — persist across remounts
        setInfoMap(prev => {
          const existing = prev[addr]
          if (existing && JSON.stringify(existing) === JSON.stringify(info)) return prev
          return { ...prev, [addr]: info }
        })
      }).catch(() => {
        // Transient fetch error: reflect offline in the live map but DON'T write
        // it to infoCache — a network blip shouldn't overwrite the last-known
        // (likely online) status that seeds the next remount. Keep the other
        // fields (name, etc.) so the sidebar doesn't degrade to a hex label.
        setInfoMap(prev => {
          if (prev[addr]?.online === false) return prev
          return { ...prev, [addr]: { ...(prev[addr] ?? infoCache[addr]), address: addr, online: false } }
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

/** Avatar glyph: first letter of the name; unnamed agents use the first
 *  LETTER of the hex payload — a digit ('5') reads as broken, 'F' reads
 *  as an identity. */
export function agentInitial(label: string, address: string): string {
  if (label !== shortAddress(address)) return label.charAt(0).toUpperCase()
  const alpha = address.slice(2).match(/[a-f]/i)
  return (alpha ? alpha[0] : address.slice(2, 3)).toUpperCase()
}
