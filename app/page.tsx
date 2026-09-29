'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlineArrowRight, HiOutlinePlus } from 'react-icons/hi'
import { ChatLayout } from '@/components/chat-layout'
import { useChatStore, type Conversation } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress, agentInitial, isAgentAddress, ADDRESS_ERROR, type AgentInfo } from '@/hooks/use-agent-info'
import { publicCapabilities } from '@/lib/agent-capabilities'

function SavedAgentCard({ address, info, recent }: { address: string; info?: AgentInfo; recent?: Conversation }) {
  const label = info?.name || shortAddress(address)
  const capabilities = publicCapabilities(info?.skills, 2)
  const status = info?.online === true ? 'Online' : info?.online === false ? 'Offline' : 'Checking status'

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-identity-50 text-sm font-semibold text-identity-800 ring-1 ring-identity-100">{agentInitial(label, address)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-neutral-900">{label}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-600">
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${info?.online === true ? 'bg-emerald-600' : 'bg-neutral-400'}`} />
            {status}
          </p>
        </div>
        <Link href={`/${address}`} className="inline-flex min-h-9 shrink-0 items-center gap-1 text-sm font-semibold text-identity-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-identity-700">
          {info?.online === false ? 'View details' : 'Open'} <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-5 flex-1">
        {capabilities.length ? (
          <div className="space-y-2.5">
            {capabilities.map(capability => (
              <div key={capability.name} className="grid min-w-0 grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3 text-sm">
                <h3 className="truncate font-semibold text-neutral-900">{capability.title}</h3>
                <p className="line-clamp-2 leading-5 text-neutral-600">{capability.summary}</p>
              </div>
            ))}
          </div>
        ) : info?.online === false ? (
          <p className="text-sm leading-5 text-neutral-600">This agent is unavailable for messages. View its details for next steps.</p>
        ) : info ? (
          <p className="text-sm leading-5 text-neutral-600">No published task examples yet.</p>
        ) : (
          <p className="text-sm leading-5 text-neutral-600">Loading details…</p>
        )}
      </div>
      <div className="mt-4 border-t border-neutral-100 pt-3">
        {capabilities.length > 0 && info?.online === false && <p className="mb-2 text-xs text-neutral-600">Unavailable for messages · View details for next steps</p>}
        {recent && (
          <Link href={`/${address}/${recent.sessionId}`} className="block truncate text-sm text-neutral-600 hover:text-identity-700">
            <span className="font-medium text-neutral-500">Recent</span><span className="mx-2 text-neutral-300">·</span>{recent.title}
          </Link>
        )}
        {!recent && <span className="text-xs text-neutral-500">No conversations yet</span>}
      </div>
    </article>
  )
}

export default function Home() {
  const router = useRouter()
  const { agents, conversations, addAgent } = useChatStore()
  const infoMap = useAgentInfo(agents)
  const [newAddress, setNewAddress] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addressError, setAddressError] = useState('')
  useIdentity()

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
  const addressForm = (id: string) => (
    <form onSubmit={event => { event.preventDefault(); handleAddAgent(newAddress) }} className="mt-auto pt-5">
      <label htmlFor={id} className="sr-only">Agent address</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id={id} type="text" value={newAddress} onChange={event => { setNewAddress(event.target.value); setAddressError('') }} placeholder="Paste agent address (0x...)" aria-invalid={!!addressError} aria-describedby={addressError ? `${id}-error` : undefined} className="min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-500 focus:border-identity-700 focus:ring-2 focus:ring-identity-100" />
        <button type="submit" disabled={!newAddress.trim()} className="min-h-11 shrink-0 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400">View agent</button>
      </div>
      {addressError && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-700">{addressError}</p>}
    </form>
  )

  return (
    <ChatLayout>
      <main className="flex-1 overflow-y-auto bg-workbench px-5 py-8 sm:px-8 sm:py-10">
        <div className={`mx-auto max-w-5xl ${agents.length ? 'lg:pt-10' : 'lg:flex lg:min-h-full lg:flex-col lg:justify-center lg:pb-12'}`}>
          <header className="mb-7">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-identity-700">O Chat / Your workspace</p>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">{agents.length ? 'Your agents' : 'Start a conversation'}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">{agents.length ? 'Pick up recent work or open an agent for a new task.' : 'Find an agent by its work, or use an address you already have.'}</p>
          </header>

          {agents.length ? (
            <>
              <section aria-label="Your saved agents" className="grid gap-4 md:grid-cols-2">
                {agents.map(address => {
                  const recent = conversations
                    .filter(conversation => conversation.agentAddress === address)
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
                  return <SavedAgentCard key={address} address={address} info={infoMap[address]} recent={recent} />
                })}
              </section>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/explore" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-identity-50/30">Explore agents <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
                {!showAddForm && <button onClick={() => setShowAddForm(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"><HiOutlinePlus aria-hidden="true" className="h-4 w-4" /> Add by address</button>}
              </div>
              {showAddForm && <div className="mt-5 max-w-xl border-t border-neutral-200">{addressForm('add-agent-address')}<button type="button" onClick={() => { setShowAddForm(false); setNewAddress(''); setAddressError('') }} className="mt-2 min-h-11 rounded-lg px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100">Cancel</button></div>}
            </>
          ) : (
            <section aria-label="Ways to find an agent" className="grid gap-4 md:grid-cols-2">
              <div className="flex min-h-56 flex-col rounded-xl border border-neutral-200 bg-white p-6 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-identity-700">Browse by task</p>
                <h2 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">Explore agents</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-600">See published skills, availability, and access before choosing.</p>
                <Link href="/explore" className="mt-auto inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800">Explore <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
              </div>
              <div className="flex min-h-56 flex-col rounded-xl border border-neutral-200 bg-white p-6 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-identity-700">Shared with you</p>
                <h2 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">Have an agent address?</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">Open its profile before starting a chat.</p>
                {addressForm('first-agent-address')}
              </div>
            </section>
          )}
        </div>
      </main>
    </ChatLayout>
  )
}
