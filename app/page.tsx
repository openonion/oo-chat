'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlineArrowRight, HiOutlinePlus } from 'react-icons/hi'
import { HiOutlineChatBubbleLeftRight, HiOutlineClipboardDocumentCheck, HiOutlineCommandLine, HiOutlineDocumentText, HiOutlineGlobeAlt, HiOutlineHome, HiOutlineMagnifyingGlass, HiOutlinePhoto, HiOutlineRocketLaunch, HiOutlineSparkles } from 'react-icons/hi2'
import { ChatLayout } from '@/components/chat-layout'
import { useChatStore, type Conversation } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress, isAgentAddress, ADDRESS_ERROR, type AgentInfo } from '@/hooks/use-agent-info'
import { publicCapabilities } from '@/lib/agent-capabilities'

function capabilityIcon(name: string, className: string) {
  if (/deploy|publish|release|ship/i.test(name)) return <HiOutlineRocketLaunch aria-hidden="true" className={className} />
  if (/research|search|find|explore|investigate/i.test(name)) return <HiOutlineMagnifyingGlass aria-hidden="true" className={className} />
  if (/summari[sz]|document|write|draft|report/i.test(name)) return <HiOutlineDocumentText aria-hidden="true" className={className} />
  if (/image|photo|banana|visual/i.test(name)) return <HiOutlinePhoto aria-hidden="true" className={className} />
  if (/init|setup|scaffold|install/i.test(name)) return <HiOutlineCommandLine aria-hidden="true" className={className} />
  if (/scan|audit|check|status/i.test(name)) return <HiOutlineClipboardDocumentCheck aria-hidden="true" className={className} />
  if (/home|house|property|rental|listing|airbnb/i.test(name)) return <HiOutlineHome aria-hidden="true" className={className} />
  if (/web|browse|site|page/i.test(name)) return <HiOutlineGlobeAlt aria-hidden="true" className={className} />
  return <HiOutlineSparkles aria-hidden="true" className={className} />
}

function SavedAgentCard({ address, info, recent }: { address: string; info?: AgentInfo; recent?: Conversation }) {
  const label = info?.name || shortAddress(address)
  const capabilities = publicCapabilities(info?.skills, 2)
  const status = info?.online === true ? 'Online' : info?.online === false ? 'Offline' : 'Checking status'

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_32px_-28px_rgba(28,25,34,0.42)] transition-shadow hover:shadow-[0_14px_36px_-28px_rgba(28,25,34,0.5)]">
      <div className="flex min-w-0 items-start gap-4 px-6 pb-5 pt-6">
        <span aria-hidden="true" className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${info?.online === false ? 'bg-neutral-100 text-neutral-500' : 'bg-identity-50 text-identity-700'} ring-1 ring-inset ring-neutral-200/70`}>{capabilities.length ? capabilityIcon(capabilities[0].name, 'h-7 w-7') : <HiOutlineCommandLine className="h-7 w-7" />}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold tracking-tight text-neutral-900">{label}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-600">
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${info?.online === true ? 'bg-emerald-600' : 'bg-neutral-400'}`} />
            {status}
          </p>
        </div>
        <Link href={`/${address}`} className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-semibold text-identity-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-identity-700">
          {info?.online === false ? 'View details' : 'Open'} <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
      <div className="border-t border-neutral-100 px-6 py-5">
        {capabilities.length ? (
          <div className="space-y-4">
            {capabilities.map(capability => {
              return (
                <div key={capability.name} className="flex min-w-0 items-center gap-3">
                  {capabilityIcon(capability.name, 'h-5 w-5 shrink-0 text-identity-700')}
                  <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-2">
                    <h3 className="shrink-0 truncate text-sm font-semibold text-neutral-900">{capability.title}</h3>
                    <p className="truncate text-xs text-neutral-600" title={capability.summary}>{capability.summary}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : info?.online === false ? (
          <p className="text-sm text-neutral-600">Unavailable for messages</p>
        ) : info ? (
          <p className="text-sm leading-5 text-neutral-600">No published task examples yet.</p>
        ) : (
          <p className="text-sm leading-5 text-neutral-600">Loading details…</p>
        )}
      </div>
      <div className="border-t border-neutral-100 bg-neutral-50/50 px-6 py-3">
        {recent && (
          <Link href={`/${address}/${recent.sessionId}`} className="flex min-h-8 min-w-0 items-center gap-2 text-sm text-neutral-700 hover:text-identity-700">
            <HiOutlineChatBubbleLeftRight aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="truncate"><span className="font-medium">Recent</span><span className="mx-2 text-neutral-300">·</span>{recent.title}</span>
          </Link>
        )}
        {!recent && <span className="text-xs text-neutral-500">{info?.online === false ? 'Host not connected' : 'Ready for a new conversation'}</span>}
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
        <div className={`mx-auto flex min-h-full flex-col justify-center py-8 lg:pb-14 ${agents.length ? 'max-w-4xl' : 'max-w-5xl'}`}>
          <header className="mb-7">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">{agents.length ? 'Your agents' : 'Start a conversation'}</h1>
            {!agents.length && <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">Choose how to find an agent.</p>}
          </header>

          {agents.length ? (
            <>
              <section aria-label="Your saved agents" className="grid items-start gap-5 md:grid-cols-2">
                {agents.map(address => {
                  const recent = conversations
                    .filter(conversation => conversation.agentAddress === address)
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
                  return <SavedAgentCard key={address} address={address} info={infoMap[address]} recent={recent} />
                })}
              </section>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/explore" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-identity-50/30 md:hidden">Explore agents <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
                {!showAddForm && <button onClick={() => setShowAddForm(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"><HiOutlinePlus aria-hidden="true" className="h-4 w-4" /> Add by address</button>}
              </div>
              {showAddForm && <div className="mt-5 max-w-xl border-t border-neutral-200">{addressForm('add-agent-address')}<button type="button" onClick={() => { setShowAddForm(false); setNewAddress(''); setAddressError('') }} className="mt-2 min-h-11 rounded-lg px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100">Cancel</button></div>}
            </>
          ) : (
            <section aria-label="Ways to find an agent" className="grid gap-4 md:grid-cols-2">
              <div className="flex min-h-64 flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_8px_32px_-28px_rgba(28,25,34,0.42)] sm:p-7">
                <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-identity-50 text-identity-700"><HiOutlineMagnifyingGlass className="h-7 w-7" /></span>
                <h2 className="mt-5 text-xl font-semibold tracking-tight text-neutral-900">Explore agents</h2>
                <p className="mt-1 text-sm text-neutral-600">Browse work they can do.</p>
                <Link href="/explore" className="mt-auto inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800">Explore <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
              </div>
              <div className="flex min-h-64 flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_8px_32px_-28px_rgba(28,25,34,0.42)] sm:p-7">
                <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-700"><HiOutlineCommandLine className="h-7 w-7" /></span>
                <h2 className="mt-5 text-xl font-semibold tracking-tight text-neutral-900">Have an agent address?</h2>
                <p className="mt-1 text-sm text-neutral-600">Open an agent shared with you.</p>
                {addressForm('first-agent-address')}
              </div>
            </section>
          )}
        </div>
      </main>
    </ChatLayout>
  )
}
