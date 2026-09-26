'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { HiOutlineArrowRight, HiOutlineRefresh, HiOutlineSearch } from 'react-icons/hi'
import { ChatLayout } from '@/components/chat-layout'
import { agentInitial, shortAddress } from '@/hooks/use-agent-info'
import type { PublicCapability } from '@/lib/agent-capabilities'

type ListedAgent = {
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

export default function ExplorePage() {
  const [agents, setAgents] = useState<ListedAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
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
    let active = true
    fetchOnlineAgents().then(
      found => { if (active) setAgents(found) },
      () => { if (active) setError('Could not load online agents. Please try again.') },
    ).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    if (!term) return agents
    return agents.filter(agent =>
      agent.address.toLocaleLowerCase().includes(term)
      || (agent.name || '').toLocaleLowerCase().includes(term)
      || (agent.model || '').toLocaleLowerCase().includes(term)
      || agent.capabilities.some(capability =>
        capability.title.toLocaleLowerCase().includes(term)
        || capability.summary.toLocaleLowerCase().includes(term)
      )
    )
  }, [agents, query])

  return (
    <ChatLayout>
      <main className="flex-1 overflow-y-auto bg-neutral-50/60 px-5 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 border-b border-neutral-200 pb-8">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Discover</div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">Explore agents</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-600 sm:text-base">
              Choose by what an agent can help you do. These examples come from skills published by each agent owner.
            </p>
          </div>

          {!loading && !error && agents.length > 0 && (
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-neutral-600">{agents.length} online {agents.length === 1 ? 'agent' : 'agents'}</p>
              <div className="relative w-full sm:w-72">
                <HiOutlineSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
                <label htmlFor="explore-search" className="sr-only">Search online agents</label>
                <input
                  id="explore-search"
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search tasks or agents"
                  className="min-h-11 w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                />
              </div>
            </div>
          )}

          {loading ? (
            <p role="status" className="py-12 text-center text-sm text-neutral-600">Finding online agents…</p>
          ) : error ? (
            <div className="rounded-xl border border-neutral-200 bg-white px-6 py-10 text-center">
              <p role="alert" className="text-sm text-neutral-700">{error}</p>
              <button onClick={() => void load()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-200 px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
                <HiOutlineRefresh aria-hidden="true" className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : agents.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white px-6 py-10 text-center">
              <p className="font-medium text-neutral-900">No agents are online right now.</p>
              <p className="mt-2 text-sm text-neutral-600">Check back later, or open an agent address someone shared with you.</p>
              <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-neutral-200 px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-50">Use an address</Link>
            </div>
          ) : results.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-600">No online agents match “{query}”.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {results.map(agent => {
                const label = agent.name || shortAddress(agent.address)
                return (
                  <Link
                    key={agent.address}
                    href={`/${agent.address}`}
                    className="group flex min-h-48 gap-4 rounded-xl border border-neutral-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-base font-semibold text-white">{agentInitial(label, agent.address)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="break-words text-base font-semibold leading-6 text-neutral-900">{label}</span>
                        <HiOutlineArrowRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-1 group-hover:text-neutral-900" />
                      </span>
                      <span className="mt-1 block font-mono text-xs text-neutral-500">{shortAddress(agent.address)}</span>
                      <span className="mt-4 block text-sm leading-6 text-neutral-700">
                        {agent.capabilities[0]?.summary || 'No public capability description yet. Open this agent to ask what it can do.'}
                      </span>
                      {agent.capabilities[1] && (
                        <span className="mt-2 block text-xs leading-5 text-neutral-500">Also: {agent.capabilities[1].title}</span>
                      )}
                      <span className="mt-4 flex items-center justify-between gap-3 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Online now</span>
                        <span className="font-medium text-neutral-700 group-hover:text-neutral-900">View agent</span>
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
          <p className="mt-8 text-center text-xs leading-5 text-neutral-500">Online means connected. An agent may still require an invite or payment; its page checks your access.</p>
        </div>
      </main>
    </ChatLayout>
  )
}
