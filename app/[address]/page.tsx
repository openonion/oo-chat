'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { HiChevronDown, HiChevronUp } from 'react-icons/hi2'
import { ChatInput, ModeStatusBar } from '@/components/chat'
import type { ApprovalMode } from '@/components/chat/types'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress } from '@/hooks/use-agent-info'

const SUGGESTIONS = [
  'What can you do?',
  'Show system info',
  'List files in current directory',
]

const COLLAPSED_COUNT = 5

export default function AgentLandingPage() {
  const params = useParams()
  const router = useRouter()
  const address = params.address as string

  const {
    agents,
    addAgent,
    createConversation,
    setPendingMessage,
    clearActive,
    userProfile,
  } = useChatStore()

  useIdentity()

  const [mode, setMode] = useState<ApprovalMode>('safe')
  const [pendingUlwTurns, setPendingUlwTurns] = useState<number | null>(null)
  const [skillsExpanded, setSkillsExpanded] = useState(false)

  const handleModeChange = useCallback((newMode: ApprovalMode, options?: { turns?: number }) => {
    setMode(newMode)
    if (newMode === 'ulw' && options?.turns) {
      setPendingUlwTurns(options.turns)
    } else {
      setPendingUlwTurns(null)
    }
  }, [])

  useEffect(() => {
    if (address && !agents.includes(address)) {
      addAgent(address)
    }
  }, [address, agents, addAgent])

  useEffect(() => {
    clearActive()
  }, [clearActive])

  const infoMap = useAgentInfo([address])
  const agentInfo = infoMap[address]

  const handleSend = useCallback((content: string, _images?: string[]) => {
    const sessionId = crypto.randomUUID()
    createConversation(sessionId, address)
    setPendingMessage(content)

    const params = new URLSearchParams()
    if (mode !== 'safe') {
      params.set('mode', mode)
      if (mode === 'ulw' && pendingUlwTurns) {
        params.set('turns', String(pendingUlwTurns))
      }
    }
    const query = params.toString()
    router.push(`/${address}/${sessionId}${query ? `?${query}` : ''}`)
  }, [address, createConversation, setPendingMessage, mode, pendingUlwTurns, router])

  const label = agentInfo?.name || shortAddress(address)
  const isOnline = agentInfo?.online
  const skills = agentInfo?.skills || []
  const tools = agentInfo?.tools || []

  const metaLine = useMemo(() => {
    const parts: string[] = []
    if (agentInfo?.model) parts.push(agentInfo.model)
    if (agentInfo?.trust) parts.push(agentInfo.trust)
    if (agentInfo?.version) parts.push(`v${agentInfo.version}`)
    return parts.join(' · ')
  }, [agentInfo?.model, agentInfo?.trust, agentInfo?.version])

  const visibleSkills = skillsExpanded ? skills : skills.slice(0, COLLAPSED_COUNT)
  const hiddenCount = skills.length - COLLAPSED_COUNT

  const toolsLine = useMemo(() => {
    if (tools.length === 0) return null
    const max = 6
    const names = tools.slice(0, max).map(t =>
      t.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
    )
    const rest = tools.length - max
    return names.join(' · ') + (rest > 0 ? ` +${rest} more` : '')
  }, [tools])

  const acceptsLine = useMemo(() => {
    const inputs = agentInfo?.accepted_inputs
    if (!inputs) return null
    const parts: string[] = []
    if (inputs.text) parts.push('text')
    if (inputs.images) parts.push('images')
    if (inputs.files) parts.push(`files (${inputs.files.max_file_size_mb}MB)`)
    return parts.length > 0 ? parts.join(' · ') : null
  }, [agentInfo?.accepted_inputs])

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Scrollable content — vertically centered so the page isn't top-heavy */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          <div className="m-auto w-full max-w-xl px-5 py-10">

            {/* Hero */}
            <div className="text-center mb-7">
              <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <span className="text-white font-semibold text-2xl">
                  {label.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2 mb-1.5">
                <h1 className="font-serif text-2xl font-semibold text-neutral-900">{label}</h1>
                {isOnline !== undefined && (
                  isOnline
                    ? <span className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-green-600">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                        </span>
                        LIVE
                      </span>
                    : <span className="text-[11px] font-mono font-medium text-neutral-400">OFFLINE</span>
                )}
              </div>

              {metaLine && (
                <p className="text-[11px] text-neutral-400 font-mono">{metaLine}</p>
              )}

              {/* Per-agent balance + top-up (one shared account balance) */}
              {userProfile && (
                <a
                  href={`https://o.openonion.ai/purchase?agent=${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
                >
                  <span className="font-mono text-neutral-400 uppercase tracking-wider">Balance</span>
                  <span className="font-semibold text-neutral-900 tabular-nums">${userProfile.balance_usd.toFixed(2)}</span>
                  <span className="text-neutral-300">·</span>
                  <span className="font-medium text-brand-600">Top up →</span>
                </a>
              )}
            </div>

            {/* Skills - slash command palette style */}
            {skills.length > 0 && (
              <div className="rounded-xl border border-neutral-200 bg-white p-1.5">
                {visibleSkills.map((skill, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend('/' + skill.name)}
                    className="flex w-full items-baseline gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-neutral-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-neutral-800 shrink-0 font-mono">/{skill.name}</span>
                    <span className="text-xs text-neutral-400 truncate">{skill.description || 'No description'}</span>
                  </button>
                ))}
                {hiddenCount > 0 && (
                  <button
                    onClick={() => setSkillsExpanded(!skillsExpanded)}
                    className="flex items-center justify-center gap-1 w-full px-3 py-2 mt-0.5 rounded-lg text-xs text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 transition-colors"
                  >
                    {skillsExpanded ? (
                      <>Show less <HiChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>+{hiddenCount} more <HiChevronDown className="w-3 h-3" /></>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Tools + Accepts */}
            {(toolsLine || acceptsLine) && (
              <div className="text-center text-[11px] space-y-0.5 mt-5 font-mono">
                {toolsLine && <p className="text-neutral-400">{toolsLine}</p>}
                {acceptsLine && <p className="text-neutral-300">{acceptsLine}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: suggestions + input (blends into the ivory canvas, no hard divider) */}
        <div className="shrink-0 bg-neutral-50 px-4 pb-4 pt-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-wrap justify-center gap-2 mb-3">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-neutral-200 bg-white/60 px-3.5 py-1.5 text-xs text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 hover:bg-white transition-all active:scale-[0.97]"
                >
                  {s}
                </button>
              ))}
            </div>
            <ChatInput
              onSend={handleSend}
              placeholder="Message this agent..."
              skills={skills}
              statusBar={
                <ModeStatusBar
                  mode={mode}
                  onModeChange={handleModeChange}
                  ulwTurnsRemaining={pendingUlwTurns}
                />
              }
            />
          </div>
        </div>
      </div>
    </>
  )
}
