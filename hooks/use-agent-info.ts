'use client'

// React wrapper around the SDK's fetchAgentInfo: polls every 30s and re-fetches
// on tab focus. All field mapping (relay profile, direct /info merge, online
// detection) lives in the SDK — this file must not duplicate it.
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAgentConnection } from '../store/agent-connection'
import { fetchAgentInfo } from '@connectonion/react'
import type { AgentInfo } from '@connectonion/react'

export type { AgentInfo, SkillInfo, AgentAcceptedInputs } from '@connectonion/react'

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
 * Cache-first: refetched on mount and whenever the tab regains focus, plus a slow
 * background revalidate every 10 minutes. The focus refetch is what keeps status
 * fresh for someone actually looking at the page; the interval only catches an
 * agent going offline while the tab stays open and untouched.
 */
export function useAgentInfo(addresses: string[]): Record<string, AgentInfo> {
  const liveConnection = useAgentConnection(state => state.connection)
  // Seed from the module cache so a remount renders last-known status instantly
  // instead of blanking the indicator until the first fetch returns.
  const [infoMap, setInfoMap] = useState<Record<string, AgentInfo>>(() => {
    const seed: Record<string, AgentInfo> = {}
    for (const addr of addresses) {
      if (infoCache[addr]) seed[addr] = infoCache[addr]
    }
    if (liveConnection?.state === 'connected' && addresses.includes(liveConnection.agentAddress)) {
      const address = liveConnection.agentAddress
      seed[address] = { ...seed[address], online: true } as AgentInfo
      infoCache[address] = seed[address]
    }
    return seed
  })

  // Stable key so a new array reference on each render doesn't restart polling
  const addressesKey = addresses.join(',')

  const fetchAll = useCallback(() => {
    if (addresses.length === 0) return

    for (const addr of addresses) {
      fetchAgentInfo(addr).then(info => {
        const live = useAgentConnection.getState().connection
        if (live?.agentAddress === addr && live.state === 'connected') info = { ...info, online: true }
        infoCache[addr] = info // authoritative result — persist across remounts
        setInfoMap(prev => {
          const existing = prev[addr]
          if (existing && JSON.stringify(existing) === JSON.stringify(info)) return prev
          return { ...prev, [addr]: info }
        })
      }).catch(() => {
        // A transport failure is unknown, not authoritative offline. Keep
        // last-known data. Without any, store a bare { address }: no name and no
        // presence, so presence stays unknown (never "offline" on a blip) while
        // labels know the lookup has finished and show the address instead of a
        // loading placeholder forever.
        setInfoMap(prev => {
          const known = prev[addr] ?? infoCache[addr] ?? ({ address: addr } as AgentInfo)
          if (prev[addr] === known) return prev
          return { ...prev, [addr]: known }
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

  // Persist positive transport evidence when the external connection changes.
  useEffect(() => useAgentConnection.subscribe(({ connection }) => {
    if (connection?.state !== 'connected' || !addressesKey.split(',').includes(connection.agentAddress)) return
    const address = connection.agentAddress
    setInfoMap(prev => {
      const raised = { ...(prev[address] ?? infoCache[address]), online: true } as AgentInfo
      infoCache[address] = raised
      return { ...prev, [address]: raised }
    })
  }), [addressesKey])

  useEffect(() => {
    if (liveConnection?.state === 'connected') fetchAll()
  }, [liveConnection, fetchAll])

  return useMemo(() => {
    if (liveConnection?.state !== 'connected' || !addresses.includes(liveConnection.agentAddress)) return infoMap
    const address = liveConnection.agentAddress
    return { ...infoMap, [address]: { ...infoMap[address], online: true } as AgentInfo }
  // addressesKey is the stable identity of the requested addresses.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infoMap, liveConnection, addressesKey])
}

/** Truncate address for display: 0x3d40…89ab */
export function shortAddress(address: string): string {
  if (address.length <= 14) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Avatar glyph for places without an AgentAvatar: first letter of the name;
 *  unnamed agents use the first LETTER of the hex payload. */
export function agentInitial(label: string, address: string): string {
  if (label !== shortAddress(address)) return label.charAt(0).toUpperCase()
  const alpha = address.slice(2).match(/[a-f]/i)
  return (alpha ? alpha[0] : address.slice(2, 3)).toUpperCase()
}

/** An agent address is `0x` followed by 64 hex characters — a public key.
 *
 *  One definition because there were two: the root picker checked this and
 *  Settings did not, so the same paste was refused in one place and became a
 *  permanent agent in the other. A paste that clipped the last few characters
 *  looks exactly like one that did not, which is the case this catches. */
export function isAgentAddress(value: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(value)
}

/** Shown when it is not. Shared so both surfaces refuse in the same words. */
export const ADDRESS_ERROR = 'Enter a valid agent address (0x + 64 hex characters)'
