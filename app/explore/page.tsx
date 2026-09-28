'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { HiOutlineRefresh, HiOutlineSearch } from 'react-icons/hi'
import { ChatLayout } from '@/components/chat-layout'
import { AgentDiscoveryCard } from '@/components/agent-discovery-card'
import { useOnlineAgents } from '@/hooks/use-online-agents'

export default function ExplorePage() {
  const { agents, loading, error, reload } = useOnlineAgents()
  const [query, setQuery] = useState('')

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
      <main className="flex-1 overflow-y-auto bg-workbench px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-7 border-b border-neutral-200 pb-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-identity-700">O Chat / Discover</div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">Explore agents</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-600 sm:text-base">
              Find an online agent by the work it can help you do. Task examples are published by agent owners.
            </p>
          </div>

          {!loading && !error && agents.length > 0 && (
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-neutral-700">{agents.length} online {agents.length === 1 ? 'agent' : 'agents'}</p>
              <div className="relative w-full sm:w-72">
                <HiOutlineSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
                <label htmlFor="explore-search" className="sr-only">Search online agents</label>
                <input
                  id="explore-search"
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search tasks or agents"
                  className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3 text-sm text-neutral-900 outline-none focus:border-identity-700 focus:ring-2 focus:ring-identity-100"
                />
              </div>
            </div>
          )}

          {loading ? (
            <p role="status" className="py-12 text-center text-sm text-neutral-600">Finding online agents…</p>
          ) : error ? (
            <div className="rounded-xl border border-neutral-200 bg-white px-6 py-10 text-center">
              <p role="alert" className="text-sm text-neutral-700">{error}</p>
              <button onClick={() => void reload()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-200 px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
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
            <div className={`grid gap-3 ${results.length > 1 ? 'lg:grid-cols-2' : 'max-w-2xl'}`}>
              {results.map(agent => <AgentDiscoveryCard key={agent.address} agent={agent} />)}
            </div>
          )}
          <p className="mt-6 text-sm leading-6 text-neutral-600">Online means connected. Access may still require an invite or payment.</p>
        </div>
      </main>
    </ChatLayout>
  )
}
