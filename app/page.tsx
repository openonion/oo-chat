'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlinePlus } from 'react-icons/hi'
import { ChatLayout } from '@/components/chat-layout'
import { AgentAvatar } from '@/components/agent-avatar'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress, isAgentAddress, ADDRESS_ERROR } from '@/hooks/use-agent-info'

/**
 * Home. The 2 Sep structure (257dbb0), in green and white.
 *
 * One focus per state. A first visit is the hero and nothing else: the logo, the
 * one serif line on the page, one sentence, the address field and Connect. The
 * September iterations added a second card, a directory preview and saved-agent
 * work cards; each was reasonable alone and together they left no single thing
 * to look at first. Explore stays one click away in the sidebar.
 */
export default function Home() {
  const router = useRouter()
  const { agents, addAgent } = useChatStore()
  const infoMap = useAgentInfo(agents)
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
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddAgent(newAddress)
            }}
            className="flex w-full max-w-md flex-col items-center"
          >
            <Image src="/onion-green.png" alt="OpenOnion" width={56} height={56} priority />

            <h1 className="mt-5 text-center font-serif text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-neutral-900 md:text-5xl">
              Talk to any agent.
            </h1>
            <p className="mt-3.5 mb-7 text-center text-[15px] text-neutral-600">
              Paste its address — the conversation starts live.
            </p>

            <label htmlFor="first-agent-address" className="sr-only">Agent address</label>
            <input
              id="first-agent-address"
              type="text"
              value={newAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Paste agent address (0x...)"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!addressError}
              aria-describedby={addressError ? 'address-error' : undefined}
              className={`h-[50px] w-full rounded-xl border bg-white px-4 font-mono text-sm text-neutral-900 outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:ring-[3px] ${
                addressError
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-50'
                  : 'border-neutral-300 focus:border-primary focus:ring-tint'
              }`}
            />
            {/* Fixed-height slot so the column doesn't jump when the error appears */}
            <p id="address-error" role={addressError ? 'alert' : undefined} className="min-h-5 w-full pt-1 text-sm text-red-700">{addressError}</p>
            <button
              type="submit"
              disabled={!newAddress.trim()}
              className="mt-1 h-12 w-full rounded-xl bg-primary text-[15px] font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              Connect
            </button>
          </form>
        </div>
      </ChatLayout>
    )
  }

  // Has agents: pick one. Same hero, the list where the field was.
  return (
    <ChatLayout>
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-10">
        <div className="my-auto flex w-full max-w-lg flex-col items-center">
          <Image src="/onion-green.png" alt="OpenOnion" width={56} height={56} priority />
          <h1 className="mt-5 mb-8 text-center font-serif text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-neutral-900">
            Choose an agent
          </h1>

          <ul aria-label="Your agents" className="w-full space-y-2">
            {agents.map(address => {
              const info = infoMap[address]
              const label = info?.name || shortAddress(address)
              return (
                <li key={address}>
                  <button
                    onClick={() => router.push(`/${address}`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                  >
                    <AgentAvatar label={label} address={address} online={info?.online} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-semibold text-neutral-900 ${label === shortAddress(address) ? 'font-mono text-sm' : ''}`}>{label}</span>
                      {label !== shortAddress(address) && (
                        <span className="block truncate font-mono text-xs text-neutral-500">{shortAddress(address)}</span>
                      )}
                    </span>
                    <span className={`shrink-0 text-xs ${info?.online ? 'text-brand-700' : 'text-neutral-500'}`}>
                      {info?.online === undefined ? '' : info.online ? 'Online' : 'Offline'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {showAddForm ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleAddAgent(newAddress)
              }}
              className="mt-4 w-full"
            >
              <div className="flex gap-2">
                <label htmlFor="add-agent-address" className="sr-only">Agent address</label>
                <input
                  id="add-agent-address"
                  type="text"
                  value={newAddress}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  placeholder="0x..."
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  onBlur={() => { if (!newAddress.trim()) setShowAddForm(false) }}
                  aria-invalid={!!addressError}
                  aria-describedby={addressError ? 'add-address-error' : undefined}
                  className={`h-11 min-w-0 flex-1 rounded-lg border bg-white px-3 font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-[3px] ${
                    addressError ? 'border-red-300 focus:border-red-400 focus:ring-red-50' : 'border-neutral-300 focus:border-primary focus:ring-tint'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!newAddress.trim()}
                  className="h-11 shrink-0 rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  Add
                </button>
              </div>
              <p id="add-address-error" role={addressError ? 'alert' : undefined} className="min-h-5 pt-1 text-sm text-red-700">{addressError}</p>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <HiOutlinePlus aria-hidden="true" className="h-4 w-4" />
              Add another agent
            </button>
          )}
        </div>
      </div>
    </ChatLayout>
  )
}
