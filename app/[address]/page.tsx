'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { HiChevronDown, HiChevronUp } from 'react-icons/hi2'
import { ChatInput, ModeStatusBar, useAgentSDK } from '@/components/chat'
import { OnboardGate } from '@/components/chat/onboard-gate'
import { WorkspaceShell } from '@/components/dashboard/workspace-shell'
import { DashboardPane } from '@/components/dashboard/dashboard-pane'
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
  const directoryInfo = infoMap[address]

  // A draft session: warmed on the landing page so the Dashboard paints before the
  // first message, and reused as the real session once the user sends, so the
  // already-open connection carries over. Not added to the sidebar until send.
  const draftSessionId = useMemo(() => crypto.randomUUID(), [])

  // A refused code comes back as a plain ERROR frame ("Invalid invite code" — see
  // handle_onboard_submit), not as another ONBOARD_REQUIRED, so the refusal is only
  // visible on the hook's error channel. Without this the card sat unchanged whether the
  // code was wrong or the frame never left the socket.
  //
  // The ref, not the state, is what scopes it: onError also fires for unrelated failures,
  // and the callback is handed to the hook once, so a state value read inside it would be
  // the one captured at that render and never the current one.
  const [submitting, setSubmitting] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)
  const submittingRef = useRef(false)

  const onGateError = useCallback((message: string) => {
    if (!submittingRef.current) return
    submittingRef.current = false
    setSubmitting(false)
    // The host's reason ("Invalid invite code") is already the right thing to say; the
    // SDK's "Agent error:" framing in front of it is addressed to a developer.
    setGateError(message.replace(/^Agent error:\s*/i, ''))
  }, [])

  const { dashboardHtml, profile, connect, clear, submitOnboard, pendingOnboard } = useAgentSDK({
    agentAddress: address, sessionId: draftSessionId, onError: onGateError,
  })

  // NOTE: getting the code wrong once and then right is currently broken, and the
  // cause is not here. remote-agent.ts runs `_closeWs()` on every ERROR frame, and a
  // refused invite code is an ERROR frame — so the socket the host deliberately keeps
  // open for a retry ("a failed one keeps it so a retry on the same socket can still
  // complete the interrupted CONNECT", session.py) is closed by this side, and the
  // second submit sits on "Checking…" forever. Reconnecting from here was tried and
  // is worse: `reconnect` is a fresh function every render, so an effect that depends
  // on it reconnects in a loop until the tab dies. It belongs in the SDK.

  // Two answers to "what is this agent", and the difference is the point: the relay
  // directory is public and lists the published skill subset, while `profile` arrives over
  // the authenticated socket and holds everything. Layer, don't replace — the frame is
  // authoritative only for the fields it sends (name, model, tools, skills, balance), and
  // trust / version / accepted_inputs come from the directory alone. Replacing here would
  // silently drop accepted_inputs and disable image upload.
  //
  // Before the frame lands — and for a visitor who never passes the trust gate — the public
  // view is not a placeholder for the real list, it IS the answer they are entitled to.
  const agentInfo = useMemo(
    () => (profile ? { ...directoryInfo, ...profile } : directoryInfo),
    [directoryInfo, profile]
  )

  // Whether to ask for a code instead of offering a composer the reader may not use.
  //
  // The host answers this itself, per caller: CONNECT carries an Ed25519 signature, so
  // by the time it decides it knows *who is asking*, and it replies ONBOARD_REQUIRED
  // only to someone the trust config would actually turn away. An admin, a contact, or
  // anyone who onboarded earlier gets CONNECTED and never sees a gate — which no
  // client-side rule could get right, because `/info` is anonymous and says the same
  // thing to everyone.
  //
  // It arrives before the reader types: the socket is opened eagerly below for the
  // dashboard snapshot, and the gate interrupts that same CONNECT.
  const needsOnboard = Boolean(pendingOnboard)


  // Set when the draft becomes a real conversation, so unmount-on-navigate keeps the
  // warmed connection the session page is about to re-acquire.
  const promoted = useRef(false)

  const connected = useRef(false)
  useEffect(() => {
    if (connected.current) return
    connected.current = true
    connect()  // eager: open the socket to receive the on-connect DASHBOARD_SNAPSHOT
  }, [connect])

  // Latest-ref so the cleanup below can be unmount-only: `clear` is a fresh closure
  // per render, and in a dep array it would tear down the draft on every render.
  const clearRef = useRef(clear)
  useEffect(() => { clearRef.current = clear })

  useEffect(() => () => {
    // An abandoned draft (viewed, never sent) otherwise leaks its open WebSocket into
    // the SDK's module-level agent cache and keeps a persisted session key — and those
    // count against the SDK's 20-session cap, so browsing agents evicts real transcripts.
    if (!promoted.current) clearRef.current()
  }, [])

  const handleSend = useCallback((content: string, _images?: string[]) => {
    const sessionId = draftSessionId
    promoted.current = true
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
  }, [address, draftSessionId, createConversation, setPendingMessage, mode, pendingUlwTurns, router])

  // What a suggestion chip does depends on whether the reader may talk yet. Gating only
  // the composer left the loudest button on the page — the filled "What can you do?" —
  // still routing into a session the agent was always going to refuse, which is #27
  // through another door. Behind the gate a chip asks for the code instead of spending
  // the reader's message on a turn that cannot happen.
  const gateInputRef = useRef<HTMLInputElement>(null)
  const begin = useCallback((content: string) => {
    if (needsOnboard) { gateInputRef.current?.focus(); return }
    handleSend(content)
  }, [needsOnboard, handleSend])

  // Whether this reader arrived at a gate, remembered after the gate is gone.
  //
  // defaultMobileView="home" is about arriving, not about every later change, and
  // passing the gate is a later change that looks exactly like arriving: the code is
  // accepted, dashboardHtml arrives for the first time, hasDashboard flips true, and
  // WorkspaceShell's derived view moves a phone off the chat and onto Home — one
  // frame after the reader pressed Continue. Landing somewhere you did not ask to go,
  // immediately after acting, reads as "my code did something strange".


  // Stable, so the pane's message listener isn't torn down and re-added every render.
  const runSkill = useCallback(
    (skill: string, args?: string) => handleSend(`/${skill}${args ? ` ${args}` : ''}`),
    [handleSend]
  )

  const label = agentInfo?.name || shortAddress(address)
  const isOnline = agentInfo?.online
  const skills = agentInfo?.skills || []
  const tools = useMemo(() => agentInfo?.tools || [], [agentInfo?.tools])

  // Read the three fields out first. Reaching through `agentInfo` inside the memo
  // makes React Compiler infer `agentInfo` as the dependency while the list names
  // three properties, and that mismatch makes it skip optimising this component
  // entirely rather than just this memo.
  const model = agentInfo?.model
  const trust = agentInfo?.trust
  const version = agentInfo?.version

  const metaLine = useMemo(() => {
    const parts: string[] = []
    if (model) parts.push(model)
    if (trust) parts.push(trust)
    if (version) parts.push(`v${version}`)
    return parts.join(' · ')
  }, [model, trust, version])

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

  const landingContent = (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Scrollable content, centered when it fits and scrollable when it does not.
            `m-auto` did the centering before, and auto margins inside an
            overflow container swallow the overflow: on a 360px phone the
            "5 skills · 24 tools" row was sliced through the glyphs and could not
            be scrolled to at all. min-h-full + justify-center centers the same way
            without eating anything.

            py-6 under sm, because the old flat py-10 was part of the 150px of dead
            air that made this screen feel tight at the top and hollow in the middle. */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="flex min-h-full flex-col justify-center py-6 sm:py-10">
          <div className="mx-auto w-full max-w-xl px-5">

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
                  onClick={() => begin('What can you do?')}
                  className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-neutral-800 active:translate-y-0"
                >
                  What can you do?
                </button>
                {bestOffers(skills).map(({ skill, offer }) => (
                    <button
                      key={skill.name}
                      onClick={() => begin('/' + skill.name)}
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
                            onClick={() => begin('/' + skill.name)}
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
        </div>

        {/* Bottom: suggestions + input (blends into the ivory canvas, no hard divider).
            Gone entirely behind the gate — an empty rail would keep the column pinned to
            the top of a tall flex child, which is where the dead band came from. */}
        {!needsOnboard && (
          <div className="shrink-0 bg-neutral-50 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
        )}
      </div>
  )

  return (
    <>
      <WorkspaceShell
        defaultMobileView="home"
        hasDashboard={dashboardHtml !== null}
        chat={landingContent}
        dashboard={
          <DashboardPane
            html={dashboardHtml}
            skills={skills}
            onRunSkill={runSkill}
            className="w-full h-full border-0"
          />
        }
      />

      {/* A sibling of the whole workspace, not a child of the column it used to sit in.
          `position: fixed` is relative to the nearest transformed ancestor rather than
          the viewport, and the landing column's `.reveal` animates a transform — so
          nested there, the overlay covered only its own corner of the page and `z-50`
          applied inside a stacking context that the page's own buttons sat above.
          Playwright found it by failing to click Continue: an element behind the wall
          was intercepting the pointer.

          It used to be an inline card, "deliberately not a modal" on the grounds that a
          shared link should not open with a wall. That held until it was measured on a
          phone: header and avatar ≈ 240px, three rows of chips ≈ 190px, and the card
          began near y≈470 of a ~600px viewport, under a filled black button that does
          nothing while gated. Present, past the fold, and outranked. */}
      {needsOnboard && (
        <OnboardGate
          ref={gateInputRef}
          onboard={pendingOnboard!}
          agentName={label}
          isSubmitting={submitting}
          error={gateError}
          onSubmit={(options: { inviteCode?: string; payment?: number }) => {
            submittingRef.current = true
            setGateError(null)
            setSubmitting(true)
            submitOnboard(options)
          }}
        />
      )}
    </>
  )
}
