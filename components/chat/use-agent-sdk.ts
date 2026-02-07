'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAgent, type UIEvent } from 'connectonion/react'
import type { PendingAskUser, PendingApproval, PendingOnboard, UI } from './types'

interface UseAgentSDKOptions {
  agentUrl: string
  onComplete?: (result: string) => void
  onError?: (error: string) => void
}

/** Session state for compatibility with page.tsx */
interface CurrentSession {
  session_id: string
}

interface UseAgentSDKReturn {
  ui: UI[]
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
 * Convert SDK UI to oo-chat UI format and extract pending states.
 */
function convertSDKUI(sdkUI: UIEvent[]): { ui: UI[], pendingAskUser: PendingAskUser | null, pendingApproval: PendingApproval | null, pendingOnboard: PendingOnboard | null } {
  const ui: UI[] = []
  let pendingAskUser: PendingAskUser | null = null
  let pendingApproval: PendingApproval | null = null
  let pendingOnboard: PendingOnboard | null = null
  const toolStatuses = new Map<string, string>()
  let hasOnboardSuccess = false

  for (const item of sdkUI) {
    switch (item.type) {
      case 'user':
        ui.push({
          id: item.id,
          type: 'user',
          content: item.content,
        })
        break

      case 'agent':
        ui.push({
          id: item.id,
          type: 'agent',
          content: item.content,
        })
        break

      case 'thinking': {
        const thinkingItem = item as unknown as {
          content?: string
          kind?: string
          status?: 'running' | 'done' | 'error'
          model?: string
          duration_ms?: number
          context_percent?: number
          usage?: {
            input_tokens?: number
            output_tokens?: number
            prompt_tokens?: number
            completion_tokens?: number
            total_tokens?: number
            cost?: number
          }
        }
        ui.push({
          id: item.id,
          type: 'thinking',
          status: thinkingItem.status || 'done',
          content: thinkingItem.content,
          kind: thinkingItem.kind as 'intent' | 'plan' | 'reflect' | undefined,
          model: thinkingItem.model,
          duration_ms: thinkingItem.duration_ms,
          context_percent: thinkingItem.context_percent,
          usage: thinkingItem.usage,
        })
        break
      }

      case 'tool_call':
        ui.push({
          id: item.id,
          type: 'tool_call',
          name: item.name,
          args: item.args,
          status: item.status,
          result: item.result,
          timing_ms: item.timing_ms,
        })
        // Track tool statuses to check against approval_needed
        toolStatuses.set(item.name.toLowerCase(), item.status)
        break

      case 'ask_user':
        ui.push({
          id: item.id,
          type: 'ask_user',
          text: item.text,
        })
        pendingAskUser = {
          question: item.text,
          options: item.options,
          multi_select: item.multi_select,
        }
        break

      case 'approval_needed': {
        const approvalItem = item as unknown as { tool: string; arguments: Record<string, unknown>; description?: string; batch_remaining?: Array<{ tool: string; arguments: string }> }
        ui.push({
          id: item.id,
          type: 'approval_needed',
          tool: approvalItem.tool,
          arguments: approvalItem.arguments,
          ...(approvalItem.description && { description: approvalItem.description }),
          ...(approvalItem.batch_remaining && { batch_remaining: approvalItem.batch_remaining }),
        })
        // Only set pendingApproval if the tool is still running
        // Backend sends approval key as "bash:uname" format — match base name before ":"
        const toolStatus = toolStatuses.get(approvalItem.tool.split(':')[0].toLowerCase())
        if (toolStatus === 'running' || toolStatus === undefined) {
          pendingApproval = {
            tool: approvalItem.tool,
            arguments: approvalItem.arguments,
            ...(approvalItem.description && { description: approvalItem.description }),
            ...(approvalItem.batch_remaining && { batch_remaining: approvalItem.batch_remaining }),
          }
        }
        break
      }

      case 'onboard_required': {
        const onboardItem = item as unknown as { methods: string[], paymentAmount?: number }
        ui.push({
          id: item.id,
          type: 'onboard_required',
          methods: onboardItem.methods,
          paymentAmount: onboardItem.paymentAmount,
        })
        // Only set pending if no success yet
        if (!hasOnboardSuccess) {
          pendingOnboard = {
            methods: onboardItem.methods,
            paymentAmount: onboardItem.paymentAmount,
          }
        }
        break
      }

      case 'onboard_success': {
        const successItem = item as unknown as { level: string, message: string }
        ui.push({
          id: item.id,
          type: 'onboard_success',
          level: successItem.level,
          message: successItem.message,
        })
        hasOnboardSuccess = true
        pendingOnboard = null
        break
      }

      case 'intent': {
        const intentItem = item as unknown as { status: 'analyzing' | 'understood', ack?: string, is_build?: boolean }
        ui.push({
          id: item.id,
          type: 'intent',
          status: intentItem.status,
          ack: intentItem.ack,
          is_build: intentItem.is_build,
        })
        break
      }

      case 'eval': {
        const evalItem = item as unknown as { status: 'evaluating' | 'done', passed?: boolean, summary?: string, expected?: string, eval_path?: string }
        ui.push({
          id: item.id,
          type: 'eval',
          status: evalItem.status,
          passed: evalItem.passed,
          summary: evalItem.summary,
          expected: evalItem.expected,
          eval_path: evalItem.eval_path,
        })
        break
      }

      case 'compact': {
        const compactItem = item as unknown as { status: 'compacting' | 'done' | 'error', context_before?: number, context_after?: number, context_percent?: number, message?: string, error?: string }
        ui.push({
          id: item.id,
          type: 'compact',
          status: compactItem.status,
          context_before: compactItem.context_before,
          context_after: compactItem.context_after,
          context_percent: compactItem.context_percent,
          message: compactItem.message,
          error: compactItem.error,
        })
        break
      }
    }
  }

  return { ui, pendingAskUser, pendingApproval, pendingOnboard }
}

export function useAgentSDK(options: UseAgentSDKOptions): UseAgentSDKReturn {
  const { agentUrl, onComplete, onError } = options

  // Elapsed time tracking
  const [elapsedTime, setElapsedTime] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const prevStatusRef = useRef<'idle' | 'working' | 'waiting'>('idle')

  // Use SDK's useAgent with directUrl for deployed agents
  const {
    status,
    ui: sdkUI,
    sessionId,
    input,
    reset,
    isProcessing,
    error,
    respond: sdkRespond,
    respondToApproval: sdkRespondToApproval,
    submitOnboard: sdkSubmitOnboard,
  } = useAgent('deployed-agent', {
    directUrl: agentUrl,
  })

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
      const lastAgent = sdkUI.filter(e => e.type === 'agent').pop()
      if (lastAgent && 'content' in lastAgent) {
        onComplete?.(lastAgent.content)
      }
    }

    prevStatusRef.current = status
  }, [status, sdkUI, error, onComplete])

  // Handle errors
  useEffect(() => {
    if (error) {
      onError?.(error.message)
    }
  }, [error, onError])

  // Convert SDK UI to oo-chat UI format
  const { ui, pendingAskUser, pendingApproval, pendingOnboard } = useMemo(
    () => convertSDKUI(sdkUI),
    [sdkUI]
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
  const isConnected = status !== 'idle' || sdkUI.length > 0

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
