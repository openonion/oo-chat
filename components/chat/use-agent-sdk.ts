'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAgentForHuman, type ChatItem, type ApprovalMode } from 'connectonion/react'
import type { PendingAskUser, PendingApproval, PendingOnboard, PendingUlwTurnsReached, PendingPlanReview } from './types'
import { dedupeUI } from './dedupe-ui'

/** Session lifecycle state */
export type SessionActiveState = 'idle' | 'connected' | 'active' | 'disconnected' | 'reconnecting'

// Re-export ChatItem as UI for compatibility
export type UI = ChatItem

// Re-export ApprovalMode
export type { ApprovalMode } from 'connectonion/react'

interface UseAgentSDKOptions {
  agentAddress: string
  sessionId: string
  onComplete?: (result: string) => void
  onError?: (error: string) => void
}

/** Session state for compatibility with page.tsx */
interface CurrentSession {
  session_id: string
}

interface UseAgentSDKReturn {
  ui: ChatItem[]
  isConnected: boolean
  isLoading: boolean
  pendingAskUser: PendingAskUser | null
  pendingApproval: PendingApproval | null
  pendingOnboard: PendingOnboard | null
  pendingUlwTurnsReached: PendingUlwTurnsReached | null
  pendingPlanReview: PendingPlanReview | null
  sessionState: SessionActiveState
  currentSession: CurrentSession | null
  /** Current approval mode: 'safe' | 'plan' | 'accept_edits' | 'ulw' */
  mode: ApprovalMode
  /** ULW mode: max turns before pausing */
  ulwTurns: number | null
  /** ULW mode: turns used so far */
  ulwTurnsUsed: number | null
  /** ULW mode: turns remaining (max - used) */
  ulwTurnsRemaining: number | null
  send: (content: string, images?: string[], files?: import('./types').FileAttachment[]) => void
  /** Gracefully stop a running agent: it finishes the current step and returns a closing message */
  interrupt: () => void
  respondToAskUser: (answer: string | string[]) => void
  respondToApproval: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  respondToUlwTurnsReached: (action: 'continue' | 'switch_mode', options?: { turns?: number; mode?: ApprovalMode }) => void
  respondToPlanReview: (message: string) => void
  submitOnboard: (options: { inviteCode?: string; payment?: number }) => void
  /** Change approval mode */
  setMode: (mode: ApprovalMode, options?: { turns?: number }) => void
  /** Check server session status via WebSocket (checks active registry) */
  checkSessionStatus: (sessionId: string) => Promise<string>
  /** Reconnect to existing session to receive pending output */
  reconnect: () => void
  clear: () => void
}

/**
 * Extract pending states from SDK UI.
 */
function extractPendingStates(ui: ChatItem[]): { pendingAskUser: PendingAskUser | null, pendingApproval: PendingApproval | null, pendingOnboard: PendingOnboard | null, pendingUlwTurnsReached: PendingUlwTurnsReached | null, pendingPlanReview: PendingPlanReview | null } {
  let pendingAskUser: PendingAskUser | null = null
  let pendingApproval: PendingApproval | null = null
  let pendingOnboard: PendingOnboard | null = null
  let pendingUlwTurnsReached: PendingUlwTurnsReached | null = null
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
        }
      }
    } else if (item.type === 'onboard_success') {
      hasOnboardSuccess = true
      pendingOnboard = null
    } else if (item.type === 'ulw_turns_reached') {
      pendingUlwTurnsReached = {
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

  return { pendingAskUser, pendingApproval, pendingOnboard, pendingUlwTurnsReached, pendingPlanReview }
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
  const { agentAddress, sessionId, onComplete, onError } = options

  const prevStatusRef = useRef<'idle' | 'working' | 'waiting'>('idle')

  // Use SDK's useAgentForHuman with agent address and sessionId
  const {
    status,
    connectionState,
    ui,
    input,
    reset,
    isProcessing,
    error,
    checkSessionStatus,
    mode,
    ulwTurns,
    ulwTurnsUsed,
    sendMessage,
    signOnboard,
    setMode: sdkSetMode,
    reconnect: sdkReconnect,
  } = useAgentForHuman(agentAddress, sessionId)
  // Optimistic stop: set the instant the user clicks Stop, cleared when the run
  // actually ends (status → idle) or the user sends a new message. While set,
  // the UI renders as stopped even though the agent is still finishing its
  // current step server-side.
  const [stopRequested, setStopRequested] = useState(false)

  // Each connect attempt to a non-onboarded agent emits a fresh onboard_required
  // (new UUID, so dedupeUI keeps them all) — keep only the latest card.
  const cleanUI = useMemo(() => {
    let items = dedupeUI(ui as import('./types').UI[]) as ChatItem[]
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
    if (error) {
      onError?.(error.message)
    }
  }, [error, onError])

  // Extract pending states from UI
  const { pendingAskUser, pendingApproval, pendingOnboard, pendingUlwTurnsReached, pendingPlanReview } = useMemo(
    () => extractPendingStates(cleanUI),
    [cleanUI]
  )

  // Send message
  const send = useCallback((content: string, images?: string[], files?: import('./types').FileAttachment[]) => {
    setStopRequested(false)
    input(content, { images, files })
  }, [input])

  // Stop: the UI stops immediately (optimistic — spinners freeze, the input
  // returns to send mode), while the agent-side poll_interrupt handler drains
  // the INTERRUPT at the next iteration boundary, finishes the current step,
  // and returns a closing message that reconciles the transcript.
  // The INTERRUPT frame is only sent on a live socket (RemoteAgent.send throws
  // on a null socket), but the optimistic UI stop applies regardless, so a
  // restored session stuck showing "running" can also be dismissed.
  const interrupt = useCallback(() => {
    setStopRequested(true)
    if (connectionState === 'connected') {
      sendMessage({ type: 'INTERRUPT' })
    }
  }, [sendMessage, connectionState])

  const respondToAskUser = useCallback((answer: string | string[]) => {
    sendMessage({ type: 'ASK_USER_RESPONSE', answer: Array.isArray(answer) ? answer.join(', ') : answer })
  }, [sendMessage])

  const respondToApproval = useCallback((approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => {
    sendMessage({ type: 'APPROVAL_RESPONSE', approved, scope, ...(mode && { mode }), ...(feedback && { feedback }) })
  }, [sendMessage])

  const respondToPlanReview = useCallback((message: string) => {
    sendMessage({ type: 'PLAN_REVIEW_RESPONSE', message })
  }, [sendMessage])

  const submitOnboard = useCallback((options: { inviteCode?: string; payment?: number }) => {
    sendMessage(signOnboard(options))
  }, [sendMessage, signOnboard])

  const respondToUlwTurnsReached = useCallback((action: 'continue' | 'switch_mode', options?: { turns?: number; mode?: ApprovalMode }) => {
    sendMessage({
      type: 'ULW_RESPONSE', action,
      ...(action === 'continue' && options?.turns && { turns: options.turns }),
      ...(action === 'switch_mode' && options?.mode && { mode: options.mode }),
    })
  }, [sendMessage])

  // Change approval mode
  const setMode = useCallback((newMode: ApprovalMode, options?: { turns?: number }) => {
    if (typeof sdkSetMode === 'function') {
      sdkSetMode(newMode, options)
    } else {
      console.warn('setMode not available in SDK - rebuild connectonion-ts')
    }
  }, [sdkSetMode])

  // Clear/reset
  const clear = useCallback(() => {
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
    isConnected,
    isLoading,
    pendingAskUser,
    pendingApproval,
    pendingOnboard,
    pendingUlwTurnsReached,
    pendingPlanReview,
    sessionState: connectionState === 'reconnecting' ? 'reconnecting' as const
      : connectionState === 'connected' || isLoading ? 'active' as const
      : serverSessionAlive ? 'disconnected' as const
      : cleanUI.length > 0 ? 'connected' as const
      : 'idle' as const,
    currentSession,
    mode: mode || 'safe',
    ulwTurns: ulwTurns ?? null,
    ulwTurnsUsed: ulwTurnsUsed ?? null,
    ulwTurnsRemaining: ulwTurns != null && ulwTurnsUsed != null ? ulwTurns - ulwTurnsUsed : null,
    send,
    interrupt,
    respondToAskUser,
    respondToApproval,
    respondToUlwTurnsReached,
    respondToPlanReview,
    submitOnboard,
    setMode,
    checkSessionStatus,
    reconnect: sdkReconnect,
    clear,
  }
}
