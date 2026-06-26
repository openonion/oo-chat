'use client'

import { useState, useEffect, useCallback } from 'react'

export interface SkillInfo {
  name: string
  description: string
  location?: string
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

type RelayRuntimeMetadata = {
  name?: string
  tools?: unknown
  skills?: unknown
  trust?: string
  version?: string
  model?: string
}

type DirectAgentInfo = {
  address?: string
  name?: string
  tools?: unknown
  skills?: unknown
  trust?: string
  version?: string
  model?: string
  accepted_inputs?: AcceptedInputs
}

function normalizeTools(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined

  const tools = value
    .map(tool => {
      if (typeof tool === 'string') return tool
      if (tool && typeof tool === 'object') {
        const name = (tool as { name?: unknown }).name
        return typeof name === 'string' ? name : undefined
      }
      return undefined
    })
    .filter((name): name is string => Boolean(name))

  return tools.length > 0 ? tools : undefined
}

function normalizeSkills(value: unknown): SkillInfo[] | undefined {
  if (!Array.isArray(value)) return undefined

  const skills = value
    .map(item => {
      if (!item || typeof item !== 'object') return undefined
      const skill = item as { name?: unknown; description?: unknown; location?: unknown }
      if (typeof skill.name !== 'string' || !skill.name) return undefined

      const normalized: SkillInfo = {
        name: skill.name,
        description: typeof skill.description === 'string' ? skill.description : '',
      }
      if (typeof skill.location === 'string' && skill.location) {
        normalized.location = skill.location
      }
      return normalized
    })
    .filter((skill): skill is SkillInfo => Boolean(skill))

  return skills.length > 0 ? skills : undefined
}

function metadataToAgentInfo(metadata?: RelayRuntimeMetadata | null): Partial<AgentInfo> {
  const info: Partial<AgentInfo> = {}
  const tools = normalizeTools(metadata?.tools)
  const skills = normalizeSkills(metadata?.skills)

  if (metadata?.name) info.name = metadata.name
  if (tools) info.tools = tools
  if (skills) info.skills = skills
  if (metadata?.trust) info.trust = metadata.trust
  if (metadata?.version) info.version = metadata.version
  if (metadata?.model) info.model = metadata.model

  return info
}

function directInfoToAgentInfo(info: DirectAgentInfo): Partial<AgentInfo> {
  const normalized: Partial<AgentInfo> = {}
  const tools = normalizeTools(info.tools)
  const skills = normalizeSkills(info.skills)

  if (info.name) normalized.name = info.name
  if (tools) normalized.tools = tools
  if (skills) normalized.skills = skills
  if (info.trust) normalized.trust = info.trust
  if (info.version) normalized.version = info.version
  if (info.model) normalized.model = info.model
  if (info.accepted_inputs) normalized.acceptedInputs = info.accepted_inputs

  return normalized
}

function mergeAgentInfo(base: AgentInfo, override: Partial<AgentInfo>): AgentInfo {
  return {
    address: base.address,
    name: override.name ?? base.name,
    tools: override.tools ?? base.tools,
    skills: override.skills ?? base.skills,
    trust: override.trust ?? base.trust,
    version: override.version ?? base.version,
    model: override.model ?? base.model,
    acceptedInputs: override.acceptedInputs ?? base.acceptedInputs,
    online: override.online ?? base.online,
  }
}

async function fetchAgentInfoFull(agentAddress: string): Promise<AgentInfo> {
  const relayRes = await fetch(`${RELAY}/api/relay/agents/${agentAddress}`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!relayRes.ok) return { address: agentAddress, online: false }

  const relayData = await relayRes.json() as {
    endpoints?: string[]
    last_seen?: string
    metadata?: RelayRuntimeMetadata | null
  }

  // Online = relay has a last_seen record. Direct /info reachability is unreliable
  // (NAT, firewall, slow response) and must not gate the online indicator.
  const isOnline = !!relayData.last_seen
  const { endpoints = [] } = relayData
  const fallbackInfo: AgentInfo = {
    address: agentAddress,
    ...metadataToAgentInfo(relayData.metadata),
    online: isOnline,
  }
  const httpEndpoints = sortEndpoints(endpoints.filter((ep: string) => ep.startsWith('http')))

  // Try to enrich with direct /info — best effort, never flips online to false
  for (const httpUrl of httpEndpoints) {
    try {
      const infoRes = await fetch(`${httpUrl}/info`, { signal: AbortSignal.timeout(3000) })
      if (!infoRes.ok) continue

      const info = await infoRes.json() as DirectAgentInfo
      if (info.address === agentAddress) {
        return mergeAgentInfo(fallbackInfo, directInfoToAgentInfo(info))
      }
    } catch {
      // Direct connection failed — continue to next endpoint
    }
  }

  return fallbackInfo
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
          if (existing?.online === info.online &&
              existing?.name === info.name &&
              existing?.model === info.model &&
              existing?.version === info.version &&
              JSON.stringify(existing?.skills) === JSON.stringify(info.skills) &&
              JSON.stringify(existing?.tools) === JSON.stringify(info.tools) &&
              JSON.stringify(existing?.acceptedInputs) === JSON.stringify(info.acceptedInputs)) {
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
