'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  useAgentForHuman,
  type AgentInfo,
  type ChatItem,
  type CollaborationMode,
  type ConnectionState,
  type HostSessionModeState,
  type OutgoingMessage,
  type PermissionProfile,
  type PlanEntry,
} from '@connectonion/react'
import type { PendingAskUser, PendingApproval, PendingOnboard, PendingFullAccessCheckpoint, PendingPlanReview } from './types'
import { dedupeUI } from './dedupe-ui'
import {
  permissionProfileRecoveryAction,
  type PermissionProfileRecoveryAction,
} from './mode-policy'

/** Session lifecycle state */
export type SessionActiveState = 'idle' | 'connected' | 'active' | 'disconnected' | 'reconnecting'

/** Reduce React-owned transport state and product activity into one display state. */
export function deriveSessionState(
  connectionState: ConnectionState,
  isLoading: boolean,
  serverSessionAlive: boolean,
  hasConversation: boolean,
): SessionActiveState {
  if (connectionState === 'reconnecting') return 'reconnecting'
  // A transport loss is authoritative. Stale running transcript items must not
  // hide it, but a cold agent has no connection to call lost yet.
  if (connectionState === 'disconnected' && hasConversation) return 'disconnected'
  if (connectionState === 'connected' || isLoading) return 'active'
  if (serverSessionAlive) return 'disconnected'
  if (hasConversation) return 'connected'
  return 'idle'
}

// Re-export ChatItem as UI for compatibility
export type UI = ChatItem

/** Resolve the browser signature before handing an onboarding frame to the socket. */
export async function submitSignedOnboard(
  signOnboard: (
    options: { inviteCode?: string; payment?: number },
  ) => OutgoingMessage | Promise<OutgoingMessage>,
  sendMessage: (message: OutgoingMessage) => void,
  options: { inviteCode?: string; payment?: number },
): Promise<void> {
  sendMessage(await signOnboard(options))
}

interface UseAgentSDKOptions {
  agentAddress: string
  sessionId: string
  initialPlanMode?: boolean
  onComplete?: (result: string) => void
  /** Current SDK error. `null` clears a previously reported failure. */
  onError?: (error: string | null) => void
}

/**
 * Translate the SDK error channel into the page-owned connection banner.
 *
 * `undefined` means "leave the current banner alone" for permission-profile
 * errors that already have their own recovery UI. `null` is deliberately
 * different: a retry/new run cleared the SDK error, so consumers must clear
 * the old banner too instead of leaving the conversation permanently marked
 * as failed.
 */
export function connectionErrorUpdate(
  error: Error | null,
  permissionProfileError: boolean,
): string | null | undefined {
  if (!error) return null
  if (permissionProfileError) return undefined
  return error.message
}

/** Session state for compatibility with page.tsx */
interface CurrentSession {
  session_id: string
}

interface UseAgentSDKReturn {
  ui: ChatItem[]
  /** Current session's complete, observational plan snapshot. */
  currentPlan: ReadonlyArray<PlanEntry>
  isConnected: boolean
  isLoading: boolean
  pendingAskUser: PendingAskUser | null
  pendingApproval: PendingApproval | null
  pendingOnboard: PendingOnboard | null
  pendingFullAccessCheckpoint: PendingFullAccessCheckpoint | null
  pendingPlanReview: PendingPlanReview | null
  sessionState: SessionActiveState
  currentSession: CurrentSession | null
  collaborationMode: CollaborationMode
  permissionProfile: PermissionProfile
  /** Exact permission profiles advertised through React. */
  availablePermissionProfiles: ReadonlyArray<HostSessionModeState['availableModes'][number]>
  /** True until React receives the owned Host acknowledgement. */
  permissionProfileChangePending: boolean
  /** Last permission transaction failure; authoritative profile is unchanged. */
  permissionProfileChangeError: string | null
  /** Retry for owned rejection/busy, reconnect for unknown timeout/disconnect. */
  permissionProfileRecoveryAction: PermissionProfileRecoveryAction | null
  /** Full access mode: max turns before pausing */
  fullAccessTurns: number | null
  /** Full access mode: turns used so far */
  fullAccessTurnsUsed: number | null
  /** Full access mode: turns remaining (max - used) */
  fullAccessTurnsRemaining: number | null
  send: (content: string, images?: string[], files?: import('./types').FileAttachment[]) => void
  /** Re-run a failed turn without duplicating the last user transcript item. */
  retry: (content: string, images?: string[], files?: import('./types').FileAttachment[]) => void
  /** Gracefully stop a running agent: it finishes the current step and returns a closing message */
  interrupt: () => void
  respondToAskUser: (answer: string | string[]) => void
  respondToApproval: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  respondToPlanReview: (message: string) => void
  submitOnboard: (options: { inviteCode?: string; payment?: number }) => void
  setCollaborationMode: (mode: CollaborationMode) => void
  setPermissionProfile: (profile: PermissionProfile) => Promise<void>
  retryPermissionProfileChange: () => void
  /** Check server session status via WebSocket (checks active registry) */
  checkSessionStatus: (sessionId: string) => Promise<string>
  /** Reconnect to existing session to receive pending output */
  reconnect: () => void
  /** Open the WebSocket without sending input, to receive the on-connect dashboard snapshot. */
  connect: () => void
  /** Latest agent-authored dashboard.html snapshot, or null until the first arrives. */
  dashboardHtml: string | null
  /**
   * The agent's own account of itself over the authenticated socket — every skill,
   * not the subset the public directory lists. `null` until the connection passes
   * the trust gate, which is exactly when a visitor should not see the full list.
   */
  profile: AgentInfo | null
  clear: () => void
}

/**
 * Extract pending states from SDK UI.
 */
export function extractPendingStates(ui: ChatItem[]): { pendingAskUser: PendingAskUser | null, pendingApproval: PendingApproval | null, pendingOnboard: PendingOnboard | null, pendingFullAccessCheckpoint: PendingFullAccessCheckpoint | null, pendingPlanReview: PendingPlanReview | null } {
  let pendingAskUser: PendingAskUser | null = null
  let pendingApproval: PendingApproval | null = null
  let pendingOnboard: PendingOnboard | null = null
  let pendingFullAccessCheckpoint: PendingFullAccessCheckpoint | null = null
  let pendingPlanReview: PendingPlanReview | null = null
  const toolStatuses = new Map<string, string>()
  let hasOnboardSuccess = false

  for (const item of ui) {
    if (item.type === 'tool_call') {
      toolStatuses.set(item.name.toLowerCase(), item.status)
    } else if (item.type === 'ask_user') {
      if ((item as { answered?: boolean }).answered) {
        pendingAskUser = null
        continue
      }
      const toolStatus = toolStatuses.get('ask_user')
      if (toolStatus === 'running' || toolStatus === undefined) {
        pendingAskUser = {
          question: typeof item.text === 'string' ? item.text : '',
          options: Array.isArray(item.options) ? item.options : [],
          multi_select: item.multi_select === true,
          input_type: (item as { input_type?: string }).input_type,
          fields: (item as { fields?: PendingAskUser['fields'] }).fields,
        }
      } else {
        pendingAskUser = null
      }
    } else if (item.type === 'approval_needed') {
      if (item.answered) {
        pendingApproval = null
        continue
      }
      // Only set pendingApproval if the tool is still running
      const toolStatus = toolStatuses.get(item.tool.split(':')[0].toLowerCase())
      if (toolStatus === 'running' || toolStatus === undefined) {
        pendingApproval = {
          tool: item.tool,
          arguments: item.arguments,
          ...(item.description && { description: item.description }),
          ...(item.batch_remaining && { batch_remaining: item.batch_remaining }),
        }
      }
    } else if (item.type === 'onboard_required') {
      if (!hasOnboardSuccess) {
        pendingOnboard = {
          methods: item.methods,
          paymentAmount: item.paymentAmount,
          // Third place this field was dropped: the host publishes it, the SDK
          // parsed everything but this, and the derivation here forwarded
          // everything but this. A gate can ask for money and say where now.
          paymentAddress: item.paymentAddress,
        }
      }
    } else if (item.type === 'onboard_success') {
      hasOnboardSuccess = true
      pendingOnboard = null
    } else if (item.type === 'full_access_checkpoint') {
      pendingFullAccessCheckpoint = {
        id: item.id,
        turns_used: item.turns_used,
        max_turns: item.max_turns,
      }
    }

    const maybePlanReview = item as unknown as { type?: string; plan_content?: string }
    if (maybePlanReview.type === 'plan_review') {
      pendingPlanReview = {
        plan_content: maybePlanReview.plan_content ?? '',
      }
    }
  }

  return { pendingAskUser, pendingApproval, pendingOnboard, pendingFullAccessCheckpoint, pendingPlanReview }
}

/**
 * Optimistic stop: flip every in-flight status to its finished value so spinners
 * stop the moment the user clicks Stop, before the agent's closing events arrive.
 */
function stopRunningItems(ui: ChatItem[]): ChatItem[] {
  return ui.map((item) => {
    switch (item.type) {
      case 'thinking':
      case 'tool_call':
        return item.status === 'running' ? { ...item, status: 'done' as const } : item
      case 'intent':
        return item.status === 'analyzing' ? { ...item, status: 'understood' as const } : item
      case 'eval':
        return item.status === 'evaluating' ? { ...item, status: 'done' as const } : item
      case 'compact':
        return item.status === 'compacting' ? { ...item, status: 'done' as const } : item
      default:
        return item
    }
  })
}

function hasActiveRestoredItem(ui: ChatItem[]): boolean {
  return ui.some((item) => {
    switch (item.type) {
      case 'thinking':
      case 'tool_call':
        return item.status === 'running'
      case 'intent':
        return item.status === 'analyzing'
      case 'eval':
        return item.status === 'evaluating'
      case 'compact':
        return item.status === 'compacting'
      default:
        return false
    }
  })
}

export function useAgentSDK(options: UseAgentSDKOptions): UseAgentSDKReturn {
  const {
    agentAddress,
    sessionId,
    initialPlanMode = false,
    onComplete,
    onError,
  } = options

  const prevStatusRef = useRef<'idle' | 'working' | 'waiting'>('idle')

  // Use SDK's useAgentForHuman with agent address and sessionId
  const {
    status,
    connectionState,
    ui,
    plan: currentPlan,
    input,
    retry: retryInput,
    reset,
    isProcessing,
    error,
    checkSessionStatus,
    collaborationMode: sdkCollaborationMode,
    permissionProfile,
    availablePermissionProfiles = [],
    permissionProfileChangePending: sdkPermissionProfileChangePending = false,
    fullAccessTurns,
    fullAccessTurnsUsed,
    sendMessage,
    respondToApproval: sdkRespondToApproval,
    interrupt: sdkInterrupt,
    signOnboard,
    setCollaborationMode: setSDKCollaborationMode,
    setPermissionProfile: setSDKPermissionProfile,
    reconnect: sdkReconnect,
    dashboardHtml,
    profile,
    connect,
  } = useAgentForHuman(agentAddress, sessionId)
  // A route may carry the initial collaboration hint. Once the reader chooses,
  // that explicit local choice wins; Host permission authority is untouched.
  const [collaborationOverride, setCollaborationOverride] = useState<CollaborationMode | null>(
    initialPlanMode ? 'plan' : null,
  )
  const collaborationMode = collaborationOverride ?? sdkCollaborationMode
  const [localPermissionProfilePending, setLocalPermissionProfilePending] = useState(false)
  const [permissionProfileChangeError, setPermissionProfileChangeError] = useState<string | null>(null)
  const [permissionProfileRecovery, setPermissionProfileRecovery] = useState<PermissionProfileRecoveryAction | null>(null)
  const lastPermissionRequest = useRef<PermissionProfile | null>(null)
  const permissionProfileRequestInFlight = useRef(false)
  const ownedPermissionProfileErrors = useRef(new Set<string>())
  const permissionProfileChangePending = sdkPermissionProfileChangePending || localPermissionProfilePending
  // Optimistic stop: set the instant the user clicks Stop, cleared when the run
  // actually ends (status → idle) or the user sends a new message. While set,
  // the UI renders as stopped even though the agent is still finishing its
  // current step server-side.
  const [stopRequested, setStopRequested] = useState(false)
  // The transcript is append-only. Suppress only the exact terminal checkpoint
  // whose React-owned cancellation was successfully dispatched.
  const [dismissedFullAccessCheckpointId, setDismissedFullAccessCheckpointId] = useState<string | null>(null)

  // Each connect attempt to a non-onboarded agent emits a fresh onboard_required
  // (new UUID, so dedupeUI keeps them all) — keep only the latest card.
  const cleanUI = useMemo(() => {
    let items = dedupeUI(ui)
    let lastOnboardIndex = -1
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].type === 'onboard_required') { lastOnboardIndex = i; break }
    }
    if (lastOnboardIndex !== -1) {
      items = items.filter((item, i) => item.type !== 'onboard_required' || i === lastOnboardIndex)
    }
    return stopRequested ? stopRunningItems(items) : items
  }, [ui, stopRequested])
  const hasActiveUI = useMemo(() => hasActiveRestoredItem(cleanUI), [cleanUI])
  const isLoading = (isProcessing || hasActiveUI) && !stopRequested

  // The run ended for real (closing message arrived, or a fresh run started and
  // finished) — hand the UI back to the SDK's event stream. Adjust-during-render
  // pattern (not an effect): react.dev/learn/you-might-not-need-an-effect
  const [prevRunStatus, setPrevRunStatus] = useState(status)
  if (status !== prevRunStatus) {
    setPrevRunStatus(status)
    if (status === 'idle' && stopRequested) setStopRequested(false)
  }

  // Poll server session status only after user was just connected (processing → idle)
  // Don't poll on page load for old sessions — no point checking expired sessions
  const [serverSessionAlive, setServerSessionAlive] = useState(false)
  const wasProcessingRef = useRef(false)
  const checkSessionStatusRef = useRef(checkSessionStatus)

  useEffect(() => {
    checkSessionStatusRef.current = checkSessionStatus
  }, [checkSessionStatus])

  useEffect(() => {
    if (isLoading) {
      wasProcessingRef.current = true
      return
    }

    // Only poll if we were just processing (user had an active session)
    if (!wasProcessingRef.current) return

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null
    const check = async () => {
      const result = await checkSessionStatusRef.current(sessionId)
      if (!cancelled) {
        const alive = result === 'running'
        setServerSessionAlive(alive)
        if (!alive && intervalId) {
          clearInterval(intervalId)
          intervalId = null
        }
      }
    }
    check()
    intervalId = setInterval(check, 10000)
    return () => { cancelled = true; if (intervalId) clearInterval(intervalId) }
  }, [sessionId, isLoading])

  // Detect completion (when status changes from working/waiting to idle)
  useEffect(() => {
    if (prevStatusRef.current !== 'idle' && status === 'idle' && !error) {
      // Just completed successfully
      const lastAgent = cleanUI.filter(e => e.type === 'agent').pop()
      if (lastAgent && 'content' in lastAgent) {
        onComplete?.(lastAgent.content)
      }
    }

    prevStatusRef.current = status
  }, [status, cleanUI, error, onComplete])

  // Handle errors
  useEffect(() => {
    const permissionProfileError = Boolean(
      error && (
        permissionProfileRequestInFlight.current
        || ownedPermissionProfileErrors.current.has(error.message)
      )
    )
    const update = connectionErrorUpdate(error, permissionProfileError)
    if (update === null) {
      ownedPermissionProfileErrors.current.clear()
      onError?.(null)
      return
    }
    // React exposes setPermissionProfile failures on its general error channel too.
    // They already have a targeted recovery UI and are not connection errors.
    if (update !== undefined) onError?.(update)
  }, [error, onError])

  // Extract pending states from UI
  const { pendingAskUser, pendingApproval, pendingOnboard, pendingFullAccessCheckpoint: rawPendingFullAccessCheckpoint, pendingPlanReview } = useMemo(
    () => extractPendingStates(cleanUI),
    [cleanUI]
  )
  const fullAccessCheckpointId = rawPendingFullAccessCheckpoint?.id ?? null
  const pendingFullAccessCheckpoint = fullAccessCheckpointId !== dismissedFullAccessCheckpointId
    ? rawPendingFullAccessCheckpoint
    : null

  // Send message
  const send = useCallback((content: string, images?: string[], files?: import('./types').FileAttachment[]) => {
    setStopRequested(false)
    input(content, { images, files })
  }, [input])

  const retry = useCallback((content: string, images?: string[], files?: import('./types').FileAttachment[]) => {
    setStopRequested(false)
    retryInput(content, { images, files })
  }, [retryInput])

  // Stop is a product action here; the React SDK owns capability negotiation,
  // session binding, pending-permission cancellation, and legacy fallback.
  // Keep the optimistic UI behavior even when a restored session has no live
  // socket, so a stale "running" state can still be dismissed.
  const interrupt = useCallback(() => {
    setStopRequested(true)
    if (connectionState === 'connected') {
      sdkInterrupt()
      if (fullAccessCheckpointId) {
        setDismissedFullAccessCheckpointId(fullAccessCheckpointId)
      }
    }
  }, [sdkInterrupt, connectionState, fullAccessCheckpointId])

  const respondToAskUser = useCallback((answer: string | string[]) => {
    sendMessage({ type: 'ASK_USER_RESPONSE', answer: Array.isArray(answer) ? answer.join(', ') : answer })
  }, [sendMessage])

  const respondToApproval = useCallback((approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => {
    sdkRespondToApproval(approved, scope, mode, feedback)
  }, [sdkRespondToApproval])

  const respondToPlanReview = useCallback((message: string) => {
    sendMessage({ type: 'PLAN_REVIEW_RESPONSE', message })
  }, [sendMessage])

  const submitOnboard = useCallback((options: { inviteCode?: string; payment?: number }) => {
    void submitSignedOnboard(signOnboard, sendMessage, options).catch((caught) => {
      onError?.(caught instanceof Error ? caught.message : String(caught))
    })
  }, [sendMessage, signOnboard, onError])

  const setCollaborationMode = useCallback((newMode: CollaborationMode) => {
    setSDKCollaborationMode(newMode)
    setCollaborationOverride(newMode)
  }, [setSDKCollaborationMode])

  const setPermissionProfile = useCallback(async (newProfile: PermissionProfile) => {
    if (permissionProfileRequestInFlight.current) return
    permissionProfileRequestInFlight.current = true
    lastPermissionRequest.current = newProfile
    setLocalPermissionProfilePending(true)
    setPermissionProfileChangeError(null)
    setPermissionProfileRecovery(null)
    try {
      if (newProfile !== permissionProfile) {
        await setSDKPermissionProfile(newProfile)
      }
    } catch (caught) {
      const profileError = caught instanceof Error ? caught : new Error(String(caught))
      ownedPermissionProfileErrors.current.add(profileError.message)
      setPermissionProfileChangeError(profileError.message || 'Unable to change permission profile')
      setPermissionProfileRecovery(permissionProfileRecoveryAction(profileError))
    } finally {
      permissionProfileRequestInFlight.current = false
      setLocalPermissionProfilePending(false)
    }
  }, [permissionProfile, setSDKPermissionProfile])

  const retryPermissionProfileChange = useCallback(() => {
    if (permissionProfileRecovery === 'reconnect') {
      setPermissionProfileChangeError(null)
      setPermissionProfileRecovery(null)
      sdkReconnect()
      return
    }
    if (lastPermissionRequest.current) {
      void setPermissionProfile(lastPermissionRequest.current)
    }
  }, [permissionProfileRecovery, sdkReconnect, setPermissionProfile])

  // Clear/reset
  const clear = useCallback(() => {
    setDismissedFullAccessCheckpointId(null)
    reset()
  }, [reset])

  // isConnected: SDK doesn't track this directly, infer from status
  const isConnected = status !== 'idle' || cleanUI.length > 0

  // Build currentSession for compatibility with page.tsx
  const currentSession: CurrentSession | null = sessionId
    ? { session_id: sessionId }
    : null

  return {
    ui: cleanUI,
    currentPlan,
    isConnected,
    isLoading,
    pendingAskUser,
    pendingApproval,
    pendingOnboard,
    pendingFullAccessCheckpoint,
    pendingPlanReview,
    sessionState: deriveSessionState(connectionState, isLoading, serverSessionAlive, cleanUI.length > 0),
    currentSession,
    collaborationMode,
    permissionProfile,
    availablePermissionProfiles,
    permissionProfileChangePending,
    permissionProfileChangeError,
    permissionProfileRecoveryAction: permissionProfileRecovery,
    fullAccessTurns: fullAccessTurns ?? null,
    fullAccessTurnsUsed: fullAccessTurnsUsed ?? null,
    fullAccessTurnsRemaining: fullAccessTurns != null && fullAccessTurnsUsed != null ? fullAccessTurns - fullAccessTurnsUsed : null,
    send,
    retry,
    interrupt,
    respondToAskUser,
    respondToApproval,
    respondToPlanReview,
    submitOnboard,
    setCollaborationMode,
    setPermissionProfile,
    retryPermissionProfileChange,
    checkSessionStatus,
    reconnect: sdkReconnect,
    connect,
    dashboardHtml,
    profile,
    clear,
  }
}
