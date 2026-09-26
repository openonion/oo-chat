'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlinePlus, HiOutlineStatusOnline, HiOutlineStatusOffline } from 'react-icons/hi'
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
        <div className="w-full flex-1 px-5 py-10 sm:px-10 sm:py-16">
          <div className="mx-auto w-full max-w-xl">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-neutral-600">
            <Image src="/onion.png" alt="" width={32} height={32} className="rounded-lg" />
            First conversation
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            Connect to an agent
          </h1>
          <p className="mt-3 max-w-md text-base leading-7 text-neutral-600">
            Enter an agent address to open its live conversation.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddAgent(newAddress)
            }}
            className="mt-8 w-full space-y-3"
          >
            <label htmlFor="agent-address" className="block text-sm font-semibold text-neutral-900">Agent address</label>
            <input
              id="agent-address"
              type="text"
              value={newAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Paste agent address (0x...)"
              autoFocus
              aria-invalid={!!addressError}
              aria-describedby={addressError ? 'address-error' : undefined}
              className={`w-full px-4 py-3.5 rounded-lg bg-white border text-neutral-900 focus:ring-2 outline-none font-mono text-sm placeholder:text-neutral-400 ${
                addressError
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-50'
                  : 'border-neutral-200 focus:border-neutral-400 focus:ring-neutral-100'
              }`}
            />
            {/* Fixed-height slot so the column doesn't jump when the error appears */}
            <p id="address-error" className="min-h-5 text-sm text-red-600">{addressError}</p>
            <button
              type="submit"
              disabled={!newAddress.trim()}
              className="min-h-12 w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              Open agent
            </button>

            {/* Newcomers without an address get a path, not a dead end */}
            <p className="pt-3 text-sm text-neutral-600">
              No agent address yet?{' '}
              <a
                href="https://discord.gg/4xfD9k8AUF"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900"
              >
                Get one in our Discord
              </a>
            </p>
          </form>
          </div>
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
          Choose an agent
        </h1>
        <p className="reveal mb-10 text-neutral-500" style={{ '--reveal-delay': '160ms' } as React.CSSProperties}>
          Select an agent to start a new conversation
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
                onBlur={() => { if (!newAddress.trim()) setShowAddForm(false) }}
                aria-invalid={!!addressError}
                aria-describedby={addressError ? 'add-address-error' : undefined}
                className={`flex-1 px-4 py-3 rounded-xl bg-neutral-50 border text-neutral-900 focus:bg-white outline-none font-mono text-sm transition-all placeholder:text-neutral-400 ${
                  addressError ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-400'
                }`}
              />
              <button
                type="submit"
                disabled={!newAddress.trim()}
                className="px-6 py-3 bg-neutral-900 text-white text-sm font-bold rounded-xl hover:bg-neutral-800 transition-all disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            {/* Fixed-height slot so the form doesn't jump when the error appears */}
            <p id="add-address-error" className="min-h-5 text-sm text-red-600">{addressError}</p>
          </form>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-all"
          >
            <HiOutlinePlus className="w-4 h-4" />
            Add another agent
          </button>
        )}
      </div>
    </ChatLayout>
  )
}
