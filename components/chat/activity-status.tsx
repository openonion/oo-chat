'use client'

import { cn } from './utils'
import { statusWord } from './status-pill'

export type ActivityPhase =
  | 'connecting'
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
  sessionState?: 'idle' | 'connecting' | 'connected' | 'active' | 'disconnected' | 'reconnecting'
  pendingApproval?: unknown
  pendingAskUser?: unknown
  pendingOnboard?: unknown
  isLoading?: boolean
}): ActivityPhase {
  if (sessionState === 'connecting') return 'connecting'
  if (sessionState === 'disconnected') return 'disconnected'
  if (sessionState === 'reconnecting') return 'reconnecting'
  if (connectionError) return 'error'
  if (pendingOnboard) return 'awaiting_authorization'
  if (pendingApproval) return 'awaiting_approval'
  if (pendingAskUser) return 'awaiting_input'
  if (isLoading) return 'working'
  if (sessionState === 'active' || sessionState === 'connected') return 'connected'
  return 'idle'
}

// Design standard §4: presence words for the connection, run words for the task.
const COPY: Record<ActivityPhase, { label: string; detail: string }> = {
  connecting: { label: 'Connecting…', detail: 'Opening the current session.' },
  idle: { label: 'Online', detail: 'Send a message to start.' },
  connected: { label: 'Online', detail: 'Ready for a new message.' },
  working: { label: statusWord('running'), detail: 'The agent is working on the current task.' },
  awaiting_approval: { label: statusWord('needs-approval'), detail: 'The current task is waiting for your decision.' },
  awaiting_input: { label: statusWord('needs-input'), detail: 'The current task is waiting for your answer.' },
  awaiting_authorization: { label: statusWord('needs-sign-in'), detail: 'Authorize this client to continue.' },
  reconnecting: { label: 'Connecting…', detail: 'Restoring the current session.' },
  disconnected: { label: 'Offline', detail: 'The current session is not connected.' },
  error: { label: "Can't connect", detail: 'The current session needs attention.' },
}

/** The mark beside the word: it supports the word, never replaces it. */
function PhaseMark({ phase }: { phase: ActivityPhase }) {
  if (phase.startsWith('awaiting_')) return <span aria-hidden="true" className="w-1.5 shrink-0 text-center text-xs font-bold text-co-warning">!</span>
  if (phase === 'error') return <span aria-hidden="true" className="w-1.5 shrink-0 text-center text-xs font-bold text-co-danger">✕</span>
  if (phase === 'disconnected') return <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-co-neutral ring-inset" />
  return (
    <span aria-hidden="true" className={cn(
      'h-1.5 w-1.5 shrink-0 rounded-full',
      phase === 'connecting' || phase === 'reconnecting' ? 'bg-co-neutral motion-safe:animate-pulse'
        : phase === 'working' ? 'bg-co-green-text motion-safe:animate-pulse' : 'bg-co-green-text',
    )} />
  )
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
  const isError = phase === 'error'

  return (
    <div
      role="status"
      data-activity-phase={phase}
      className={cn(
        'flex min-w-0 items-center gap-2',
        compact ? 'text-xs' : 'border-b border-neutral-200 bg-white px-4 py-2.5 text-[13px]',
      )}
    >
      <PhaseMark phase={phase} />
      <span className={cn('shrink-0', compact ? 'font-medium' : 'font-semibold', isError ? 'text-co-danger' : isAttention ? 'text-co-warning' : 'text-neutral-800')}>
        {copy.label}
      </span>
      {!compact && <span className="min-w-0 truncate text-xs text-neutral-600">{copy.detail}</span>}
      {(phase === 'disconnected' || phase === 'error') && onReconnect && (
        <button onClick={onReconnect} className="ml-auto min-h-11 shrink-0 rounded-lg px-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100">
          {phase === 'error' ? 'Retry' : 'Reconnect'}
        </button>
      )}
    </div>
  )
}
