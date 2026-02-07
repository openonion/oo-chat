'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiOutlineRefresh,
  HiOutlineKey,
  HiOutlineArrowLeft,
  HiOutlineClipboardCopy,
  HiOutlineCheck,
  HiOutlineShieldCheck,
  HiOutlineCreditCard,
  HiOutlineServer,
  HiOutlineUserCircle
} from 'react-icons/hi'
import { ChatLayout } from '@/components/chat-layout'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'

export default function SettingsPage() {
  const router = useRouter()
  const {
    defaultAgentUrl,
    defaultAgentAddress,
    openonionApiKey,
    userProfile,
    setDefaults,
  } = useChatStore()

  const [agentUrl, setAgentUrl] = useState(defaultAgentUrl)
  const [agentAddress, setAgentAddress] = useState(defaultAgentAddress)

  const {
    identity,
    authLoading,
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

  const handleImportKey = useCallback(() => {
    if (importKey(importKeyInput)) {
      setShowImportKey(false)
      setImportKeyInput('')
    }
  }, [importKeyInput, importKey])

  const handleSaveSettings = useCallback(() => {
    setDefaults(agentUrl, agentAddress)
    router.push('/')
  }, [agentUrl, agentAddress, setDefaults, router])

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <ChatLayout>
      <div className="flex-1 overflow-y-auto bg-neutral-50/30">
        <header className="sticky top-0 z-20 bg-white/70 backdrop-blur-xl border-b border-neutral-200/50">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-5">
              <button
                onClick={() => router.push('/')}
                className="p-2 -ml-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100/80 rounded-full transition-all duration-300 active:scale-90"
                aria-label="Back to chat"
              >
                <HiOutlineArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Settings</h1>
            </div>
            <button
              onClick={handleSaveSettings}
              className="px-5 py-2.5 bg-neutral-900 text-white text-sm font-bold rounded-xl hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200 active:scale-95"
            >
              Save Changes
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">
          {/* Account Profile Section */}
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 mb-6 px-1">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <HiOutlineUserCircle className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Account</h2>
                <p className="text-xs text-neutral-500 font-medium">Manage your identity and credits</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Balance Card - Premium Display */}
              <div className="md:col-span-1 bg-neutral-900 rounded-3xl p-8 text-white shadow-2xl shadow-indigo-100 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/20 transition-all duration-700" />
                
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                      <HiOutlineCreditCard className="w-4 h-4" />
                      Balance
                    </span>
                    {authLoading && (
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-ping" />
                    )}
                  </div>

                  {authError ? (
                    <div className="text-red-300 text-xs bg-red-900/30 px-3 py-2 rounded-xl border border-red-800/50">
                      {authError}
                    </div>
                  ) : userProfile ? (
                    <div className="space-y-1">
                      <div className="text-4xl font-black tracking-tighter">
                        ${userProfile.balance_usd.toFixed(4)}
                      </div>
                      <div className="text-[10px] text-indigo-300/60 font-medium uppercase tracking-wider">Available Credits</div>
                    </div>
                  ) : (
                    <div className="text-neutral-500 text-sm font-medium italic">Syncing...</div>
                  )}
                </div>

                <div className="mt-8">
                  {userProfile && (
                    <div className="flex items-center gap-6 py-4 border-t border-white/10 text-[11px] text-white/50 font-bold uppercase tracking-wider">
                      <div className="flex flex-col gap-1">
                        <span className="text-white/30">Purchased</span>
                        <span className="text-white">${userProfile.credits_usd.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-white/30">Spent</span>
                        <span className="text-white">${userProfile.total_cost_usd.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  <a
                    href="https://discord.gg/4xfD9k8AUF"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 block w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-center text-xs font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-900/20"
                  >
                    Top up on Discord
                  </a>
                </div>
              </div>

              {/* Identity Details Card */}
              <div className="md:col-span-2 bg-white rounded-3xl p-8 border border-neutral-200/60 shadow-sm space-y-8">
                {identity ? (
                  <>
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">
                          Wallet Address
                        </label>
                        <div className="group relative">
                          <div className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl text-xs font-mono text-neutral-600 break-all leading-relaxed pr-12 transition-all hover:bg-white hover:border-neutral-200">
                            {identity.address}
                          </div>
                          <button
                            onClick={() => copyToClipboard(identity.address, 'address')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Copy Address"
                          >
                            {copiedField === 'address' ? <HiOutlineCheck className="w-4 h-4 text-green-600" /> : <HiOutlineClipboardCopy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">
                          API Key
                        </label>
                        <div className="group relative">
                          <div className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl text-xs font-mono text-neutral-600 break-all leading-relaxed pr-12 transition-all hover:bg-white hover:border-neutral-200">
                            {openonionApiKey ? openonionApiKey : 'Not authenticated'}
                          </div>
                          {openonionApiKey && (
                            <button
                              onClick={() => copyToClipboard(openonionApiKey, 'apikey')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                              title="Copy API Key"
                            >
                              {copiedField === 'apikey' ? <HiOutlineCheck className="w-4 h-4 text-green-600" /> : <HiOutlineClipboardCopy className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-4">
                      <button
                        onClick={exportKey}
                        className="flex items-center gap-2 px-5 py-2.5 bg-neutral-50 hover:bg-white border border-neutral-100 hover:border-neutral-200 text-neutral-700 text-xs font-bold rounded-xl transition-all active:scale-95"
                      >
                        <HiOutlineShieldCheck className="w-4 h-4 text-indigo-500" />
                        Backup Seed
                      </button>
                      <button
                        onClick={() => setShowImportKey(!showImportKey)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-neutral-50 hover:bg-white border border-neutral-100 hover:border-neutral-200 text-neutral-700 text-xs font-bold rounded-xl transition-all active:scale-95"
                      >
                        <HiOutlineKey className="w-4 h-4 text-neutral-400" />
                        Import Key
                      </button>
                      <button
                        onClick={generateNewIdentity}
                        className="ml-auto flex items-center gap-2 px-5 py-2.5 text-red-500 hover:text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-all active:scale-95"
                      >
                        <HiOutlineRefresh className="w-4 h-4" />
                        Reset
                      </button>
                    </div>

                    {showImportKey && (
                      <div className="mt-4 p-5 bg-neutral-50 rounded-2xl border border-neutral-200/50 animate-in zoom-in-95 duration-200">
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 px-1">
                          Recovery Mnemonic
                        </label>
                        <textarea
                          value={importKeyInput}
                          onChange={(e) => setImportKeyInput(e.target.value)}
                          placeholder="Paste your 12-word recovery phrase..."
                          className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none font-mono text-sm min-h-[100px] resize-none transition-all"
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
                            className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-500 shadow-md shadow-indigo-200 transition-all active:scale-95"
                          >
                            Import Now
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center gap-4">
                    <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Encrypting Identity...</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Connection Settings Section */}
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex items-center gap-3 mb-6 px-1">
              <div className="p-2 bg-neutral-100 rounded-lg">
                <HiOutlineServer className="w-6 h-6 text-neutral-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Communication</h2>
                <p className="text-xs text-neutral-500 font-medium">Configure agent connectivity and security</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-200/60 shadow-sm overflow-hidden p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">
                      Target Agent URL
                    </label>
                    <input
                      type="url"
                      value={agentUrl}
                      onChange={(e) => setAgentUrl(e.target.value)}
                      placeholder="https://your-agent.agents.openonion.ai"
                      className="w-full px-4 py-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-sm font-medium transition-all"
                    />
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed px-1">
                    The core endpoint for agent interaction. Defaults to the public OpenOnion relay if left empty.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">
                      Verification Address <span className="text-neutral-300 ml-1">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={agentAddress}
                      onChange={(e) => setAgentAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-4 py-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none font-mono text-xs transition-all"
                    />
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed px-1">
                    Ensures end-to-end cryptographic trust with the remote agent. Highly recommended for production use.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Recovery Phrase Modal - Enhanced Design */}
        {showRecoveryPhrase && newMnemonic && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-neutral-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] shadow-2xl max-w-xl w-full overflow-hidden border border-neutral-200 animate-in zoom-in-95 slide-in-from-bottom-5 duration-500">
              <div className="p-10 border-b border-amber-100 bg-amber-50/30 relative">
                <div className="absolute top-0 right-0 w-48 h-48 bg-amber-200/10 rounded-full blur-3xl -mr-24 -mt-24" />
                
                <div className="relative">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mb-6">
                    <HiOutlineShieldCheck className="w-7 h-7 text-amber-600" />
                  </div>
                  <h3 className="text-2xl font-black text-amber-950 tracking-tight mb-2">
                    Secure Your Recovery Phrase
                  </h3>
                  <p className="text-sm text-amber-900/60 font-medium leading-relaxed">
                    This phrase is derived from your Ed25519 seed. Store it offline. 
                    <span className="text-amber-700 font-bold block mt-1">If lost, your identity and funds cannot be recovered.</span>
                  </p>
                </div>
              </div>

              <div className="p-10">
                <div className="grid grid-cols-3 gap-3 mb-10">
                  {newMnemonic.split(' ').map((word, i) => (
                    <div key={i} className="flex flex-col gap-1 p-3 bg-neutral-50 rounded-2xl border border-neutral-100/50 group hover:bg-indigo-50 hover:border-indigo-100 transition-all duration-300">
                      <span className="text-[10px] text-neutral-400 font-black uppercase tracking-widest">{i + 1}</span>
                      <span className="text-xs font-mono text-neutral-800 font-bold">{word}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => copyToClipboard(newMnemonic, 'mnemonic')}
                    className="flex-1 px-6 py-4 bg-white border border-neutral-200 text-neutral-800 text-sm font-bold rounded-2xl hover:bg-neutral-50 transition-all flex items-center justify-center gap-3 active:scale-95"
                  >
                    {copiedField === 'mnemonic' ? <HiOutlineCheck className="w-5 h-5 text-green-600 animate-in zoom-in" /> : <HiOutlineClipboardCopy className="w-5 h-5" />}
                    Copy Phrase
                  </button>
                  <button
                    onClick={dismissRecoveryPhrase}
                    className="flex-1 px-6 py-4 bg-neutral-900 text-white text-sm font-bold rounded-2xl hover:bg-neutral-800 transition-all shadow-xl shadow-neutral-200 flex items-center justify-center active:scale-95"
                  >
                    I&apos;ve Stored It Safely
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ChatLayout>
  )
}
