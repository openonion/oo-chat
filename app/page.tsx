'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlineArrowRight, HiOutlinePlus } from 'react-icons/hi'
import { ChatLayout } from '@/components/chat-layout'
import { AgentDiscoveryCard } from '@/components/agent-discovery-card'
import { useOnlineAgents } from '@/hooks/use-online-agents'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress, agentInitial, isAgentAddress, ADDRESS_ERROR } from '@/hooks/use-agent-info'

export default function Home() {
  const router = useRouter()
  const { agents, addAgent } = useChatStore()
  const infoMap = useAgentInfo(agents)
  const { agents: onlineAgents, loading: directoryLoading, error: directoryError } = useOnlineAgents(agents.length === 0)
  const [newAddress, setNewAddress] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addressError, setAddressError] = useState('')

  useIdentity()

  const handleAddressChange = (value: string) => {
    setNewAddress(value)
    setAddressError('')
  }

  const handleAddAgent = (address: string) => {
    const trimmed = address.trim()
    if (!trimmed) return
    if (!isAgentAddress(trimmed)) {
      setAddressError(ADDRESS_ERROR)
      return
    }
    addAgent(trimmed)
    setNewAddress('')
    setShowAddForm(false)
    setAddressError('')
    router.push(`/${trimmed}`)
  }

  if (agents.length === 0) {
    return (
      <ChatLayout>
        <main className="flex-1 overflow-y-auto bg-workbench px-5 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-identity-700">O Chat / Your workspace</p>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">Find an agent for your next task</h1>
              <p className="mt-3 text-sm leading-6 text-neutral-600 sm:text-base">See what an agent can help with, then open its page to check access and start a conversation.</p>
              <Link href="/explore" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800">
                Explore online agents <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>

            <section aria-labelledby="available-agents-heading" className={onlineAgents.length > 1 ? '' : 'max-w-2xl'}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 id="available-agents-heading" className="text-lg font-semibold text-neutral-900">Available now</h2>
                {onlineAgents.length > 0 && <span className="text-sm text-neutral-600">{onlineAgents.length} online</span>}
              </div>
              {directoryLoading ? (
                <p role="status" className="rounded-xl border border-neutral-200 bg-white px-5 py-6 text-sm text-neutral-600">Looking for online agents…</p>
              ) : directoryError ? (
                <p className="rounded-xl border border-neutral-200 bg-white px-5 py-6 text-sm text-neutral-600">The agent directory is unavailable. You can still open a shared address below.</p>
              ) : onlineAgents.length === 0 ? (
                <p className="rounded-xl border border-neutral-200 bg-white px-5 py-6 text-sm text-neutral-600">No agents are online right now. You can open an agent address someone shared with you.</p>
              ) : (
                <div>
                  <div className={`grid gap-3 ${onlineAgents.length > 1 ? 'md:grid-cols-2' : ''}`}>
                    {onlineAgents.slice(0, 2).map((agent, index) => <div key={agent.address} className={index > 0 ? 'hidden md:block' : ''}><AgentDiscoveryCard agent={agent} /></div>)}
                  </div>
                  {onlineAgents.length > 1 && <Link href="/explore" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-identity-700 hover:underline">See all {onlineAgents.length} online agents <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4" /></Link>}
                </div>
              )}
            </section>

            <section aria-labelledby="shared-address-heading" className="mt-8 max-w-2xl border-t border-neutral-200 pt-6">
              <h2 id="shared-address-heading" className="text-base font-semibold text-neutral-900">Have an agent address?</h2>
              <p className="mt-1 text-sm text-neutral-600">Open an agent someone shared directly with you.</p>
              <form onSubmit={event => { event.preventDefault(); handleAddAgent(newAddress) }} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label htmlFor="first-agent-address" className="sr-only">Agent address</label>
                <input id="first-agent-address" type="text" value={newAddress} onChange={event => handleAddressChange(event.target.value)} placeholder="Paste agent address (0x...)" aria-invalid={!!addressError} aria-describedby={addressError ? 'address-error' : undefined} className={`min-h-11 min-w-0 flex-1 rounded-lg border bg-white px-3 font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-500 focus:ring-2 ${addressError ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-neutral-300 focus:border-identity-700 focus:ring-identity-100'}`} />
                <button type="submit" disabled={!newAddress.trim()} className="min-h-11 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400">View agent</button>
              </form>
              {addressError && <p id="address-error" role="alert" className="mt-2 text-sm text-red-700">{addressError}</p>}
            </section>
          </div>
        </main>
      </ChatLayout>
    )
  }

  return (
    <ChatLayout>
      <main className="flex-1 overflow-y-auto bg-workbench px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-identity-700">O Chat / Your workspace</p>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Your agents</h1>
          <p className="mt-2 text-sm text-neutral-600">Continue a conversation or choose an agent for a new task.</p>

          <div className="mt-7 space-y-2">
            {agents.map(address => {
              const info = infoMap[address]
              const label = info?.name || shortAddress(address)
              return (
                <button key={address} onClick={() => router.push(`/${address}`)} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition-colors hover:border-identity-700/40 hover:bg-identity-50/30">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-identity-50 text-sm font-semibold text-identity-800 ring-1 ring-identity-100">{agentInitial(label, address)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-neutral-900">{label}</span>
                    <span className="block text-xs text-neutral-600">{info?.online === true ? 'Online' : info?.online === false ? 'Offline' : 'Checking availability'}</span>
                  </span>
                  <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4 text-neutral-500" />
                </button>
              )
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link href="/explore" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800">Explore agents <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
            {!showAddForm && <button onClick={() => setShowAddForm(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-100"><HiOutlinePlus aria-hidden="true" className="h-4 w-4" /> Add by address</button>}
          </div>
          {showAddForm && (
            <form onSubmit={event => { event.preventDefault(); handleAddAgent(newAddress) }} className="mt-5 max-w-xl border-t border-neutral-200 pt-5">
              <label htmlFor="add-agent-address" className="block text-sm font-medium text-neutral-800">Agent address</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input id="add-agent-address" type="text" value={newAddress} onChange={event => handleAddressChange(event.target.value)} placeholder="Paste agent address (0x...)" autoFocus aria-invalid={!!addressError} aria-describedby={addressError ? 'add-address-error' : undefined} className="min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm outline-none focus:border-identity-700 focus:ring-2 focus:ring-identity-100" />
                <button type="submit" disabled={!newAddress.trim()} className="min-h-11 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Add agent</button>
                <button type="button" onClick={() => { setShowAddForm(false); setNewAddress(''); setAddressError('') }} className="min-h-11 rounded-lg px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100">Cancel</button>
              </div>
              {addressError && <p id="add-address-error" role="alert" className="mt-2 text-sm text-red-700">{addressError}</p>}
            </form>
          )}
        </div>
      </main>
    </ChatLayout>
  )
}
