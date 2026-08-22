'use client'

import { cn } from './utils'

export type ActivityPhase =
  | 'idle'
  | 'connected'
  | 'working'
  | 'awaiting_approval'
  | 'awaiting_input'
  | 'awaiting_authorization'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

export function deriveActivityPhase({
  connectionError,
  sessionState,
  pendingApproval,
  pendingAskUser,
  pendingOnboard,
  isLoading,
}: {
  connectionError?: string | null
  sessionState?: 'idle' | 'connected' | 'active' | 'disconnected' | 'reconnecting'
  pendingApproval?: unknown
  pendingAskUser?: unknown
  pendingOnboard?: unknown
  isLoading?: boolean
}): ActivityPhase {
  if (connectionError) return 'error'
  if (sessionState === 'disconnected') return 'disconnected'
  if (sessionState === 'reconnecting') return 'reconnecting'
  if (pendingOnboard) return 'awaiting_authorization'
  if (pendingApproval) return 'awaiting_approval'
  if (pendingAskUser) return 'awaiting_input'
  if (isLoading) return 'working'
  if (sessionState === 'active' || sessionState === 'connected') return 'connected'
  return 'idle'
}

const COPY: Record<ActivityPhase, { label: string; detail: string }> = {
  idle: { label: 'Idle', detail: 'Send a message to start.' },
  connected: { label: 'Connected', detail: 'Ready for a new message.' },
  working: { label: 'Working', detail: 'The agent is processing the current task.' },
  awaiting_approval: { label: 'Approval needed', detail: 'The current task is waiting for your decision.' },
  awaiting_input: { label: 'Input needed', detail: 'The current task is waiting for your answer.' },
  awaiting_authorization: { label: 'Authorization needed', detail: 'Authorize this client to continue.' },
  reconnecting: { label: 'Reconnecting', detail: 'Restoring the current session.' },
  disconnected: { label: 'Disconnected', detail: 'The current session is not connected.' },
  error: { label: 'Error', detail: 'The current session needs attention.' },
}

export function ActivityStatus({
  phase,
  compact = false,
  onReconnect,
}: {
  phase: ActivityPhase
  compact?: boolean
  onReconnect?: () => void
}) {
  const copy = COPY[phase]
  const isAttention = phase.startsWith('awaiting_')
  const isWorking = phase === 'working' || phase === 'reconnecting'
  const isError = phase === 'error'

  return (
    <div
      role="status"
      data-activity-phase={phase}
      className={cn(
        'flex min-w-0 items-center gap-2',
        compact ? 'text-[11px]' : 'border-b border-neutral-200 bg-white px-3 py-2.5',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          isError ? 'bg-red-500' : isAttention ? 'animate-pulse bg-neutral-500' : isWorking ? 'animate-pulse bg-brand-500' : 'bg-neutral-400',
        )}
      />
      <span className={cn('shrink-0 font-medium', isError ? 'text-red-600' : isAttention ? 'text-neutral-700' : isWorking ? 'text-brand-700' : 'text-neutral-600')}>
        {copy.label}
      </span>
      {!compact && <span className="min-w-0 truncate text-xs text-neutral-500">{copy.detail}</span>}
      {phase === 'disconnected' && onReconnect && (
        <button onClick={onReconnect} className="ml-auto min-h-11 shrink-0 px-2 text-xs text-neutral-600 underline">
          reconnect
        </button>
      )}
    </div>
  )
}
