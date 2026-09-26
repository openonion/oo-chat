'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiOutlineRefresh,
  HiOutlineKey,
  HiOutlineArrowLeft,
  HiOutlineClipboardCopy,
  HiOutlineCheck,
  HiOutlineShieldCheck,
  HiOutlineServer,
  HiOutlineUserCircle,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineStatusOnline,
  HiOutlineStatusOffline,
  HiOutlineEye,
  HiOutlineEyeOff,
} from 'react-icons/hi'
import { ChatLayout } from '@/components/chat-layout'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress, isAgentAddress, ADDRESS_ERROR } from '@/hooks/use-agent-info'
import { TopUp } from '@/components/agent-address'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { orderAgents } from '@/lib/agent-order'

export default function SettingsPage() {
  const router = useRouter()
  const {
    agents,
    addAgent,
    removeAgent,
    openonionApiKey,
    conversations,
  } = useChatStore()

  const infoMap = useAgentInfo(agents)
  const recentActivity = useMemo(() => {
    const result: Record<string, number> = {}
    for (const conversation of conversations) {
      result[conversation.agentAddress] = Math.max(
        result[conversation.agentAddress] ?? 0,
        new Date(conversation.createdAt).getTime(),
      )
    }
    return result
  }, [conversations])
  const orderedAgents = useMemo(
    () => orderAgents(agents, infoMap, null, recentActivity),
    [agents, infoMap, recentActivity],
  )

  const {
    identity,
    authError,
    showRecoveryPhrase,
    newMnemonic,
    generateNewIdentity,
    importKey,
    exportKey,
    dismissRecoveryPhrase,
  } = useIdentity()

  const [showImportKey, setShowImportKey] = useState(false)
  const [importKeyInput, setImportKeyInput] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [newAgentAddress, setNewAgentAddress] = useState('')
  const [addAgentError, setAddAgentError] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const recoveryTitleRef = useRef<HTMLHeadingElement>(null)
  const recoveryCopyRef = useRef<HTMLButtonElement>(null)
  const recoveryDoneRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!showRecoveryPhrase || !newMnemonic) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    recoveryTitleRef.current?.focus({ preventScroll: true })
    return () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true })
    }
  }, [showRecoveryPhrase, newMnemonic])

  const handleImportKey = useCallback(async () => {
    if (await importKey(importKeyInput)) {
      setShowImportKey(false)
      setImportKeyInput('')
    }
  }, [importKeyInput, importKey])

  const handleAddAgent = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newAgentAddress.trim()
    if (!trimmed) return
    // The root picker has always checked this; Settings added whatever was typed,
    // so a truncated paste became a permanent entry that shows as offline forever
    // and navigates to a route that cannot resolve.
    if (!isAgentAddress(trimmed)) {
      setAddAgentError(ADDRESS_ERROR)
      return
    }
    setAddAgentError('')
    addAgent(trimmed)
    setNewAgentAddress('')
  }, [newAgentAddress, addAgent])

  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  const pendingRemoveChats = pendingRemove
    ? conversations.filter(c => c.agentAddress === pendingRemove).length
    : 0

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <ChatLayout>
      <div className="flex-1 overflow-y-auto bg-neutral-50/30">
        <header className="sticky top-0 z-20 bg-white/70 backdrop-blur-xl border-b border-neutral-200/50">
          <div className="max-w-3xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-5">
              <button
                onClick={() => router.push('/')}
                className="p-2 -ml-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100/80 rounded-full transition-all duration-300 active:scale-90"
                aria-label="Back to chat"
              >
                <HiOutlineArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Settings</h1>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto space-y-10 px-5 py-8 sm:px-6 sm:py-10">
          {/* Account Profile Section */}
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white">
                <HiOutlineUserCircle className="h-5 w-5 text-neutral-700" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Your identity</h2>
                <p className="text-sm text-neutral-600">Used to sign in and keep your chats together</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* This browser identity is not an agent — it signs you in and carries
                  the ConnectOnion protocol. Credits belong to the agents you connect
                  to (shown per agent below), so no balance is featured here. */}
              {authError && (
                <div className="text-red-700 text-xs bg-red-50 px-4 py-3 rounded-2xl border border-red-200">
                  {authError}
                </div>
              )}

              {/* Identity Details Card */}
              <div className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
                {identity ? (
                  <>
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                      <p className="text-sm font-semibold text-neutral-900">Recovery not verified</p>
                      <p className="mt-1 text-sm leading-5 text-neutral-700">
                        O Chat cannot verify a recovery backup for this identity. Clearing browser data may make this address and its chats inaccessible.
                      </p>
                    </div>
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-neutral-600">Identity address</p>
                        <div className="group relative">
                          <div className="w-full break-all rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 pr-14 font-mono text-xs leading-5 text-neutral-700">
                            {identity.address}
                          </div>
                          <button
                            onClick={() => copyToClipboard(identity.address, 'address')}
                            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                            title="Copy Address"
                          >
                            {copiedField === 'address' ? <HiOutlineCheck className="w-4 h-4 text-green-600" /> : <HiOutlineClipboardCopy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-neutral-600">API key</p>
                        <div className="group relative">
                          <div className="w-full break-all rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 pr-24 font-mono text-xs leading-5 text-neutral-700">
                            {openonionApiKey
                              ? (showApiKey ? openonionApiKey : `${openonionApiKey.slice(0, 8)}…${openonionApiKey.slice(-6)}`)
                              : 'Not authenticated'}
                          </div>
                          {openonionApiKey && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                              <button
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                                title={showApiKey ? 'Hide API Key' : 'Show API Key'}
                                aria-label={showApiKey ? 'Hide API Key' : 'Show API Key'}
                              >
                                {showApiKey ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => copyToClipboard(openonionApiKey, 'apikey')}
                                className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                                title="Copy API Key"
                                aria-label="Copy API Key"
                              >
                                {copiedField === 'apikey' ? <HiOutlineCheck className="w-4 h-4 text-green-600" /> : <HiOutlineClipboardCopy className="w-4 h-4" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-5">
                      {newMnemonic && (
                        <button
                          onClick={exportKey}
                          className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-200 px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                        >
                          <HiOutlineShieldCheck className="h-4 w-4" />
                          View recovery phrase
                        </button>
                      )}
                      <button
                        onClick={() => setShowImportKey(!showImportKey)}
                        className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-200 px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                      >
                        <HiOutlineKey className="h-4 w-4 text-neutral-600" />
                        Import recovery phrase
                      </button>
                      <button
                        onClick={generateNewIdentity}
                        className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50 sm:ml-auto"
                      >
                        <HiOutlineRefresh className="h-4 w-4" />
                        Create new identity
                      </button>
                    </div>

                    {showImportKey && (
                      <div className="mt-4 p-5 bg-neutral-50 rounded-2xl border border-neutral-200/50 animate-in zoom-in-95 duration-200">
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-3 px-1">
                          Recovery Mnemonic
                        </label>
                        <textarea
                          value={importKeyInput}
                          onChange={(e) => setImportKeyInput(e.target.value)}
                          placeholder="Paste your 12-word recovery phrase..."
                          className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-neutral-900 focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 outline-none font-mono text-sm min-h-[100px] resize-none transition-all placeholder:text-neutral-400"
                        />
                        <div className="flex justify-end gap-3 mt-4">
                          <button
                            onClick={() => { setShowImportKey(false); setImportKeyInput('') }}
                            className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-neutral-600 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleImportKey}
                            className="px-5 py-2 bg-neutral-900 text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition-all active:scale-95"
                          >
                            Import Now
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center gap-4">
                    <div className="w-8 h-8 border-4 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
                    <p className="text-sm font-bold text-neutral-500 uppercase tracking-wide">Encrypting Identity...</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Agents Section */}
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white">
                <HiOutlineServer className="h-5 w-5 text-neutral-700" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Agents</h2>
                <p className="text-sm text-neutral-600">Manage the agents you chat with</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              {/* Agent list */}
              {agents.length > 0 ? (
                <div className="divide-y divide-neutral-100">
                  {orderedAgents.map(({ address, presence }) => {
                    const info = infoMap[address]
                    return (
                      // Stacked on a phone. In one row the fixed parts — 64px of
                      // padding, three gaps, the status dot, the top-up pill and the
                      // delete button — left about 96px for the agent, so the address
                      // collapsed to "0…" and the tool chips wrapped one per line into
                      // a tall column. Side by side again from sm up.
                      <div key={address} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-8 sm:py-5 group">
                        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
                        {/* Online indicator */}
                        <div className="shrink-0">
                          {presence !== 'unknown' ? (
                            presence === 'online'
                              ? <HiOutlineStatusOnline className="w-5 h-5 text-brand-500" />
                              : <HiOutlineStatusOffline className="w-5 h-5 text-neutral-300" />
                          ) : (
                            <div className="w-5 h-5 flex items-center justify-center">
                              <div className="w-2 h-2 bg-neutral-200 rounded-full animate-pulse" />
                            </div>
                          )}
                        </div>

                        {/* Agent info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-neutral-900">
                              {info?.name || shortAddress(address)}
                            </span>
                            {info?.trust && (
                              <span className="text-[11px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full uppercase">
                                {info.trust}
                              </span>
                            )}
                            <span className="text-[11px] font-medium capitalize text-neutral-500">
                              {presence}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono text-neutral-500 truncate">
                              {address}
                            </span>
                            <button
                              onClick={() => copyToClipboard(address, `agent-${address}`)}
                              className="inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded text-neutral-300 hover:text-neutral-600 transition-colors"
                              title="Copy agent address"
                              aria-label="Copy agent address"
                            >
                              {copiedField === `agent-${address}`
                                ? <HiOutlineCheck className="w-3 h-3 text-green-600" />
                                : <HiOutlineClipboardCopy className="w-3 h-3" />
                              }
                            </button>
                          </div>
                          {info?.tools && info.tools.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {info.tools.slice(0, 5).map(tool => (
                                <span key={tool} className="text-[11px] font-medium text-neutral-500 bg-neutral-50 px-2 py-0.5 rounded-md border border-neutral-100">
                                  {tool}
                                </span>
                              ))}
                              {info.tools.length > 5 && (
                                <span className="text-[11px] font-medium text-neutral-500">
                                  +{info.tools.length - 5} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        </div>

                        {/* Balance and delete travel together: on a phone they are their
                            own row under the agent, on desktop they sit at the end of it.
                            Only co/* managed-key agents publish a balance (see AgentInfo). */}
                        <div className="flex shrink-0 items-center justify-end gap-3 sm:gap-4">
                          {typeof info?.balance_usd === 'number' && (
                            <TopUp address={address} balanceUsd={info.balance_usd} />
                          )}
                          <button
                            onClick={() => setPendingRemove(address)}
                            className="shrink-0 p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Remove agent"
                            aria-label="Remove agent"
                          >
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="px-5 py-8 text-center sm:px-8">
                  {/* A sentence with no way out. Someone reaching this screen has
                      nothing in the app yet, so it should say what to do next
                      rather than only what is absent. */}
                  <p className="text-sm text-neutral-600">No agents yet</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    Paste an agent&apos;s address below, or open a link someone shared with you.
                  </p>
                </div>
              )}

              {/* Add agent form */}
              <form onSubmit={handleAddAgent} className="flex min-w-0 items-center gap-2 border-t border-neutral-100 bg-neutral-50/50 px-5 py-5 sm:gap-3 sm:px-8">
                <HiOutlinePlus className="hidden h-5 w-5 shrink-0 text-neutral-300 sm:block" />
                <input
                  type="text"
                  aria-label="Agent address"
                  aria-invalid={!!addAgentError}
                  aria-describedby={addAgentError ? 'settings-add-agent-error' : undefined}
                  value={newAgentAddress}
                  onChange={(e) => { setNewAgentAddress(e.target.value); if (addAgentError) setAddAgentError('') }}
                  placeholder="Paste agent address (0x...)"
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-500 focus:border-neutral-700 focus:ring-2 focus:ring-neutral-200 sm:px-4"
                />
                <button
                  type="submit"
                  disabled={!newAgentAddress.trim()}
                  className="min-h-11 rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
                >
                  Add
                </button>
              </form>
              {/* Validating silently would be no better than not validating: the
                  reader pastes, presses Add, nothing appears, and nothing says
                  why. */}
              {addAgentError && (
                <p id="settings-add-agent-error" role="alert" className="px-5 pb-5 text-xs text-red-600 sm:px-8">{addAgentError}</p>
              )}
            </div>
          </section>
        </main>

        {/* Recovery Phrase Modal */}
        {showRecoveryPhrase && newMnemonic && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="recovery-phrase-title"
              onKeyDown={(event) => {
                if (event.key !== 'Tab') return
                if (event.shiftKey && (document.activeElement === recoveryTitleRef.current || document.activeElement === recoveryCopyRef.current)) {
                  event.preventDefault()
                  recoveryDoneRef.current?.focus()
                } else if (!event.shiftKey && document.activeElement === recoveryDoneRef.current) {
                  event.preventDefault()
                  recoveryCopyRef.current?.focus()
                }
              }}
              className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-5 duration-500 sm:rounded-3xl"
            >
              <div className="relative border-b border-neutral-200 bg-neutral-50 p-5 sm:p-8">
                <div className="absolute top-0 right-0 w-48 h-48 bg-neutral-200/20 rounded-full blur-3xl -mr-24 -mt-24" />

                <div className="relative">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 sm:mb-6">
                    <HiOutlineShieldCheck className="w-7 h-7 text-neutral-600" />
                  </div>
                  <h3 ref={recoveryTitleRef} tabIndex={-1} id="recovery-phrase-title" className="mb-2 font-serif text-2xl font-semibold tracking-tight text-neutral-900 focus:outline-none">
                    Secure Your Recovery Phrase
                  </h3>
                  <p className="text-sm text-neutral-600 font-medium leading-relaxed">
                    Store these words somewhere private. They are needed to restore this identity if this browser is lost.
                    <span className="text-neutral-900 font-bold block mt-1">O Chat cannot show them again after you close this window.</span>
                  </p>
                </div>
              </div>

              <div className="p-5 sm:p-8">
                <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
                  {newMnemonic.split(' ').map((word, i) => (
                    <div key={i} className="flex min-w-0 flex-col gap-1 rounded-lg border border-neutral-100 bg-neutral-50 p-2 sm:p-3">
                      <span className="text-[11px] text-neutral-500 font-medium uppercase tracking-wide">{i + 1}</span>
                      <span className="break-all font-mono text-xs font-bold text-neutral-800">{word}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    ref={recoveryCopyRef}
                    onClick={() => copyToClipboard(newMnemonic, 'mnemonic')}
                    className="flex min-h-11 flex-1 items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-50"
                  >
                    {copiedField === 'mnemonic' ? <HiOutlineCheck className="w-5 h-5 text-green-600 animate-in zoom-in" /> : <HiOutlineClipboardCopy className="w-5 h-5" />}
                    Copy Phrase
                  </button>
                  <button
                    ref={recoveryDoneRef}
                    onClick={dismissRecoveryPhrase}
                    className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-neutral-900 px-4 py-3 text-sm font-bold text-white hover:bg-neutral-800"
                  >
                    I&apos;ve Stored It Safely
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={pendingRemove !== null}
          title="Remove this agent?"
          confirmLabel="Remove"
          body={pendingRemove ? `${infoMap[pendingRemove]?.name || 'This agent'}${pendingRemoveChats > 0 ? ` and its ${pendingRemoveChats} chat${pendingRemoveChats > 1 ? 's' : ''}` : ''} will be removed. This cannot be undone.` : undefined}
          onConfirm={() => { if (pendingRemove) removeAgent(pendingRemove); setPendingRemove(null) }}
          onCancel={() => setPendingRemove(null)}
        />
      </div>
    </ChatLayout>
  )
}
