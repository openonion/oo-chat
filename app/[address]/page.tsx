'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { HiChevronDown, HiChevronUp } from 'react-icons/hi2'
import { ChatInput, ModeStatusBar } from '@/components/chat'
import type { ApprovalMode } from '@/components/chat/types'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress, agentInitial } from '@/hooks/use-agent-info'
import { QrShare } from '@/components/qr-share'

/** A chip is a speech act — it must complete "Help me ___". Extract a short
 *  imperative from the skill description's opening (cutting at the first
 *  clause boundary), or return null so command-named skills stay off the
 *  chip row entirely rather than leaking identifiers into it. */
function chipOffer(skill: { name: string; description?: string }): string | null {
  const first = (skill.description || '').split(/(?<=[.!?])\s/)[0]
  if (!first) return null
  let cut = first
  for (const b of [', ', '; ', ' — ', ' - ', ' in the ', ' through ', ' via ', ' using ', ' by ', ' from ', ' so ', ' and then ']) {
    const idx = cut.indexOf(b)
    if (idx > 0 && cut.slice(0, idx).split(' ').length >= 4) cut = cut.slice(0, idx)
  }
  cut = cut.replace(/[.!?,;:]\s*$/, '').trim()
  const words = cut.split(' ')
  // A clean offer, or no chip at all: reject over-long cuts and dangling endings
  if (cut.length > 48 || words.length < 2) return null
  if (/^(a|an|the|to|of|in|into|on|or|and|for|with|by|from)$/i.test(words[words.length - 1])) return null
  return fixBrandCase(cut)
}

function fixBrandCase(text: string): string {
  return text.replace(/linkedin/gi, 'LinkedIn').replace(/github/gi, 'GitHub').replace(/youtube/gi, 'YouTube')
}

// Chips are the agent's three BEST offers, not its three most parseable ones:
// internal/debug utilities never make the handshake row, and offers that lead
// with a payoff verb outrank ones that lead with mechanism.
const INTERNAL_SKILL = /debug|capture|not for direct|called by other skills|internal/i
const GOAL_VERB = /^(publish|post|submit|send|create|write|draft|schedule|generate|search|find|reply|engage|react|comment|log|translate|summarize|analyze|review|build|make|plan|book)\b/i

function bestOffers(skills: { name: string; description?: string }[]) {
  return skills
    .filter(s => !INTERNAL_SKILL.test(s.name) && !INTERNAL_SKILL.test(s.description || ''))
    .map(skill => ({ skill, offer: chipOffer(skill) }))
    .filter((x): x is { skill: (typeof skills)[number]; offer: string } => x.offer !== null)
    .sort((a, b) =>
      Number(!GOAL_VERB.test(a.offer)) - Number(!GOAL_VERB.test(b.offer)) ||
      a.offer.length - b.offer.length)
    .slice(0, 3)
}

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
              {/* Online agents breathe — the live connection is the product */}
              <div className={`reveal w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center mx-auto mb-4 shadow-sm ${isOnline ? 'breathe-live' : ''}`}>
                <span className="text-white font-semibold text-2xl">
                  {agentInitial(label, address)}
                </span>
              </div>

              <div className="reveal flex items-center justify-center gap-2 mb-1.5" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
                {/* Real names get the display serif; a raw address is data → mono */}
                <h1 className={`text-2xl font-semibold text-neutral-900 ${label === shortAddress(address) ? 'font-mono text-xl' : 'font-serif'}`}>{label}</h1>
                {agentInfo === undefined ? (
                  <span className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-neutral-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-300" />
                    connecting
                  </span>
                ) : isOnline !== undefined && (
                  isOnline
                    ? <span className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-green-600">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                        </span>
                        online
                      </span>
                    : <span className="text-[11px] font-mono font-medium text-neutral-500">offline</span>
                )}
              </div>

              {metaLine && (
                <p className="text-[11px] text-neutral-500 font-mono">{metaLine}</p>
              )}

              {isOnline === false && (
                <p className="mt-2 text-xs text-neutral-500">
                  This agent is offline — messages may not be delivered.
                </p>
              )}

              {/* Balance lives in Settings now (it's the connected agent's balance,
                  not this browser identity's) — the header only offers sharing. */}
              <div className="mt-3 flex items-center justify-center gap-2">
                <QrShare address={address} />
              </div>
            </div>

            {/* The handshake: a few things you can ask right now, in plain words */}
            {isOnline !== false && (
              <div className="reveal flex flex-wrap justify-center gap-2" style={{ '--reveal-delay': '180ms' } as React.CSSProperties}>
                {/* The universal opener leads, filled — agent-specific offers follow */}
                <button
                  onClick={() => handleSend('What can you do?')}
                  className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-neutral-800 active:translate-y-0"
                >
                  What can you do?
                </button>
                {bestOffers(skills).map(({ skill, offer }) => (
                    <button
                      key={skill.name}
                      onClick={() => handleSend('/' + skill.name)}
                      className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700 shadow-xs transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm active:translate-y-0"
                    >
                      {offer}
                    </button>
                  ))}
              </div>
            )}

            {/* Full inventory lives behind one quiet disclosure row */}
            {(skills.length > 0 || tools.length > 0) && (
              <div className="reveal mt-5" style={{ '--reveal-delay': '260ms' } as React.CSSProperties}>
                <button
                  onClick={() => setSkillsExpanded(!skillsExpanded)}
                  className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[11px] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                >
                  {[skills.length > 0 && `${skills.length} skill${skills.length > 1 ? 's' : ''}`,
                    tools.length > 0 && `${tools.length} tool${tools.length > 1 ? 's' : ''}`]
                    .filter(Boolean).join(' · ')}
                  {skillsExpanded ? <HiChevronUp className="w-3 h-3" /> : <HiChevronDown className="w-3 h-3" />}
                </button>

                {skillsExpanded && (
                  <div className="animate-in mt-2">
                    {skills.length > 0 && (
                      <div className="rounded-xl border border-neutral-200 bg-white p-1.5">
                        {skills.map((skill, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend('/' + skill.name)}
                            className="flex w-full items-baseline gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-neutral-50 transition-colors"
                          >
                            <span className="text-sm font-medium text-neutral-800 shrink-0 font-mono">/{skill.name}</span>
                            <span className="text-xs text-neutral-500 truncate">{skill.description || 'No description'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {(toolsLine || acceptsLine) && (
                      <div className="text-center text-[11px] space-y-0.5 mt-4 font-mono">
                        {toolsLine && <p className="text-neutral-500">{toolsLine}</p>}
                        {acceptsLine && <p className="text-neutral-500">{acceptsLine}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: suggestions + input (blends into the ivory canvas, no hard divider) */}
        <div className="shrink-0 bg-neutral-50 px-4 pb-4 pt-3">
          <div className="max-w-3xl mx-auto">
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
