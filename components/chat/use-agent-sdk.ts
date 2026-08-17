'use client'

/**
 * O Chat's boundary over @connectonion/react. It must not decode provider
 * transports: Core emits typed OIP and React normalizes it. Work Room ownership,
 * safe rendering rules, and the local Stop lifecycle are documented in
 * docs/WORKROOM.md.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  useAgentForHuman,
  type AgentInfo,
  type ChatItem,
  type CollaborationMode,
  type ConnectionState,
  type ExecutionProfile,
  type HostSessionModeState,
  type OutgoingMessage,
  type PermissionProfile,
  type PlanEntry,
} from '@connectonion/react'
import type {
  PendingAskUser,
  PendingApproval,
  PendingOnboard,
  PendingFullAccessCheckpoint,
  PendingPlanReview,
  ProviderStopAcknowledgement,
  ProviderStopPhase,
  ProviderStopStates,
} from './types'
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

type ApprovalItem = Extract<ChatItem, { type: 'approval_needed' }>

const SAFE_PROVIDER_APPROVAL_ACTIONS = new Set([
  'Run a workspace command',
  'Compile the requested C11 program',
  'Compile the requested C program',
  'Compile and run the requested tests',
  'Run the requested tests',
  'Run the requested program',
  'Inspect the workspace',
  'Make workspace file changes',
  'Expand provider permissions',
  'Perform a provider action',
])
const SAFE_PROVIDER_APPROVAL_REASONS = new Set([
  'Codex requested approval to continue',
  'Claude Code requested approval to continue',
  'Compile the requested workspace files before continuing',
  'Verify the requested workspace changes before continuing',
  'Verify the requested program before continuing',
  'Check the requested workspace result before continuing',
  'Apply the requested workspace file changes',
  'Review the requested permission expansion',
])
const PROVIDER_APPROVAL_SCOPES = {
  workroom: 'This Work Room only',
  elevated: 'Outside this Work Room',
  unknown: 'Boundary could not be verified',
} as const
const PROVIDER_STOP_CONFIRMATION_TIMEOUT_MS = 15_000

function nativeProviderApproval(item: ApprovalItem): Pick<PendingApproval, 'provider' | 'providerInvocationId' | 'parentToolCallId' | 'activityId'> | null {
  const candidate = item as ApprovalItem & {
    provider?: PendingApproval['provider']
    providerInvocationId?: string
    parentToolCallId?: string
    activityId?: string
  }
  if (
    (candidate.provider !== 'codex' && candidate.provider !== 'claude_code')
    || !candidate.providerInvocationId
    || !candidate.parentToolCallId
  ) return null
  return {
    provider: candidate.provider,
    providerInvocationId: candidate.providerInvocationId,
    parentToolCallId: candidate.parentToolCallId,
    ...(candidate.activityId && { activityId: candidate.activityId }),
  }
}

function nativeProviderApprovalPresentation(
  item: ApprovalItem,
): Pick<PendingApproval, 'providerApproval'> | null {
  const candidate = item as ApprovalItem & { providerApproval?: PendingApproval['providerApproval'] }
  const value = candidate.providerApproval
  if (
    !value
    || (value.scopeClassification !== 'workroom'
      && value.scopeClassification !== 'elevated'
      && value.scopeClassification !== 'unknown')
    || typeof value.action !== 'string'
    || !SAFE_PROVIDER_APPROVAL_ACTIONS.has(value.action)
    || typeof value.scope !== 'string'
    || value.scope !== PROVIDER_APPROVAL_SCOPES[value.scopeClassification]
    || typeof value.reason !== 'string'
    || !SAFE_PROVIDER_APPROVAL_REASONS.has(value.reason)
    || typeof value.allowOnce !== 'boolean'
    || typeof value.allowSession !== 'boolean'
  ) return null
  return {
    providerApproval: {
      ...value,
      // A rolling deployment can receive an older React package's native
      // envelope directly. Apply the same fail-closed authority rule here.
      allowOnce: value.scopeClassification === 'workroom' ? value.allowOnce : false,
      allowSession: value.scopeClassification === 'workroom' ? value.allowSession : false,
    },
  }
}

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

/**
 * A native-provider Stop is safe to present as requested only when the SDK has
 * correlated it with the Host acknowledgement. Older React artifacts sent the
 * frame fire-and-forget; retain the conservative UI instead of claiming an ACK
 * that never arrived.
 */
export async function awaitProviderStopAcknowledgement(
  interruptProvider: (invocationId: string) => unknown,
  invocationId: string,
): Promise<ProviderStopAcknowledgement> {
  const acknowledgement = interruptProvider(invocationId)
  if (
    !acknowledgement
    || typeof (acknowledgement as PromiseLike<unknown>).then !== 'function'
  ) {
    throw new Error(
      'This client cannot confirm the provider stop request. Refresh to a version with provider Stop acknowledgements.',
    )
  }
  const resolved = await acknowledgement
  if (
    !resolved
    || typeof resolved !== 'object'
    || (resolved as { invocationId?: unknown }).invocationId !== invocationId
    || !Number.isSafeInteger((resolved as { stateRevision?: unknown }).stateRevision)
    || (resolved as { stateRevision: number }).stateRevision < 1
  ) {
    throw new Error(
      'The client did not prove the provider stop applies to the current Work Room state. Refresh and try again.',
    )
  }
  return resolved as ProviderStopAcknowledgement
}

function providerInvocationStateRevision(invocation: unknown): number | undefined {
  const stateRevision = (invocation as { stateRevision?: unknown }).stateRevision
  return Number.isSafeInteger(stateRevision)
    && (stateRevision as number) > 0
    ? stateRevision as number
    : undefined
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
  executionProfile: ExecutionProfile
  /** Exact permission profiles advertised through React. */
  availablePermissionProfiles: ReadonlyArray<HostSessionModeState['availableModes'][number]>
  availableExecutionProfiles: ReadonlyArray<HostSessionModeState['availableModes'][number]>
  approvalPolicy: HostSessionModeState['policy']
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
  /** Stop one native coding-provider invocation only after its Host ACK. */
  interruptProvider: (invocationId: string) => Promise<ProviderStopAcknowledgement>
  /** Scoped provider Stop lifecycle, retained across Work Room close/reopen. */
  providerStopStates: ProviderStopStates
  respondToAskUser: (answer: string | string[]) => void
  respondToApproval: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  respondToPlanReview: (message: string) => void
  submitOnboard: (options: { inviteCode?: string; payment?: number }) => void
  setCollaborationMode: (mode: CollaborationMode) => void
  setPermissionProfile: (profile: PermissionProfile) => Promise<void>
  setExecutionProfile: (profile: ExecutionProfile) => Promise<void>
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
export function extractPendingStates(
  ui: ChatItem[],
  providerStopStates: ProviderStopStates = new Map(),
): { pendingAskUser: PendingAskUser | null, pendingApproval: PendingApproval | null, pendingOnboard: PendingOnboard | null, pendingFullAccessCheckpoint: PendingFullAccessCheckpoint | null, pendingPlanReview: PendingPlanReview | null } {
  let pendingAskUser: PendingAskUser | null = null
  let pendingApproval: PendingApproval | null = null
  let pendingOnboard: PendingOnboard | null = null
  let pendingFullAccessCheckpoint: PendingFullAccessCheckpoint | null = null
  let pendingPlanReview: PendingPlanReview | null = null
  const toolStatuses = new Map<string, string>()
  const providerStatuses = new Map<string, string>()
  let pendingApprovalItem: ApprovalItem | null = null
  let hasOnboardSuccess = false

  for (const item of ui) {
    if (item.type === 'tool_call') {
      toolStatuses.set(item.name.toLowerCase(), item.status)
    } else if (item.type === 'provider_invocation') {
      providerStatuses.set(item.id, item.status)
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
        pendingApprovalItem = null
        continue
      }
      pendingApprovalItem = item
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

  if (pendingApprovalItem) {
    const providerApproval = nativeProviderApproval(pendingApprovalItem)
    const providerPresentation = nativeProviderApprovalPresentation(pendingApprovalItem)
    const providerStatus = providerApproval
      ? providerStatuses.get(providerApproval.providerInvocationId!)
      : undefined
    const toolStatus = toolStatuses.get(pendingApprovalItem.tool.split(':')[0].toLowerCase())
    const providerStateIsUnconfirmed = Boolean(
      providerApproval?.providerInvocationId
      && providerStopStates.has(providerApproval.providerInvocationId),
    )
    // A native-provider approval envelope can arrive before the matching
    // lifecycle update. The provider invocation is authoritative: do not tell
    // the reader it is their move until it explicitly parks at
    // `awaiting_approval`. Otherwise the card can say "Working" while the
    // composer says "Answer above" and points to no actionable decision.
    const requiresReaderDecision = providerApproval
      ? !providerStateIsUnconfirmed && providerStatus === 'awaiting_approval'
      : toolStatus === 'running' || toolStatus === undefined
    if (requiresReaderDecision) {
      pendingApproval = {
        id: pendingApprovalItem.id,
        tool: pendingApprovalItem.tool,
        arguments: pendingApprovalItem.arguments,
        ...(pendingApprovalItem.description && { description: pendingApprovalItem.description }),
        ...(pendingApprovalItem.batch_remaining && { batch_remaining: pendingApprovalItem.batch_remaining }),
        ...(providerApproval || {}),
        ...(providerPresentation || {}),
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
    executionProfile,
    availablePermissionProfiles = [],
    availableExecutionProfiles = [],
    approvalPolicy = null,
    permissionProfileChangePending: sdkPermissionProfileChangePending = false,
    fullAccessTurns,
    fullAccessTurnsUsed,
    sendMessage,
    respondToApproval: sdkRespondToApproval,
    interrupt: sdkInterrupt,
    interruptProvider: sdkInterruptProvider,
    signOnboard,
    setCollaborationMode: setSDKCollaborationMode,
    setPermissionProfile: setSDKPermissionProfile,
    setExecutionProfile: setSDKExecutionProfile,
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
  const lastExecutionRequest = useRef<ExecutionProfile | null>(null)
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
  // A Stop has three distinct reader-facing states. `acknowledged` is not an
  // error: the Host owns the request, but the provider still owes a terminal
  // lifecycle frame. Collapsing it into `unconfirmed` made closing Work Room
  // turn a calm acknowledged request into a red error.
  const [providerStopStates, setProviderStopStates] = useState<ProviderStopStates>(
    () => new Map(),
  )
  const providerStopTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  // A phase alone cannot distinguish a replayed `running` snapshot from a
  // newer provider lifecycle. Keep the Host-acknowledged revision outside the
  // transcript so reopening Work Room preserves the same safe barrier.
  const providerStopAcknowledgedRevisions = useRef(new Map<string, number>())
  const setProviderStopPhase = useCallback((invocationId: string, phase: ProviderStopPhase) => {
    setProviderStopStates((previous) => {
      if (previous.get(invocationId) === phase) return previous
      const next = new Map(previous)
      next.set(invocationId, phase)
      return next
    })
  }, [])
  const interruptProvider = useCallback(async (invocationId: string) => {
    const previousTimer = providerStopTimers.current.get(invocationId)
    if (previousTimer) clearTimeout(previousTimer)
    setProviderStopPhase(invocationId, 'requesting')
    try {
      const acknowledgement = await awaitProviderStopAcknowledgement(
        sdkInterruptProvider,
        invocationId,
      )
      providerStopAcknowledgedRevisions.current.set(
        invocationId,
        acknowledgement.stateRevision,
      )
      setProviderStopPhase(invocationId, 'acknowledged')
      const timer = setTimeout(() => {
        providerStopTimers.current.delete(invocationId)
        setProviderStopStates((previous) => {
          if (previous.get(invocationId) !== 'acknowledged') return previous
          const next = new Map(previous)
          next.set(invocationId, 'unconfirmed')
          return next
        })
      }, PROVIDER_STOP_CONFIRMATION_TIMEOUT_MS)
      providerStopTimers.current.set(invocationId, timer)
      return acknowledgement
    } catch (caught) {
      setProviderStopPhase(invocationId, 'unconfirmed')
      throw caught
    }
  }, [sdkInterruptProvider, setProviderStopPhase])

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
  const terminalProviderInvocationIds = useMemo(() => new Set(
    cleanUI.flatMap((item) => item.type === 'provider_invocation'
      && (item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled')
      ? [item.id]
      : []),
  ), [cleanUI])
  const refreshedProviderInvocationIds = useMemo(() => new Set(
    cleanUI.flatMap((item) => {
      if (item.type !== 'provider_invocation') return []
      const acknowledgedRevision = providerStopAcknowledgedRevisions.current.get(item.id)
      const stateRevision = providerInvocationStateRevision(item)
      return (
        acknowledgedRevision !== undefined
        && stateRevision !== undefined
        && stateRevision > acknowledgedRevision
      ) ? [item.id] : []
    }),
  ), [cleanUI, providerStopStates])
  const settledProviderStopInvocationIds = useMemo(() => new Set([
    ...terminalProviderInvocationIds,
    ...refreshedProviderInvocationIds,
  ]), [terminalProviderInvocationIds, refreshedProviderInvocationIds])
  // The transcript is append-only. Derive the reader-facing lifecycle map from
  // the latest provider state instead of scheduling a second render merely to
  // delete terminal IDs. A terminal frame restores ordinary controls at once.
  const actionableProviderStopStates = useMemo(() => {
    if (!settledProviderStopInvocationIds.size) return providerStopStates
    return new Map(
      [...providerStopStates]
        .filter(([invocationId]) => !settledProviderStopInvocationIds.has(invocationId)),
    )
  }, [providerStopStates, settledProviderStopInvocationIds])

  useEffect(() => {
    if (!settledProviderStopInvocationIds.size) return
    for (const invocationId of settledProviderStopInvocationIds) {
      const timer = providerStopTimers.current.get(invocationId)
      if (timer) clearTimeout(timer)
      providerStopTimers.current.delete(invocationId)
      providerStopAcknowledgedRevisions.current.delete(invocationId)
    }
    setProviderStopStates((previous) => {
      let changed = false
      const next = new Map(previous)
      for (const invocationId of settledProviderStopInvocationIds) {
        changed = next.delete(invocationId) || changed
      }
      return changed ? next : previous
    })
  }, [settledProviderStopInvocationIds])

  useEffect(() => () => {
    for (const timer of providerStopTimers.current.values()) clearTimeout(timer)
    providerStopTimers.current.clear()
    providerStopAcknowledgedRevisions.current.clear()
  }, [])
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
    () => extractPendingStates(cleanUI, actionableProviderStopStates),
    [cleanUI, actionableProviderStopStates]
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
    lastExecutionRequest.current = null
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

  const setExecutionProfile = useCallback(async (newProfile: ExecutionProfile) => {
    if (permissionProfileRequestInFlight.current) return
    permissionProfileRequestInFlight.current = true
    lastExecutionRequest.current = newProfile
    lastPermissionRequest.current = null
    setLocalPermissionProfilePending(true)
    setPermissionProfileChangeError(null)
    setPermissionProfileRecovery(null)
    try {
      if (newProfile !== executionProfile) await setSDKExecutionProfile(newProfile)
    } catch (caught) {
      const profileError = caught instanceof Error ? caught : new Error(String(caught))
      ownedPermissionProfileErrors.current.add(profileError.message)
      setPermissionProfileChangeError(profileError.message || 'Unable to change execution mode')
      setPermissionProfileRecovery(permissionProfileRecoveryAction(profileError))
    } finally {
      permissionProfileRequestInFlight.current = false
      setLocalPermissionProfilePending(false)
    }
  }, [executionProfile, setSDKExecutionProfile])

  const retryPermissionProfileChange = useCallback(() => {
    if (permissionProfileRecovery === 'reconnect') {
      setPermissionProfileChangeError(null)
      setPermissionProfileRecovery(null)
      sdkReconnect()
      return
    }
    if (lastPermissionRequest.current) {
      void setPermissionProfile(lastPermissionRequest.current)
    } else if (lastExecutionRequest.current) {
      void setExecutionProfile(lastExecutionRequest.current)
    }
  }, [permissionProfileRecovery, sdkReconnect, setExecutionProfile, setPermissionProfile])

  // Clear/reset
  const clear = useCallback(() => {
    setDismissedFullAccessCheckpointId(null)
    for (const timer of providerStopTimers.current.values()) clearTimeout(timer)
    providerStopTimers.current.clear()
    providerStopAcknowledgedRevisions.current.clear()
    setProviderStopStates(new Map())
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
    executionProfile,
    availablePermissionProfiles,
    availableExecutionProfiles,
    approvalPolicy,
    permissionProfileChangePending,
    permissionProfileChangeError,
    permissionProfileRecoveryAction: permissionProfileRecovery,
    fullAccessTurns: fullAccessTurns ?? null,
    fullAccessTurnsUsed: fullAccessTurnsUsed ?? null,
    fullAccessTurnsRemaining: fullAccessTurns != null && fullAccessTurnsUsed != null ? fullAccessTurns - fullAccessTurnsUsed : null,
    send,
    retry,
    interrupt,
    interruptProvider,
    providerStopStates: actionableProviderStopStates,
    respondToAskUser,
    respondToApproval,
    respondToPlanReview,
    submitOnboard,
    setCollaborationMode,
    setPermissionProfile,
    setExecutionProfile,
    retryPermissionProfileChange,
    checkSessionStatus,
    reconnect: sdkReconnect,
    connect,
    dashboardHtml,
    profile,
    clear,
  }
}
