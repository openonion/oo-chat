/**
 * @purpose Active chat session page — renders conversation UI with full agent interaction (messages, tools, approvals, modes)
 * @llm-note
 *   Dependencies: imports from [components/chat/index.ts (Chat, useAgentSDK, ModeStatusBar, PlanModeBanner, UlwModeBanner), components/chat/types.ts (UI, ApprovalMode), components/chat-layout.tsx (ChatLayout), store/chat-store.ts (useChatStore), hooks/use-identity.ts (useIdentity), hooks/use-agent-info.ts (useAgentInfo, shortAddress)] | imported by none (Next.js dynamic route page) | no test files
 *   Data flow: reads address + sessionId from URL params → useAgentSDK connects to agent via WebSocket → receives ChatItem[] (ui) streamed from agent → renders Chat component with all interaction handlers | the transcript's single source of truth is the SDK's per-session store (chat-store only indexes conversations: title/agent/createdAt)
 *   State/Effects: reads/writes conversations in zustand chat-store (persist to localStorage) | useAgentSDK manages WebSocket connection to agent | useIdentity ensures Ed25519 keypair exists | useAgentInfo polls agent /info endpoint every 30s | redirects to /[address] if no conversation found after store hydration
 *   Integration: exposes nothing (leaf page component) | consumes pendingMessage from chat-store (set by agent landing page before navigation) | passes mode from URL query params (?mode=ulw&turns=5) to useAgentSDK.setMode | provides handleReconnect via checkSession() for post-refresh reconnection
 *   Performance: displayUI memo avoids re-renders when hookUI unchanged | consumedRef prevents double-send of pending message | shouldRedirect deferred until _hasHydrated to avoid flash redirect on refresh
 *   Errors: connection errors stored in connectionError state → shown in ModeStatusBar with retry button | session expiry detected via checkSession() → shows error message
 *
 * URL Structure:
 *   /[address]/[sessionId]?mode=safe|plan|accept_edits|ulw&turns=N
 *   - address: agent's public key (0x...)
 *   - sessionId: UUID identifying the conversation session
 *   - mode: initial approval mode (optional, default: safe)
 *   - turns: ULW autonomous turns limit (optional)
 *
 * Lifecycle:
 *   1. Page mounts → useIdentity ensures keypair → useAgentSDK connects
 *   2. If pendingMessage in store (from landing page) → consume + send immediately
 *   3. Agent streams UI events → hookUI updates (sidebar title synced to chat-store)
 *   4. On page refresh → the SDK's per-session store hydrates the transcript
 *      → useAgentSDK.checkSession polls to detect if agent still running
 *   5. If no conversation found after hydration → redirect to agent landing
 *
 * File Relationships:
 *   app/
 *   ├── [address]/
 *   │   ├── page.tsx              # Agent landing page (creates session, navigates here)
 *   │   └── [sessionId]/
 *   │       └── page.tsx          # THIS FILE - active chat session
 *   components/chat/
 *   ├── use-agent-sdk.ts          # WebSocket connection + state management
 *   ├── chat.tsx                  # Main chat UI component
 *   ├── mode-indicator.tsx        # ModeStatusBar (safe/plan/ulw indicator + reconnect)
 *   └── mode-switcher.tsx         # PlanModeBanner, UlwModeBanner
 */
'use client'

import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Chat, useAgentSDK, ModeStatusBar, PlanModeBanner, UlwModeBanner } from '@/components/chat'
import { WorkspaceShell } from '@/components/dashboard/workspace-shell'
import { DashboardPane } from '@/components/dashboard/dashboard-pane'
import type { UI, ApprovalMode } from '@/components/chat/types'
import { dedupeUI } from '@/components/chat/dedupe-ui'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress } from '@/hooks/use-agent-info'
import { OnboardGate } from '@/components/chat/onboard-gate'
import { acceptsAttachments } from '@/components/chat/skill-offers'
import { LowBalanceNotice, isLowBalance, OfflineNotice } from '@/components/agent-address'

export default function ChatSessionPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const address = params.address as string
  const sessionId = params.sessionId as string

  // Read initial mode from URL (stateless, simple)
  const initialMode = (searchParams.get('mode') as ApprovalMode) || 'safe'
  const initialTurns = searchParams.get('turns') ? parseInt(searchParams.get('turns')!) : null

  const {
    agents,
    addAgent,
    conversations,
    createConversation,
    selectConversation,
    updateTitle,
    consumePendingMessage,
    _hasHydrated,
  } = useChatStore()

  useIdentity()

  const agentInfoMap = useAgentInfo([address])

  // Add agent if not in list
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
    if (!address || addedFor.current === address) return
    addedFor.current = address
    if (!agents.includes(address)) addAgent(address)
    // `agents` is deliberately not a dependency: reacting to it is the bug.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, addAgent])

  // Find the conversation
  const conversation = useMemo(
    () => conversations.find(c => c.sessionId === sessionId),
    [conversations, sessionId]
  )

  // Set active session when route changes
  useEffect(() => {
    if (sessionId) {
      selectConversation(sessionId)
    }
  }, [sessionId, selectConversation])

  const {
    ui: hookUI,
    isLoading,
    pendingAskUser,
    pendingApproval,
    pendingOnboard,
    pendingUlwTurnsReached,
    pendingPlanReview,
    sessionState,
    mode,
    ulwTurnsRemaining,
    send,
    respondToAskUser,
    respondToApproval,
    submitOnboard,
    respondToUlwTurnsReached,
    respondToPlanReview,
    setMode,
    reconnect,
    connect,
    interrupt,
    dashboardHtml,
    profile,
  } = useAgentSDK({
    agentAddress: address,
    sessionId,
    onError: (error) => setConnectionError(error),
  })

  // Skills come from the authenticated socket once it is up, and from the public relay
  // directory before that — this session is connected, so it is entitled to the full list
  // and the dashboard's buttons should work for every skill the agent actually has.
  //
  // Default to empty, not undefined: the dashboard's skill allowlist fails closed, so
  // an absent list must mean "nothing is invocable yet", never "anything goes".
  const skills = profile?.skills ?? agentInfoMap[address]?.skills ?? []
  // Credit is spent here, but until now the balance was only ever shown on the
  // landing page and in Settings — both passed through once, before any of it is
  // used. An agent could go from working to refusing mid-thread with no warning
  // and nowhere on this page to pay.
  //
  // The live AGENT_PROFILE frame wins over the cached map: it is what the agent
  // said on this connection, while the cache can be a page-load and a spend old.
  const balanceUsd = profile?.balance_usd ?? agentInfoMap[address]?.balance_usd

  // Every frame that parks the run until a human answers. On a phone Home and
  // Chat are exclusive, so a reader looking at the dashboard has no way to know
  // the agent stopped and is waiting on them — the run just never proceeds.
  const awaitsReader = Boolean(
    pendingApproval || pendingAskUser || pendingUlwTurnsReached || pendingPlanReview || pendingOnboard
  )

  // Consume pending message and apply initial mode from URL
  const consumedRef = useRef<string | null>(null)

  // Connection error state for retry functionality
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => {
    if (consumedRef.current === sessionId) return
    consumedRef.current = sessionId

    // Apply mode from URL FIRST (before sending message)
    if (initialMode !== 'safe') {
      setMode(initialMode, initialTurns ? { turns: initialTurns } : undefined)
    }

    // Then send the pending message
    const { message: pendingMessage, images: pendingImages, files: pendingFiles } = consumePendingMessage()
    if (pendingMessage) {
      send(pendingMessage, pendingImages ?? undefined, pendingFiles ?? undefined)
    }
  }, [sessionId, initialMode, initialTurns, consumePendingMessage, send, setMode])

  // The SDK's per-session store is the transcript's single source of truth;
  // it hydrates synchronously from localStorage, so hookUI already carries
  // the persisted conversation on reload.
  const displayUI = useMemo((): UI[] => dedupeUI(hookUI as UI[]), [hookUI])

  // Keep the sidebar title in sync with the first user message
  useEffect(() => {
    if (!sessionId) return
    const firstUser = displayUI.find(e => e.type === 'user')
    if (firstUser && 'content' in firstUser) {
      // Strip markdown punctuation so the sidebar shows plain text, not '# Heading'
      const title = firstUser.content.replace(/[#*`>_~\n]+/g, ' ').replace(/\s+/g, ' ').trim()
      if (title) updateTitle(sessionId, title)
    }
  }, [sessionId, displayUI, updateTitle])

  const handleSend = useCallback((content: string, images?: string[], files?: import('@/components/chat/types').FileAttachment[]) => {
    if (!conversation) {
      createConversation(sessionId, address)
    }
    setConnectionError(null)
    send(content, images, files)
  }, [conversation, sessionId, address, createConversation, send, setConnectionError])

  // Stable, so the pane's message listener isn't torn down and re-added every render.
  const runSkill = useCallback(
    (skill: string, args?: string) => handleSend(`/${skill}${args ? ` ${args}` : ''}`),
    [handleSend]
  )

  // Retry resends the last user message from the transcript — survives page reloads,
  // unlike transient state.
  const lastUserMessage = useMemo(() => {
    for (let i = displayUI.length - 1; i >= 0; i--) {
      const item = displayUI[i]
      if (item.type === 'user' && 'content' in item) return item.content
    }
    return ''
  }, [displayUI])

  // Eager, exactly as the landing page does it. The gate is driven by
  // ONBOARD_REQUIRED, which the host sends in answer to CONNECT — so a route that
  // does not connect until the first send shows a gated agent as open: composer,
  // offer chips, and a filled opener inviting the reader in. They write a real
  // message, send it, and only then meet the gate, with their text already
  // consumed into a run that cannot proceed. That is the ordering #27 fixed for
  // the landing page; a forwarded session link went round it.
  const connected = useRef(false)
  useEffect(() => {
    if (connected.current) return
    connected.current = true
    connect()
  }, [connect])

  const handleReconnect = useCallback(() => {
    setConnectionError(null)
    reconnect()
  }, [reconnect, setConnectionError])

  // Coming out of a tunnel, or unlocking a phone after the socket was reaped,
  // should not require noticing a status line at the bottom of the screen and
  // tapping a word in it. The reader's agent stopped working through no action of
  // theirs; it should start working again the same way.
  //
  // Bound to the transitions the browser reports rather than a timer, and armed
  // only while actually disconnected — so a working socket is never torn down
  // mid-run just because the tab was switched to, and an agent that is genuinely
  // gone is not hammered on an interval.
  useEffect(() => {
    if (sessionState !== 'disconnected') return

    const recover = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) handleReconnect()
    }
    window.addEventListener('online', recover)
    document.addEventListener('visibilitychange', recover)
    return () => {
      window.removeEventListener('online', recover)
      document.removeEventListener('visibilitychange', recover)
    }
  }, [sessionState, handleReconnect])

  // Redirect to agent landing if no conversation and no pending messages
  // Only after store has hydrated from localStorage — avoids redirect on refresh
  const shouldRedirect = _hasHydrated && !conversation && hookUI.length === 0
  useEffect(() => {
    if (shouldRedirect) {
      router.replace(`/${address}`)
    }
  }, [shouldRedirect, router, address])

  if (shouldRedirect) {
    return null
  }

  const isUlwActive = mode === 'ulw'

  const chatPane = (
      <div className="flex flex-col flex-1 min-h-0 relative">
        {/* Plan mode banner */}
        {mode === 'plan' && (
          <PlanModeBanner onExit={() => setMode('safe')} />
        )}

        {/* ULW mode banner */}
        {isUlwActive && (
          <UlwModeBanner turnsRemaining={ulwTurnsRemaining} onExit={() => setMode('safe')} />
        )}

        {/* Chat with mode status bar (ULW toggle integrated) */}
        <Chat
          ui={displayUI}
          onSend={handleSend}
          onStop={interrupt}
          isLoading={isLoading}
          suggestions={[]}
          pendingAskUser={pendingAskUser}
          onAskUserResponse={respondToAskUser}
          pendingApproval={pendingApproval}
          onApprovalResponse={respondToApproval}
          pendingOnboard={pendingOnboard}
          onOnboardSubmit={submitOnboard}
          pendingUlwTurnsReached={pendingUlwTurnsReached}
          onUlwTurnsReachedResponse={respondToUlwTurnsReached}
          pendingPlanReview={pendingPlanReview}
          onPlanReviewResponse={respondToPlanReview}
          sessionState={sessionState}
          statusBar={
            <ModeStatusBar
              mode={mode}
              onModeChange={setMode}
              disabled={false}
              ulwTurnsRemaining={ulwTurnsRemaining}
              sessionState={sessionState}
              isLoading={isLoading}
              connectionError={connectionError}
              onRetry={lastUserMessage ? () => handleSend(lastUserMessage) : undefined}
              onReconnect={handleReconnect}
            />
          }
          connectionError={connectionError}
          onRetry={lastUserMessage ? () => handleSend(lastUserMessage) : undefined}
          onDismissError={() => setConnectionError(null)}
          skills={skills}
          acceptsAttachments={acceptsAttachments(
            profile?.accepted_inputs ?? agentInfoMap[address]?.accepted_inputs
          )}
          agentName={agentInfoMap[address]?.name || shortAddress(address)}
          notice={
            agentInfoMap[address]?.online === false
              ? <OfflineNotice />
              : typeof balanceUsd === 'number' && isLowBalance(balanceUsd)
                ? <LowBalanceNotice address={address} balanceUsd={balanceUsd} />
                : null
          }
        />
      </div>
  )

  return (
    <>
      <WorkspaceShell
      chat={chatPane}
      hasDashboard={dashboardHtml !== null}
      chatAwaitsReader={awaitsReader}
      dashboard={
        <DashboardPane
          html={dashboardHtml}
          skills={skills}
          onRunSkill={runSkill}
          className="w-full h-full border-0"
        />
      }
      />

      {/* The wall, only when there is no conversation behind it. An agent that
          starts open and gates mid-session keeps the in-transcript card instead —
          there is a thread back there that has to stay readable, which is the
          distinction onboard-gate.tsx already draws.

          Keyed on there being no *user* message rather than an empty displayUI:
          the onboard prompt is itself an item, so the length was never zero and
          the wall never rendered. What decides this is whether the reader has a
          conversation to lose, and that is what a user message means. */}
      {pendingOnboard && !displayUI.some(item => item.type === 'user') && (
        <OnboardGate
          onboard={pendingOnboard}
          agentName={agentInfoMap[address]?.name || shortAddress(address)}
          onSubmit={(options: { inviteCode?: string; payment?: number }) => submitOnboard(options)}
        />
      )}
    </>
  )
}
