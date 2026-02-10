'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAgent, type ChatItem } from 'connectonion/react'
import type { PendingAskUser, PendingApproval, PendingOnboard } from './types'

// Re-export ChatItem as UI for compatibility
export type UI = ChatItem

interface UseAgentSDKOptions {
  agentAddress: string
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
  currentSession: CurrentSession | null
  send: (content: string) => Promise<void>
  respondToAskUser: (answer: string | string[]) => void
  respondToApproval: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  submitOnboard: (options: { inviteCode?: string; payment?: number }) => void
  clear: () => void
}

/**
 * Extract pending states from SDK UI.
 */
function extractPendingStates(ui: ChatItem[]): { pendingAskUser: PendingAskUser | null, pendingApproval: PendingApproval | null, pendingOnboard: PendingOnboard | null } {
  let pendingAskUser: PendingAskUser | null = null
  let pendingApproval: PendingApproval | null = null
  let pendingOnboard: PendingOnboard | null = null
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
    }
  }

  return { pendingAskUser, pendingApproval, pendingOnboard }
}

export function useAgentSDK(options: UseAgentSDKOptions): UseAgentSDKReturn {
  const { agentAddress, onComplete, onError } = options

  // Elapsed time tracking
  const [elapsedTime, setElapsedTime] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const prevStatusRef = useRef<'idle' | 'working' | 'waiting'>('idle')

  // Use SDK's useAgent with agent address — SDK handles relay + auto-discovery
  const {
    status,
    ui,
    sessionId,
    input,
    reset,
    isProcessing,
    error,
    respond: sdkRespond,
    respondToApproval: sdkRespondToApproval,
    submitOnboard: sdkSubmitOnboard,
  } = useAgent(agentAddress)

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

  // Extract pending states from UI
  const { pendingAskUser, pendingApproval, pendingOnboard } = useMemo(
    () => extractPendingStates(ui),
    [ui]
  )

  // Send message
  const send = useCallback(async (content: string) => {
    startTimeRef.current = Date.now() // Start timer
    await input(content)
  }, [input])

  // Respond to ask_user
  const respondToAskUser = useCallback((answer: string | string[]) => {
    sdkRespond(answer)
  }, [sdkRespond])

  // Respond to approval_needed
  const respondToApproval = useCallback((approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => {
    sdkRespondToApproval(approved, scope, mode, feedback)
  }, [sdkRespondToApproval])

  // Submit onboard credentials
  const submitOnboard = useCallback((options: { inviteCode?: string; payment?: number }) => {
    sdkSubmitOnboard(options)
  }, [sdkSubmitOnboard])

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
    currentSession,
    send,
    respondToAskUser,
    respondToApproval,
    submitOnboard,
    clear,
  }
}
