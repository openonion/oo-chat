'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PublicCapability } from '@/lib/agent-capabilities'

export type ListedAgent = {
  address: string
  name: string | null
  model: string | null
  skillCount: number
  capabilities: PublicCapability[]
}

async function fetchOnlineAgents(): Promise<ListedAgent[]> {
  const response = await fetch('/api/agents/online', { cache: 'no-store' })
  if (!response.ok) throw new Error('Directory unavailable')
  const data = await response.json()
  return data.agents
}

export function useOnlineAgents(enabled = true) {
  const [agents, setAgents] = useState<ListedAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAgents(await fetchOnlineAgents())
    } catch {
      setError('Could not load online agents. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let active = true
    fetchOnlineAgents().then(
      found => { if (active) setAgents(found) },
      () => { if (active) setError('Could not load online agents. Please try again.') },
    ).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [enabled])

  return { agents, loading, error, reload }
}
