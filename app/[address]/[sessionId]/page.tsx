/**
 * @purpose Active chat session page — renders conversation UI with full agent interaction (messages, tools, approvals, modes)
 * @llm-note
 *   Dependencies: imports from [components/chat/index.ts (Chat, useAgentSDK, ModeStatusBar, PlanModeBanner, FullAccessModeBanner), components/chat/types.ts (UI), components/chat-layout.tsx (ChatLayout), store/chat-store.ts (useChatStore), hooks/use-identity.ts (useIdentity), hooks/use-agent-info.ts (useAgentInfo, shortAddress)] | imported by none (Next.js dynamic route page) | no test files
 *   Data flow: reads address + sessionId from URL params → useAgentSDK connects to agent via WebSocket → receives ChatItem[] (ui) streamed from agent → renders Chat component with all interaction handlers | the transcript's single source of truth is the SDK's per-session store (chat-store only indexes conversations: title/agent/createdAt)
 *   State/Effects: reads/writes conversations in zustand chat-store (persist to localStorage) | useAgentSDK manages WebSocket connection to agent | useIdentity ensures Ed25519 keypair exists | useAgentInfo polls agent /info endpoint every 30s | redirects to /[address] if no conversation found after store hydration
 *   Integration: exposes nothing (leaf page component) | consumes pendingMessage from chat-store (set by agent landing page before navigation) | carries only O Chat's Plan workflow hint while React owns acknowledged Host policy | provides handleReconnect via checkSession() for post-refresh reconnection
 *   Performance: displayUI memo avoids re-renders when hookUI unchanged | consumedRef prevents double-send of pending message | shouldRedirect deferred until _hasHydrated to avoid flash redirect on refresh
 *   Errors: connection errors stored in connectionError state → shown in ModeStatusBar with retry button | session expiry detected via checkSession() → shows error message
 *
 * URL Structure:
 *   /[address]/[sessionId]?workflow=plan
 *   - address: agent's public key (0x...)
 *   - sessionId: UUID identifying the conversation session
 *   - workflow: optional O Chat collaboration state; Plan does not change Host permission
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
 *   ├── mode-indicator.tsx        # Default/Plan collaboration + Read only/Auto/Full access permission
 *   └── mode-switcher.tsx         # PlanModeBanner, FullAccessModeBanner
 */
'use client'

import { useEffect, useEffectEvent, useCallback, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Chat, useAgentSDK, ModeStatusBar, PlanModeBanner, FullAccessModeBanner } from '@/components/chat'
import { CurrentPlanPanel } from '@/components/current-plan-panel'
import { WorkspaceShell } from '@/components/dashboard/workspace-shell'
import { DashboardPane } from '@/components/dashboard/dashboard-pane'
import type { UI } from '@/components/chat/types'
import { dedupeUI } from '@/components/chat/dedupe-ui'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress, isAgentAddress } from '@/hooks/use-agent-info'
import { OnboardGate } from '@/components/chat/onboard-gate'
import { InvalidAddress } from '@/components/invalid-address'
import { acceptsAttachments } from '@/components/chat/skill-offers'
import { LowBalanceNotice, isLowBalance, OfflineNotice, DisconnectedNotice } from '@/components/agent-address'

export default function ChatSessionPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const address = params.address as string
  const sessionId = params.sessionId as string

  // Only product workflow is route state. Legacy mode=plan remains a fail-safe
  // alias; URL values can never grant Host policy or Full access turns.
  const initialPlanMode = searchParams.get('workflow') === 'plan'
    || searchParams.get('mode') === 'plan'

  // Next can preserve this client component while moving between dynamic
  // session routes. Bind an error to the session that produced it so an older
  // failure can never flash in or disable a new conversation during transition.
  const [connectionErrorState, setConnectionErrorState] = useState<{
    sessionId: string
    message: string
  } | null>(null)
  const connectionError = connectionErrorState?.sessionId === sessionId
    ? connectionErrorState.message
    : null
  const setConnectionError = useCallback((message: string | null) => {
    setConnectionErrorState(message ? { sessionId, message } : null)
  }, [sessionId])

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
    currentPlan,
    isLoading,
    pendingAskUser,
    pendingApproval,
    pendingOnboard,
    pendingFullAccessCheckpoint,
    pendingPlanReview,
    sessionState,
    collaborationMode,
    permissionProfile,
    availablePermissionProfiles,
    permissionProfileChangePending,
    permissionProfileChangeError,
    permissionProfileRecoveryAction,
    fullAccessTurnsRemaining,
    send,
    retry,
    respondToAskUser,
    respondToApproval,
    submitOnboard,
    respondToPlanReview,
    setCollaborationMode,
    setPermissionProfile,
    retryPermissionProfileChange,
    reconnect,
    connect,
    interrupt,
    interruptProvider,
    dashboardHtml,
    profile,
  } = useAgentSDK({
    agentAddress: address,
    sessionId,
    initialPlanMode,
    // The SDK reports null when a retry/new run clears its error, so the page's
    // banner and status recover together with the underlying connection.
    onError: setConnectionError,
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
    pendingApproval || pendingAskUser || pendingFullAccessCheckpoint || pendingPlanReview || pendingOnboard
  )

  // Consume the landing message only after React has read Host mode authority.
  const consumedRef = useRef<string | null>(null)

  useEffect(() => {
    if (consumedRef.current === sessionId) return
    const planReady = !initialPlanMode || collaborationMode === 'plan'
    if (!planReady) return
    consumedRef.current = sessionId
    const { message: pendingMessage, images: pendingImages, files: pendingFiles } = consumePendingMessage()
    if (pendingMessage) {
      send(pendingMessage, pendingImages ?? undefined, pendingFiles ?? undefined)
    }
  }, [sessionId, initialPlanMode, collaborationMode, consumePendingMessage, send])

  // The SDK's per-session store is the transcript's single source of truth;
  // it hydrates synchronously from localStorage, so hookUI already carries
  // the persisted conversation on reload.
  const displayUI = useMemo((): UI[] => dedupeUI(hookUI), [hookUI])

  // One pending challenge, one control. Before the reader has spoken, the
  // full-screen gate owns onboarding and the same item must not also render as
  // an interactive transcript card underneath it. Once a conversation exists,
  // the gate stays away and the inline card remains the right place to answer.
  const initialOnboard = pendingOnboard && !displayUI.some(item => item.type === 'user')
    ? pendingOnboard
    : null
  const transcriptUI = initialOnboard
    ? displayUI.filter(item => item.type !== 'onboard_required')
    : displayUI

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
    if (permissionProfileChangePending) return
    if (!conversation) {
      createConversation(sessionId, address)
    }
    setConnectionError(null)
    send(content, images, files)
  }, [permissionProfileChangePending, conversation, sessionId, address, createConversation, setConnectionError, send])

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

  const handleRetry = useCallback(() => {
    if (!lastUserMessage) return
    setConnectionError(null)
    retry(lastUserMessage)
  }, [lastUserMessage, retry, setConnectionError])

  const recoverConnection = useEffectEvent(() => {
    if (sessionState === 'disconnected' && document.visibilityState === 'visible' && navigator.onLine) {
      handleReconnect()
    }
  })

  // Coming out of a tunnel, or unlocking a phone after the socket was reaped,
  // should not require noticing a status line at the bottom of the screen and
  // tapping a word in it. The reader's agent stopped working through no action of
  // theirs; it should start working again the same way.
  //
  // Bind once so a browser event cannot land between the disconnected render and
  // an effect re-subscription. The Effect Event reads the latest state without
  // re-subscribing, so a working socket is never torn down on a tab switch.
  useEffect(() => {
    window.addEventListener('online', recoverConnection)
    document.addEventListener('visibilitychange', recoverConnection)
    return () => {
      window.removeEventListener('online', recoverConnection)
      document.removeEventListener('visibilitychange', recoverConnection)
    }
  }, [])

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

  const isFullAccessActive = permissionProfile === ':danger-full-access'

  const chatPane = (
      <div className="flex flex-col flex-1 min-h-0 relative">
        {/* Plan mode banner */}
        {collaborationMode === 'plan' && (
          <PlanModeBanner onExit={() => setCollaborationMode('default')} />
        )}

        {/* Full access mode banner */}
        {isFullAccessActive && (
          <FullAccessModeBanner turnsRemaining={fullAccessTurnsRemaining} onExit={() => void setPermissionProfile(':read-only')} />
        )}

        <CurrentPlanPanel entries={currentPlan} />

        {/* Chat with mode status bar (Full access toggle integrated) */}
        <Chat
          ui={transcriptUI}
          onSend={handleSend}
          onStop={interrupt}
          onProviderStop={interruptProvider}
          isLoading={isLoading}
          inputDisabled={permissionProfileChangePending}
          suggestions={[]}
          pendingAskUser={pendingAskUser}
          onAskUserResponse={respondToAskUser}
          pendingApproval={pendingApproval}
          onApprovalResponse={respondToApproval}
          pendingOnboard={pendingOnboard}
          onOnboardSubmit={submitOnboard}
          pendingFullAccessCheckpoint={pendingFullAccessCheckpoint}
          onFullAccessCheckpointResponse={interrupt}
          pendingPlanReview={pendingPlanReview}
          onPlanReviewResponse={respondToPlanReview}
          sessionState={sessionState}
          permissionProfile={permissionProfile}
          statusBar={
            <ModeStatusBar
              collaborationMode={collaborationMode}
              permissionProfile={permissionProfile}
              availablePermissionProfiles={availablePermissionProfiles}
              onCollaborationModeChange={setCollaborationMode}
              onPermissionProfileChange={(profile) => void setPermissionProfile(profile)}
              disabled={isLoading}
              permissionProfileChangePending={permissionProfileChangePending}
              permissionProfileChangeError={permissionProfileChangeError}
              permissionProfileRecoveryAction={permissionProfileRecoveryAction}
              onPermissionProfileRetry={retryPermissionProfileChange}
              fullAccessTurnsRemaining={fullAccessTurnsRemaining}
              sessionState={sessionState}
              connectionError={connectionError}
              onReconnect={handleReconnect}
            />
          }
          connectionError={connectionError}
          onRetry={lastUserMessage ? handleRetry : undefined}
          onDismissError={() => setConnectionError(null)}
          skills={skills}
          acceptsAttachments={acceptsAttachments(
            profile?.accepted_inputs ?? agentInfoMap[address]?.accepted_inputs
          )}
          agentName={agentInfoMap[address]?.name || shortAddress(address)}

        />
      </div>
  )

  // #109 guarded adoption on this route but left it rendering a working session:
  // a forwarded session link with a clipped address showed "Connected — send a
  // message" and a composer, and the reader typed into nothing.
  if (!isAgentAddress(address)) return <InvalidAddress address={address} />

  return (
    <>
      <WorkspaceShell
      chat={chatPane}
      hasDashboard={dashboardHtml !== null}
      chatAwaitsReader={awaitsReader}
      hiddenChatNotice={
        sessionState === 'disconnected' ? <DisconnectedNotice onReconnect={handleReconnect} /> : null
      }
      agentNotice={
        // Offline outranks a low balance: credit is irrelevant to an agent that
        // cannot be reached, and two stacked notices read as noise rather than
        // one thing to act on.
        agentInfoMap[address]?.online === false
          ? <OfflineNotice />
          : typeof balanceUsd === 'number' && isLowBalance(balanceUsd)
            ? <LowBalanceNotice address={address} balanceUsd={balanceUsd} />
            : null
      }
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
      {initialOnboard && (
        <OnboardGate
          onboard={initialOnboard}
          agentName={agentInfoMap[address]?.name || shortAddress(address)}
          onSubmit={(options: { inviteCode?: string; payment?: number }) => submitOnboard(options)}
        />
      )}
    </>
  )
}
