'use client'

import { useState } from 'react'
import type { ToolCallUI, PendingApproval } from '../../types'
import { HiOutlineChevronRight, HiOutlineX } from 'react-icons/hi'
import { ApprovalButtons } from './approval-buttons'
import { redact } from './redact'

interface GenericCardProps {
  toolCall: ToolCallUI
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
}

function formatTime(ms: number): string {
  const seconds = ms / 1000
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
}

function formatArgs(args?: Record<string, unknown>): string {
  if (!args) return ''
  const values = Object.values(args)
    .filter(v => v !== undefined && v !== null)
    .map(v => redact(String(v)))
  if (values.length === 0) return ''
  const joined = values.join(', ')
  return joined.length > 80 ? joined.slice(0, 77) + '...' : joined
}

export function GenericCard({ toolCall, pendingApproval, onApprovalResponse }: GenericCardProps) {
  const { name, args, status, result, timing_ms } = toolCall
  const [isExpanded, setIsExpanded] = useState(false)
  const [approvalSent, setApprovalSent] = useState<'approved' | 'approved_session' | 'skipped' | 'stopped' | null>(null)

  const needsApproval = !!pendingApproval && !!onApprovalResponse

  const handleApproval = (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain') => {
    if (approvalSent) return
    if (approved) {
      setApprovalSent(scope === 'session' ? 'approved_session' : 'approved')
    } else {
      setApprovalSent(mode === 'reject_soft' ? 'skipped' : 'stopped')
    }
    onApprovalResponse?.(approved, scope, mode)
  }

  const argsStr = formatArgs(args)
  const hasOutput = result && result.length > 0
  const outputLines = result?.split('\n').length || 0

  const isError = status === 'error'
  const rejected = approvalSent === 'skipped' || approvalSent === 'stopped'

  return (
    <div>
      {/* Header — single-height ledger row: verb, one-line detail, right-pinned meta */}
      <div
        className={`flex h-7 items-center gap-1.5 cursor-pointer select-none rounded-md px-1.5 -mx-1.5 py-1 -my-1 ${isError ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-neutral-100/70'}`}
        onClick={() => (hasOutput || needsApproval) && setIsExpanded(!isExpanded)}
      >
        {(hasOutput || needsApproval) ? (
          <HiOutlineChevronRight className={`w-3 h-3 shrink-0 text-neutral-300 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Status slot: quiet when done, pulsing dot while live, red X on error/rejection */}
        {isError || (status === 'running' && rejected) ? (
          <HiOutlineX className="w-4 h-4 shrink-0 text-red-500" />
        ) : status === 'running' ? (
          <span className={`mx-[5px] h-1.5 w-1.5 shrink-0 rounded-full animate-pulse ${needsApproval && !approvalSent ? 'bg-neutral-400' : 'bg-brand-500'}`} />
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <span className={`text-[13px] font-medium shrink-0 whitespace-nowrap ${isError ? 'text-red-600' : 'text-neutral-800'}`}>{name}</span>
        {argsStr && <span className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-500">{argsStr}</span>}

        <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] tabular-nums text-neutral-400">
          {status === 'done' || status === 'error' ? (
            <>
              {!isExpanded && outputLines > 1 && `${outputLines} lines · `}
              {timing_ms ? formatTime(timing_ms) : null}
            </>
          ) : needsApproval && approvalSent ? (
            approvalSent === 'skipped' ? 'skipped'
              : approvalSent === 'stopped' ? <span className="text-red-500 font-medium">stopped</span>
              : <span className="font-medium text-neutral-500">approved — running…</span>
          ) : needsApproval ? (
            <span className="font-medium text-neutral-500">awaiting approval</span>
          ) : (
            'running…'
          )}
        </span>
      </div>

      {/* Collapsed error rows surface the failure reason inline — one truncated line */}
      {isError && hasOutput && !isExpanded && (
        <div className="ml-7 mb-1 truncate text-xs text-red-600/80">{result.split('\n')[0]}</div>
      )}

      {/* Approval - separate from tool display */}
      {needsApproval && status === 'running' && (
        <div className="mt-2 ml-5 mb-2">
          <ApprovalButtons approvalSent={approvalSent} onApproval={handleApproval} toolName={name} description={pendingApproval?.description} batchRemaining={pendingApproval?.batch_remaining} />
        </div>
      )}

      {/* Output */}
      {!needsApproval && hasOutput && isExpanded && (
        <div className="mb-1 ml-7 overflow-hidden rounded-md border border-neutral-200 bg-white">
          <div className={`px-2.5 py-2 ${isError ? 'bg-red-50/50' : ''}`}>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">Result</div>
            <pre className={`whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-72 overflow-y-auto ${isError ? 'text-red-700' : 'text-neutral-700'}`}>
              {result}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
