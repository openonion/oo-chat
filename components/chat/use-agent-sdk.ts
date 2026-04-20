'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAgentForHuman, type ChatItem, type ApprovalMode, type OutgoingMessage } from 'connectonion/react'
import type { PendingAskUser, PendingApproval, PendingOnboard, PendingUlwTurnsReached, PendingPlanReview } from './types'

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
  elapsedTime: number
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
      pendingAskUser = {
        question: item.text,
        options: item.options,
        multi_select: item.multi_select,
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

    if ((item as any).type === 'plan_review') {
      pendingPlanReview = {
        plan_content: (item as any).plan_content,
      }
    }
  }

  return { pendingAskUser, pendingApproval, pendingOnboard, pendingUlwTurnsReached, pendingPlanReview }
}

export function useAgentSDK(options: UseAgentSDKOptions): UseAgentSDKReturn {
  const { agentAddress, sessionId, onComplete, onError } = options

  // Elapsed time tracking
  const [elapsedTime, setElapsedTime] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const prevStatusRef = useRef<'idle' | 'working' | 'waiting'>('idle')
  const pendingSendRef = useRef<{
    content: string
    images?: string[]
    files?: import('./types').FileAttachment[]
    retriedAuth: boolean
  } | null>(null)

  // Use SDK's useAgentForHuman with agent address and sessionId
  const {
    status,
    connectionState,
    ui,
    sessionId: _sessionId,
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

  // Do not import `connect` from `connectonion` here — it pulls Node-only modules (readline/fs) into the client bundle.
  // Map WebSocket SESSION_STATUS (checkSessionStatus) to the same shape the UI used with HTTP checkSession.
  const checkSession = useCallback(async (): Promise<'running' | 'done' | 'not_found'> => {
    try {
      const s = await checkSessionStatus(sessionId)
      if (s === 'executing') return 'running'
      if (s === 'not_found') return 'not_found'
      return 'done'
    } catch {
      return 'not_found'
    }
  }, [checkSessionStatus, sessionId])

  // Timer effect for elapsed time display
  useEffect(() => {
    if (!isProcessing) {
      setElapsedTime(0)
      startTimeRef.current = null
      return
    }

    // Start timer when processing begins
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now()
    }

    const interval = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedTime(Date.now() - startTimeRef.current)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [isProcessing])

  // Poll session liveness when idle (for reconnect UI). Uses checkSessionStatus → extra WebSocket.
  // Must NOT run while the main RemoteAgent is in CONNECT auth: a second socket races _ensureConnected()
  // and triggers "Connection lost during authentication". Delay first poll; skip when WS already up.
  // Only poll after user was just connected (processing → idle); don't poll expired sessions on load.
  const [serverSessionAlive, setServerSessionAlive] = useState(false)
  const wasProcessingRef = useRef(false)
  const checkSessionStatusRef = useRef(checkSessionStatus)
  checkSessionStatusRef.current = checkSessionStatus

  useEffect(() => {
    if (isProcessing) {
      wasProcessingRef.current = true
      setServerSessionAlive(true)
      return
    }
    if (connectionState === 'connected') {
      setServerSessionAlive(true)
      return
    }

    // Only poll if we were just processing (user had an active session)
    if (!wasProcessingRef.current) return

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | undefined
    const check = async () => {
      const result = await checkSession()
      if (!cancelled) setServerSessionAlive(result === 'running')
    }
    // Delay first poll to avoid racing the main RemoteAgent's CONNECT auth with a second socket.
    const first = setTimeout(() => {
      if (cancelled) return
      check()
      intervalId = setInterval(check, 15000)
    }, 4000)

    return () => {
      cancelled = true
      clearTimeout(first)
      if (intervalId) clearInterval(intervalId)
    }
  }, [checkSession, isProcessing, connectionState])

  // Detect completion (when status changes from working/waiting to idle)
  useEffect(() => {
    if (prevStatusRef.current !== 'idle' && status === 'idle' && !error) {
      // Just completed successfully
      const lastAgent = ui.filter(e => e.type === 'agent').pop()
      if (lastAgent && 'content' in lastAgent) {
        onComplete?.(lastAgent.content)
      }
    }

    prevStatusRef.current = status
  }, [status, ui, error, onComplete])

  // Handle errors
  useEffect(() => {
    if (error) {
      onError?.(error.message)
    }
  }, [error, onError])

  // Work around WS auth race after ONBOARD_SUBMIT in current connectonion runtime:
  // if first INPUT is rejected before CONNECT state is established, reconnect and retry once.
  useEffect(() => {
    const msg = error?.message?.toLowerCase() ?? ''
    const isAuthRace =
      msg.includes('authenticate first') ||
      msg.includes('send connect') ||
      msg.includes('not authenticated')
    if (!isAuthRace) return

    const pending = pendingSendRef.current
    if (!pending || pending.retriedAuth) return

    pending.retriedAuth = true
    sdkReconnect()
    const retry = pending
    setTimeout(() => {
      input(retry.content, { images: retry.images, files: retry.files } as { images?: string[] })
    }, 600)
  }, [error, sdkReconnect, input])

  // Extract pending states from UI
  const { pendingAskUser, pendingApproval, pendingOnboard, pendingUlwTurnsReached, pendingPlanReview } = useMemo(
    () => extractPendingStates(ui),
    [ui]
  )

  // Send message
  const send = useCallback((content: string, images?: string[], files?: import('./types').FileAttachment[]) => {
    startTimeRef.current = Date.now() // Start timer
    pendingSendRef.current = { content, images, files, retriedAuth: false }
    // SDK type only declares { images } but accepts extra options at runtime; cast to allow files.
    input(content, { images, files } as { images?: string[] })
  }, [input])

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
    // Ensure we have a fresh authenticated CONNECT channel after onboarding.
    setTimeout(() => sdkReconnect(), 200)
  }, [sendMessage, signOnboard, sdkReconnect])

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
    setElapsedTime(0)
    startTimeRef.current = null
  }, [reset])

  // isConnected: SDK doesn't track this directly, infer from status
  const isConnected = status !== 'idle' || ui.length > 0

  // Build currentSession for compatibility with page.tsx
  const currentSession: CurrentSession | null = sessionId
    ? { session_id: sessionId }
    : null

  return {
    ui,
    isConnected,
    isLoading: isProcessing,
    elapsedTime,
    pendingAskUser,
    pendingApproval,
    pendingOnboard,
    pendingUlwTurnsReached,
    pendingPlanReview,
    sessionState: connectionState === 'reconnecting' ? 'reconnecting' as const
      : connectionState === 'connected' || isProcessing ? 'active' as const
      : serverSessionAlive ? 'disconnected' as const
      : ui.length > 0 ? 'connected' as const
      : 'idle' as const,
    currentSession,
    mode: mode || 'safe',
    ulwTurns: ulwTurns ?? null,
    ulwTurnsUsed: ulwTurnsUsed ?? null,
    ulwTurnsRemaining: ulwTurns != null && ulwTurnsUsed != null ? ulwTurns - ulwTurnsUsed : null,
    send,
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
