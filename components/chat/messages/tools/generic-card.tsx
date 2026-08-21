'use client'

import { useState } from 'react'
import type { ToolCallUI, PendingApproval } from '../../types'
import { HiOutlineChevronRight } from 'react-icons/hi'
import { ApprovalButtons } from './approval-buttons'
import { KVRows, maybeParse } from './kv-rows'

interface GenericCardProps {
  toolCall: ToolCallUI
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
}

function formatTime(ms: number): string {
  const seconds = ms / 1000
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
}

function humanToolName(name: string): string {
  const readable = name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return readable || 'tool'
}

function visibleSummary(summary: unknown, name: string): string {
  if (typeof summary === 'string') {
    const bounded = summary.replace(/\s+/g, ' ').trim()
    if (bounded && bounded.length <= 240) return bounded
  }
  // Compatibility fallback describes only the observable action.
  return `Using ${humanToolName(name)}`
}

export function GenericCard({ toolCall, pendingApproval, onApprovalResponse }: GenericCardProps) {
  const { name, args, status, result, timing_ms, summary } = toolCall
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

  const hasArgs = args && Object.keys(args).length > 0
  const hasOutput = result && result.length > 0
  const actionSummary = visibleSummary(summary, name)

  const isError = status === 'error'
  const rejected = approvalSent === 'skipped' || approvalSent === 'stopped'
  const parsedResult = hasOutput ? maybeParse(result) : null

  return (
    <div>
      {/* Codex-style activity row: one status mark, one action, quiet inline metadata. */}
      <button
        type="button"
        className={`group flex min-h-12 w-fit max-w-full cursor-pointer select-none items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 ${isError ? 'hover:bg-red-50/60' : 'hover:bg-neutral-50'}`}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span
          aria-hidden="true"
          className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${isError || rejected ? 'bg-red-400' : status === 'running' ? 'animate-pulse bg-brand-500' : 'bg-emerald-500'}`}
        />
        <span className="min-w-0 text-sm leading-5">
          <span className={`font-medium ${isError ? 'text-red-600' : 'text-neutral-800'}`}>{actionSummary}</span>
          <span className="ml-2 whitespace-nowrap text-xs tabular-nums text-neutral-400">
          {status === 'done' || status === 'error' ? (
            timing_ms ? formatTime(timing_ms) : null
          ) : needsApproval && approvalSent ? (
            approvalSent === 'skipped' ? 'skipped'
              : approvalSent === 'stopped' ? 'stopped'
              : 'approved · running'
          ) : needsApproval ? (
            'awaiting approval'
          ) : (
            'running'
          )}
          </span>
        </span>
        <HiOutlineChevronRight className={`mt-1 h-4 w-4 shrink-0 text-neutral-300 transition-transform duration-150 group-hover:text-neutral-500 ${isExpanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Approval - separate from tool display */}
      {needsApproval && status === 'running' && (
        <div className="mb-2 ml-6 mt-1">
          <ApprovalButtons approvalSent={approvalSent} onApproval={handleApproval} toolName={name} description={pendingApproval?.description} batchRemaining={pendingApproval?.batch_remaining} />
        </div>
      )}

      {/* Tool name, raw arguments and results are inspectable, but collapsed by default. */}
      {isExpanded && (
        <div className="animate-in mb-2 ml-3 border-l border-neutral-200 py-1 pl-5">
          <div className="font-mono text-xs text-neutral-400">{name}</div>
            {hasArgs && (
              <div className="mt-2">
                <KVRows data={args} />
              </div>
            )}
        </div>
      )}

      {/* Output */}
      {hasOutput && isExpanded && (
        <div className="animate-in mb-2 ml-3 border-l border-neutral-200 pl-5">
          <div className="flex gap-2 py-1">
            <span className="shrink-0 font-mono text-xs text-neutral-300">└</span>
            <div className="min-w-0 flex-1">
            {typeof parsedResult === 'string' ? (
              <pre className={`whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-72 overflow-y-auto ${isError ? 'text-red-700' : 'text-neutral-700'}`}>
                {result}
              </pre>
            ) : (
              <KVRows data={parsedResult} />
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
