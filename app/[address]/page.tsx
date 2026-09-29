'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { HiArrowRight, HiChevronDown, HiChevronUp } from 'react-icons/hi2'
import { ChatInput, ModeStatusBar, useAgentSDK } from '@/components/chat'
import { OnboardGate } from '@/components/chat/onboard-gate'
import { InvalidAddress } from '@/components/invalid-address'
import { WorkspaceShell } from '@/components/dashboard/workspace-shell'
import { DashboardPane } from '@/components/dashboard/dashboard-pane'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress, agentInitial, isAgentAddress } from '@/hooks/use-agent-info'
import { QrShare } from '@/components/qr-share'
import { UNIVERSAL_OPENER, acceptsAttachments } from '@/components/chat/skill-offers'
import { publicCapabilities } from '@/lib/agent-capabilities'
import type { FileAttachment } from '@/components/chat/types'
import { AgentAddress, TopUp } from '@/components/agent-address'


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

  const [skillsExpanded, setSkillsExpanded] = useState(false)
  const [stationCode, setStationCode] = useState('')
  const [stationError, setStationError] = useState<string | null>(null)
  const [stationPairing, setStationPairing] = useState(false)

  // Once per visit, not "whenever it is missing". Opening an agent's link is what
  // adds it, and the old form re-ran on every change to `agents` — so removing the
  // agent while standing on its own page put it straight back, while the
  // conversations and transcripts it took with it were already gone. The reader
  // saw the agent still listed and its history silently deleted, which is the
  // worst way round: the visible signal said the removal had failed.
  //
  // Keyed on the address so navigating between agents still adds each one.
  const addedFor = useRef<string | null>(null)
  useEffect(() => {
    // A malformed address must not be adopted. The URL is how a broken address
    // actually arrives — a shared link that clipped its last characters — and the
    // agent list it lands in is read by the sidebar, Settings and the picker,
    // where it is indistinguishable from a real agent that happens to be offline.
    // #108 taught the two typed entry points to refuse these; this is the third.
    if (!address || !isAgentAddress(address) || addedFor.current === address) return
    addedFor.current = address
    if (!agents.includes(address)) addAgent(address)
    // `agents` is deliberately not a dependency: reacting to it is the bug.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, addAgent])

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

  const onGateError = useCallback((message: string | null) => {
    // A cleared SDK error is useful to active chat pages but is not an invite
    // rejection. The gate owns its own success/reset lifecycle.
    if (!message || !submittingRef.current) return
    submittingRef.current = false
    setSubmitting(false)
    // The host's reason ("Invalid invite code") is already the right thing to say; the
    // SDK's "Agent error:" framing in front of it is addressed to a developer.
    setGateError(message.replace(/^Agent error:\s*/i, ''))
  }, [])

  const {
    dashboardHtml,
    profile,
    connect,
    attachProviderStation,
    clear,
    submitOnboard,
    pendingOnboard,
    mode,
    turnsLeft,
    availableModes,
    modeChangePending,
    modeChangeError,
    modeRecoveryAction,
    setSessionMode,
    retryModeChange,
  } = useAgentSDK({
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
  const isClaudeStation = profile?.provider_station === 'claude_code'


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

  // `images` used to be `_images` — accepted and dropped. Sending here does not
  // send: it stores the message and navigates to a session that sends it on
  // arrival, and the store carried only a string. So an attachment picked before
  // the conversation existed vanished on the way, after the reader had already
  // watched its thumbnail appear in the composer.
  const handleSend = useCallback((content: string, images?: string[], files?: FileAttachment[]) => {
    if (modeChangePending) return
    const sessionId = draftSessionId
    promoted.current = true
    createConversation(sessionId, address)
    setPendingMessage(content, images, files)

    router.push(`/${address}/${sessionId}`)
  }, [address, draftSessionId, createConversation, setPendingMessage, modeChangePending, router])

  const pairClaudeStation = useCallback(async () => {
    if (stationPairing) return
    setStationPairing(true)
    setStationError(null)
    try {
      const sessionId = await attachProviderStation(stationCode.trim())
      promoted.current = true
      createConversation(sessionId, address)
      router.push(`/${address}/${sessionId}`)
    } catch (error) {
      setStationError(error instanceof Error ? error.message : 'Could not connect to the Claude terminal.')
      setStationPairing(false)
    }
  }, [address, attachProviderStation, createConversation, router, stationCode, stationPairing])

  // What a suggestion chip does depends on whether the reader may talk yet. Gating only
  // the composer left the loudest button on the page — the filled "What can you do?" —
  // still routing into a session the agent was always going to refuse, which is #27
  // through another door. Behind the gate a chip asks for the code instead of spending
  // the reader's message on a turn that cannot happen.
  const gateInputRef = useRef<HTMLInputElement>(null)
  const begin = useCallback((content: string) => {
    if (needsOnboard) { gateInputRef.current?.focus(); return }
    if (isClaudeStation) return
    handleSend(content)
  }, [needsOnboard, handleSend, isClaudeStation])

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
  // Skills only from the profile frame, which arrives over the authenticated
  // socket after the host has let this reader in. The public relay profile is
  // for anyone who has the address, and on 2026-09-29 it showed our internal
  // agents' skills to visitors who had not passed the invite gate (#263). A
  // visitor sees the card: name, status, address.
  const skills = profile?.skills || []
  const capabilities = publicCapabilities(skills)

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
          {/* justify-center-safe, not justify-center: centring a column that is taller
              than its scroll container pushes the overflow off both ends, and the top
              half is unreachable because scrollTop is already 0. Expanding the skills
              and tools list is enough to trigger it, and what disappears is the avatar,
              the agent name and the online pill — the identity of the agent you are
              about to talk to. Safe alignment falls back to flex-start on overflow. */}
          <div className="flex min-h-full flex-col py-5 sm:py-9">
          <div className="mx-auto w-full max-w-2xl px-5">

            {/* Identity header: one row, so the name is the largest thing on the page.
                It used to stack avatar, name and balance as three rows of their own, and a
                44px tile holding one letter outweighed a two-letter name like "oo" — the
                first thing the eye found was an empty lavender square. Status sits under
                the name as its caption; the balance is operational, so it goes to the
                trailing edge rather than claiming a row between identity and the tasks. */}
            <header className="mb-8 sm:mb-10">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-identity-50 ring-1 ring-identity-100" aria-hidden="true">
                  <span className="text-identity-800 font-semibold text-lg">
                    {agentInitial(label, address)}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  {/* Keep the agent identity in the same type system as the active chat. */}
                  <h1 className={`truncate text-3xl font-semibold leading-tight tracking-tight text-neutral-900 ${label === shortAddress(address) ? 'font-mono text-2xl' : ''}`}>{label}</h1>
                  <div className="mt-1 flex items-center text-sm">
                    {agentInfo === undefined ? (
                      <span className="flex items-center gap-1.5 text-neutral-600">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-300" />
                        Connecting
                      </span>
                    ) : isOnline !== undefined && (
                      isOnline
                        ? <span className="flex items-center gap-1.5 text-green-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                            Online
                          </span>
                        : <span className="flex items-center gap-1.5 text-neutral-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                            Offline
                          </span>
                    )}
                  </div>
                </div>

                {isOnline === true && typeof agentInfo?.balance_usd === 'number' && (
                  <div className="shrink-0">
                    <TopUp address={address} balanceUsd={agentInfo.balance_usd} />
                  </div>
                )}
              </div>

              {isOnline === false && (
                <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-600">
                  This Agent Host is not connected. If it is yours, run <code className="rounded bg-neutral-100 px-1 font-mono text-xs text-neutral-800">co ai</code> in its project or deploy it. If someone shared this agent, ask its owner to bring it online. You can send a message once it reconnects.
                </p>
              )}
            </header>

            {!needsOnboard && isClaudeStation && (
              <form onSubmit={(event) => { event.preventDefault(); void pairClaudeStation() }}
                className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Claude Code Work Room</p>
                <h2 className="mb-2 text-xl font-semibold text-neutral-900">Connect your terminal session</h2>
                <p className="mb-6 text-sm leading-6 text-neutral-600">
                  Enter the pairing code shown by <span className="font-mono text-neutral-800">co claude</span> to watch this session and take control from the browser.
                </p>
                <label htmlFor="claude-station-code" className="mb-2 block text-sm font-medium text-neutral-800">Pairing code</label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input id="claude-station-code" type="text" autoComplete="off" value={stationCode}
                    onChange={(event) => setStationCode(event.target.value)} placeholder="Paste code from your terminal"
                    aria-label="Connect to this Claude terminal"
                    className="min-h-12 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10" />
                  <button type="submit" disabled={!stationCode.trim() || stationPairing}
                    className="min-h-12 rounded-lg bg-neutral-900 px-5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-50">
                    {stationPairing ? 'Connecting…' : 'Open Work Room'}
                  </button>
                </div>
                {stationError && <p role="alert" className="mt-3 text-sm text-red-700">{stationError}</p>}
              </form>
            )}

            {/* Folded by default (owner, 2026-09-29): the page opens on who the agent is,
                not on what it can do. Only a reader the host has let in gets a list. */}
            {!isClaudeStation && capabilities.length > 0 && (
              <section aria-labelledby="agent-capabilities-heading">
                <button
                  type="button"
                  aria-expanded={skillsExpanded}
                  aria-controls="agent-capabilities-list"
                  onClick={() => setSkillsExpanded(!skillsExpanded)}
                  className="mb-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg text-left"
                >
                  <h2 id="agent-capabilities-heading" className="text-base font-semibold text-neutral-900">
                    What this agent can do <span className="font-normal text-neutral-500">({capabilities.length})</span>
                  </h2>
                  {skillsExpanded ? <HiChevronUp aria-hidden="true" className="h-4 w-4 text-neutral-500" /> : <HiChevronDown aria-hidden="true" className="h-4 w-4 text-neutral-500" />}
                </button>
                {skillsExpanded && (
                  // One list, not a stack of cards. Each task was its own bordered card with
                  // a violet "Use task →", so three tasks put three equal calls to action
                  // beside three equal titles and nothing led. The rows share one surface;
                  // the whole row is the action and the arrow only confirms it on hover.
                  <ul id="agent-capabilities-list" className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
                    {capabilities.map((capability, i) => (
                      <li key={capability.name}>
                        <button
                          type="button"
                          disabled={isOnline === false}
                          onClick={() => begin('/' + capability.name)}
                          className={`group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white ${i === 0 ? 'rounded-t-xl' : ''} ${i === capabilities.length - 1 ? 'rounded-b-xl' : ''}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-medium text-neutral-900">{capability.title}</span>
                            <span className="mt-0.5 line-clamp-2 block text-sm leading-5 text-neutral-600">{capability.summary}</span>
                          </span>
                          {isOnline !== false && <HiArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-400 transition-colors group-hover:text-identity-700 group-focus-visible:text-identity-700" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* The open-ended ask is the alternative to the tasks above, so it sits with
                them. Below the address and inventory it read as a footnote. */}
            {!isClaudeStation && isOnline !== false && (
              <button onClick={() => begin(UNIVERSAL_OPENER)} className="mt-3 min-h-11 text-sm font-medium text-identity-700 underline-offset-4 hover:underline">
                Or ask: {UNIVERSAL_OPENER}
              </button>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-200 pt-4 text-xs text-neutral-600">
              <span>Agent details</span>
              <AgentAddress address={address} />
              <QrShare address={address} />
              {metaLine && <span className="basis-full text-xs text-neutral-600 sm:basis-auto">{metaLine}</span>}
            </div>

          </div>
          </div>
        </div>

        {/* Bottom: suggestions + input (blends into the ivory canvas, no hard divider).
            Gone entirely behind the gate — an empty rail would keep the column pinned to
            the top of a tall flex child, which is where the dead band came from. */}
        {!needsOnboard && !isClaudeStation && (
          <div className="shrink-0 bg-neutral-50 pt-1">
            <div className="max-w-2xl mx-auto">
              <ChatInput
                onSend={handleSend}
                // The directory has authoritatively marked this Host offline.
                // Avoid routing a first message into a session that cannot answer;
                // its verified invite Gate will arrive after Host reconnect.
                disabled={modeChangePending || isOnline === false}
                disabledPlaceholder={isOnline === false ? 'Agent offline — reconnect to send a message' : undefined}
                placeholder="Message this agent..."
                skills={skills}
                acceptsAttachments={acceptsAttachments(agentInfo?.accepted_inputs)}
                statusBar={
                  <ModeStatusBar
                    mode={mode}
                    turnsLeft={turnsLeft}
                    availableModes={availableModes}
                    onModeChange={(nextMode) => void setSessionMode(nextMode)}
                    modeChangePending={modeChangePending}
                    modeChangeError={modeChangeError}
                    modeRecoveryAction={modeRecoveryAction}
                    onModeRetry={retryModeChange}
                  />
                }
              />
            </div>
          </div>
        )}
      </div>
  )

  // Before anything else: a link whose address is not an address.
  if (!isAgentAddress(address)) return <InvalidAddress address={address} />

  return (
    <>
      {/* A pending gate outranks the Home default. The gate lives inside the chat
          pane, so a phone opening on Home hid the only route past ONBOARD_REQUIRED:
          the visitor got a dashboard whose buttons do nothing, with no error and no
          prompt. chosenView still lets them switch back. */}
      <WorkspaceShell
        defaultMobileView={needsOnboard ? 'chat' : 'home'}
        hasDashboard={dashboardHtml !== null}
        chat={landingContent}
        dashboard={
          <DashboardPane
            html={dashboardHtml}
            skills={skills}
            onRunSkill={runSkill}
            className="block h-full w-full min-w-0 max-w-full border-0"
          />
        }
      />

      {/* A sibling of the whole workspace, not a child of the column it used to sit in.
          `position: fixed` is relative to the nearest transformed ancestor rather than
          the viewport, so nested there the overlay covered only its own corner and `z-50`
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
