'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlineArrowRight, HiOutlinePlus, HiOutlineStatusOnline, HiOutlineStatusOffline } from 'react-icons/hi'
import { ChatLayout } from '@/components/chat-layout'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress, agentInitial, isAgentAddress, ADDRESS_ERROR } from '@/hooks/use-agent-info'

export default function Home() {
  const router = useRouter()
  const { agents, addAgent } = useChatStore()
  const infoMap = useAgentInfo(agents)
  const [newAddress, setNewAddress] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addressError, setAddressError] = useState('')

  const handleAddressChange = (value: string) => {
    setNewAddress(value)
    setAddressError('')
  }

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

  // No agents - show welcome + add form
  if (agents.length === 0) {
    return (
      <ChatLayout>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Image
            src="/onion.png"
            alt="OpenOnion"
            width={56}
            height={56}
            className="reveal mb-8 rounded-2xl shadow-xl shadow-neutral-200"
          />

          <h1 className="reveal mb-3 text-center font-serif text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
            Find an agent to talk to.
          </h1>
          <p className="reveal mb-8 max-w-md text-center text-base leading-6 text-neutral-600" style={{ '--reveal-delay': '160ms' } as React.CSSProperties}>
            Explore agents that are online now, or open one using an address someone shared with you.
          </p>

          <Link
            href="/explore"
            className="reveal mb-7 flex min-h-12 w-full max-w-md items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            style={{ '--reveal-delay': '220ms' } as React.CSSProperties}
          >
            Explore online agents <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddAgent(newAddress)
            }}
            className="reveal w-full max-w-md space-y-3"
            style={{ '--reveal-delay': '260ms' } as React.CSSProperties}
          >
            <label htmlFor="first-agent-address" className="block text-sm font-medium text-neutral-800">Have an agent address?</label>
            <input
              id="first-agent-address"
              type="text"
              value={newAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Paste agent address (0x...)"
              autoFocus
              aria-invalid={!!addressError}
              aria-describedby={addressError ? 'address-error' : undefined}
              className={`w-full rounded-lg border bg-white px-4 py-3.5 font-mono text-sm text-neutral-900 shadow-sm outline-none transition-all placeholder:text-neutral-500 focus:ring-4 ${
                addressError
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-50'
                  : 'border-neutral-200 focus:border-neutral-400 focus:ring-neutral-100'
              }`}
            />
            {addressError && <p id="address-error" role="alert" className="text-sm text-red-700">{addressError}</p>}
            <button
              type="submit"
              disabled={!newAddress.trim()}
              className="min-h-12 w-full rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
            >
              View agent
            </button>

          </form>
        </div>
      </ChatLayout>
    )
  }

  // Has agents - show agent picker
  return (
    <ChatLayout>
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <Image
          src="/onion.png"
          alt="OpenOnion"
          width={56}
          height={56}
          className="reveal mb-8 rounded-2xl shadow-xl shadow-neutral-200"
        />

        <h1 className="reveal mb-3 font-serif text-4xl font-semibold tracking-tight text-neutral-900" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          Your agents
        </h1>
        <p className="reveal mb-10 text-neutral-500" style={{ '--reveal-delay': '160ms' } as React.CSSProperties}>
          Choose an agent to start a conversation
        </p>

        {/* Agent Grid */}
        <div className="w-full max-w-lg space-y-2 mb-6">
          {agents.map((address, i) => {
            const info = infoMap[address]
            const label = info?.name || shortAddress(address)
            return (
              <button
                key={address}
                onClick={() => router.push(`/${address}`)}
                className="reveal w-full flex items-center gap-4 p-4 rounded-xl bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995] transition-all text-left group"
                style={{ '--reveal-delay': `${240 + i * 70}ms` } as React.CSSProperties}
              >
                <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <span className="text-white font-bold text-lg">
                    {agentInitial(label, address)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-neutral-900 ${label === shortAddress(address) ? 'font-mono' : ''}`}>{label}</span>
                    {info?.online !== undefined && (
                      info.online
                        ? <HiOutlineStatusOnline className="w-4 h-4 text-brand-500" />
                        : <HiOutlineStatusOffline className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                  {label !== shortAddress(address) && (
                    <span className="text-xs text-neutral-500 font-mono">{shortAddress(address)}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Add Agent */}
        {showAddForm ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddAgent(newAddress)
            }}
            className="w-full max-w-lg space-y-2"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={newAddress}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="0x..."
                autoFocus
                aria-invalid={!!addressError}
                aria-describedby={addressError ? 'add-address-error' : undefined}
                className={`min-w-0 flex-1 rounded-lg border bg-white px-4 py-3 font-mono text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-500 ${
                  addressError ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-400'
                }`}
              />
              <button
                type="submit"
                disabled={!newAddress.trim()}
                className="min-h-11 rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
              >
                Add
              </button>
            </div>
            {addressError && <p id="add-address-error" role="alert" className="text-sm text-red-700">{addressError}</p>}
            <button type="button" onClick={() => { setShowAddForm(false); setNewAddress(''); setAddressError('') }} className="min-h-10 rounded-lg px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900">
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href="/explore" className="flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-100">
              Explore agents <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            >
              <HiOutlinePlus className="h-4 w-4" />
              Add by address
            </button>
          </div>
        )}
      </div>
    </ChatLayout>
  )
}
