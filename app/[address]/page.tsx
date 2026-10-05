'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { HiChevronRight } from 'react-icons/hi2'
import { ChatInput, ModeStatusBar, useAgentSDK } from '@/components/chat'
import { OnboardGate } from '@/components/chat/onboard-gate'
import { InvalidAddress } from '@/components/invalid-address'
import { WorkspaceShell } from '@/components/dashboard/workspace-shell'
import { DashboardPane } from '@/components/dashboard/dashboard-pane'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress, isAgentAddress } from '@/hooks/use-agent-info'
import { acceptsAttachments } from '@/components/chat/skill-offers'
import { publicCapabilities } from '@/lib/agent-capabilities'
import type { FileAttachment } from '@/components/chat/types'


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

  // Open by default where there is room (lg and up), folded on a phone. Lazy so
  // it reads the viewport once, on the client; the list itself only exists after
  // the authenticated profile frame, so the server never renders it.
  const [skillsOpen, setSkillsOpen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  )
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
    sessionState,
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

  const draftCleanup = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    // React Strict Mode replays effects in development. Cancel the simulated
    // unmount's cleanup when this same draft immediately attaches again.
    if (draftCleanup.current !== null) {
      clearTimeout(draftCleanup.current)
      draftCleanup.current = null
    }

    return () => {
      // An abandoned draft (viewed, never sent) otherwise leaks its open WebSocket
      // into the SDK cache and consumes the bounded Host session budget. Deferring
      // one task distinguishes a real unmount from Strict Mode's immediate replay.
      draftCleanup.current = setTimeout(() => {
        draftCleanup.current = null
        if (!promoted.current) clearRef.current()
      }, 0)
    }
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
  // agents' skills to visitors who had not passed the invite gate (#263).
  const skills = profile?.skills || []
  const capabilities = publicCapabilities(skills, Infinity)
  // Hosts publish a one-line bio (connectonion#1940), but @connectonion/react does
  // not carry it on AgentInfo yet. Read it if a newer SDK passes it through;
  // until then the name stands alone rather than over a line we made up.
  const bioValue = (agentInfo as { bio?: unknown } | undefined)?.bio
  const bio = typeof bioValue === 'string' ? bioValue.trim() : ''

  const landingContent = (
      <div className="flex-1 flex flex-col min-h-0">
        {/* One focus: the composer. Above it, quiet text only — the agent's name
            in the page's one serif line, its bio, and its skills folded under a
            label. The avatar row, "What this agent can do", the details row and
            the "Or ask" link each explained something the page already showed. */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="mx-auto w-full max-w-[720px] px-5 pt-9 pb-4 sm:px-6 lg:pt-14">
            <h1 className={`font-serif text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-neutral-900 break-words ${label === shortAddress(address) ? 'font-mono text-2xl tracking-normal' : ''}`}>
              {label}
            </h1>
            {bio && <p className="mt-2 max-w-[52ch] text-[15px] text-neutral-600">{bio}</p>}
            {agentInfo === undefined && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-neutral-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-300" />
                Connecting
              </p>
            )}
            {isOnline === false && (
              <p className="mt-2 max-w-[52ch] text-[15px] text-neutral-600">
                This Agent Host is not connected. If it is yours, run <code className="rounded bg-neutral-100 px-1 font-mono text-[13px] text-neutral-800">co ai</code> in its project.
              </p>
            )}

            {!needsOnboard && isClaudeStation && (
              <form onSubmit={(event) => { event.preventDefault(); void pairClaudeStation() }}
                className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="mb-1 text-base font-semibold text-neutral-900">Connect your terminal session</h2>
                <p className="mb-5 text-sm leading-6 text-neutral-600">
                  Enter the pairing code shown by <span className="font-mono text-neutral-800">co claude</span>.
                </p>
                <label htmlFor="claude-station-code" className="sr-only">Pairing code</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input id="claude-station-code" type="text" autoComplete="off" value={stationCode}
                    onChange={(event) => setStationCode(event.target.value)} placeholder="Paste code from your terminal"
                    aria-label="Connect to this Claude terminal"
                    className="min-h-12 min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 font-mono text-sm outline-none focus:border-primary focus:ring-[3px] focus:ring-tint" />
                  <button type="submit" disabled={!stationCode.trim() || stationPairing}
                    className="min-h-12 rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400">
                    {stationPairing ? 'Connecting…' : 'Open Work Room'}
                  </button>
                </div>
                {stationError && <p role="alert" className="mt-3 text-sm text-red-700">{stationError}</p>}
              </form>
            )}

            {/* SKILLS, a disclosure. Open on a desktop, where there is room for it
                beside the composer; folded on a phone, where it would push the
                composer's context off the screen. The reader's toggle wins after. */}
            {!isClaudeStation && capabilities.length > 0 && (
              <details
                data-skills=""
                open={skillsOpen}
                onToggle={(event) => setSkillsOpen(event.currentTarget.open)}
                className="group/skills mt-8"
              >
                <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-600 marker:hidden [&::-webkit-details-marker]:hidden">
                  <HiChevronRight aria-hidden="true" className="h-3 w-3 text-neutral-400 transition-transform group-open/skills:rotate-90" />
                  Skills <span className="font-mono text-neutral-400">{capabilities.length}</span>
                </summary>
                <ul className="mt-1.5">
                  {capabilities.map(capability => (
                    <li key={capability.name} className="border-t border-neutral-200">
                      <button
                        type="button"
                        disabled={isOnline === false}
                        onClick={() => begin('/' + capability.name)}
                        className="group flex min-h-11 w-full items-baseline gap-3 py-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="shrink-0 font-medium text-neutral-900">{capability.title}</span>
                        <span className="min-w-0 flex-1 text-neutral-600">{capability.summary}</span>
                        {isOnline !== false && (
                          <span aria-hidden="true" className="shrink-0 text-[13px] text-neutral-400 max-lg:hidden opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Use →</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>

        {!needsOnboard && !isClaudeStation && (
          <div className="shrink-0 pt-1">
            <div className="mx-auto max-w-[768px]">
              <ChatInput
                onSend={handleSend}
                // The directory has authoritatively marked this Host offline.
                // Avoid routing a first message into a session that cannot answer;
                // its verified invite Gate will arrive after Host reconnect.
                disabled={modeChangePending || isOnline === false}
                disabledPlaceholder={isOnline === false ? 'Agent offline — reconnect to send a message' : undefined}
                placeholder="Send a message..."
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
                    sessionState={sessionState}
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

  // Behind an invite the card is the whole page. Nothing under it is usable and
  // nothing under it should be read, so it is not rendered at all.
  if (needsOnboard) {
    return (
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
    )
  }

  return (
    <WorkspaceShell
      defaultMobileView="home"
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
  )
}
