'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlinePlus, HiOutlineStatusOnline, HiOutlineStatusOffline } from 'react-icons/hi'
import { ChatLayout } from '@/components/chat-layout'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress, agentInitial } from '@/hooks/use-agent-info'

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
    if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
      setAddressError('Enter a valid agent address (0x + 64 hex characters)')
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
          <img
            src="https://raw.githubusercontent.com/wu-changxing/openonion-assets/master/imgs/Onion.png"
            alt="OpenOnion"
            width={64}
            height={64}
            className="mb-6 rounded-2xl shadow-xl shadow-neutral-200"
          />

          <h1 className="mb-2 font-serif text-3xl font-semibold tracking-tight text-neutral-900">
            Welcome to oo-chat
          </h1>
          <p className="mb-8 max-w-md text-center text-neutral-500">
            Connect to an AI agent to start chatting
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddAgent(newAddress)
            }}
            className="w-full max-w-md space-y-3"
          >
            <input
              type="text"
              value={newAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Paste agent address (0x...)"
              autoFocus
              aria-invalid={!!addressError}
              aria-describedby={addressError ? 'address-error' : undefined}
              className={`w-full px-4 py-3 rounded-xl bg-neutral-50 border text-neutral-900 focus:bg-white focus:ring-4 outline-none font-mono text-sm transition-all placeholder:text-neutral-400 ${
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
              className="w-full px-4 py-3 bg-neutral-900 text-white text-sm font-bold rounded-xl hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200 active:scale-[0.99] disabled:bg-neutral-100 disabled:text-neutral-400 disabled:shadow-none disabled:cursor-not-allowed"
            >
              Connect
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
        <img
          src="https://raw.githubusercontent.com/wu-changxing/openonion-assets/master/imgs/Onion.png"
          alt="OpenOnion"
          width={64}
          height={64}
          className="mb-6 rounded-2xl shadow-xl shadow-neutral-200"
        />

        <h1 className="mb-2 font-serif text-3xl font-semibold tracking-tight text-neutral-900">
          Choose an agent
        </h1>
        <p className="mb-8 text-neutral-500">
          Select an agent to start a new conversation
        </p>

        {/* Agent Grid */}
        <div className="w-full max-w-lg space-y-2 mb-6">
          {agents.map(address => {
            const info = infoMap[address]
            const label = info?.name || shortAddress(address)
            return (
              <button
                key={address}
                onClick={() => router.push(`/${address}`)}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-md transition-all text-left group"
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
                        ? <HiOutlineStatusOnline className="w-4 h-4 text-green-500" />
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
