'use client'

import { useState } from 'react'
import type { ToolCallUI, PendingApproval } from '../../types'
import { HiOutlineChevronRight, HiOutlineChevronDown } from 'react-icons/hi'
import { ApprovalButtons } from './approval-buttons'

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
    .map(v => String(v))
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

  return (
    <div className="py-1.5">
      {/* Header */}
      <div
        className="flex items-center gap-2 cursor-pointer hover:bg-neutral-50 rounded px-1 -mx-1 font-mono text-sm"
        onClick={() => (hasOutput || needsApproval) && setIsExpanded(!isExpanded)}
      >
        {/* Expand icon */}
        {(hasOutput || needsApproval) ? (
          isExpanded ? (
            <HiOutlineChevronDown className="w-3 h-3 text-neutral-400" />
          ) : (
            <HiOutlineChevronRight className="w-3 h-3 text-neutral-400" />
          )
        ) : (
          <span className="w-3" />
        )}

        {/* Status - tool completion trumps approval state */}
        {status === 'done' && <span className="text-green-600">✓</span>}
        {status === 'error' && <span className="text-red-500">✗</span>}
        {status === 'running' && needsApproval && (approvalSent === 'skipped' || approvalSent === 'stopped') && <span className="text-red-500">✗</span>}
        {status === 'running' && needsApproval && approvalSent && approvalSent !== 'skipped' && approvalSent !== 'stopped' && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
        {status === 'running' && needsApproval && !approvalSent && <span className="w-2 h-2 rounded-full bg-neutral-500 animate-pulse" />}
        {status === 'running' && !needsApproval && <span className="w-2 h-2 rounded-full bg-neutral-900 animate-pulse" />}

        {/* Tool name(args) */}
        <span className="text-neutral-800">
          {name}
          {argsStr && <span className="text-neutral-500">({argsStr})</span>}
        </span>

        {/* Status text - tool completion trumps approval state */}
        {status === 'done' || status === 'error' ? (
          timing_ms ? (
            <span className="text-neutral-400 text-xs font-sans">{formatTime(timing_ms)}</span>
          ) : null
        ) : needsApproval && approvalSent ? (
          approvalSent === 'skipped' ? (
            <span className="text-neutral-400 text-xs font-medium font-sans">skipped</span>
          ) : approvalSent === 'stopped' ? (
            <span className="text-red-500 text-xs font-medium font-sans">stopped</span>
          ) : (
            <span className="text-green-600 text-xs font-medium font-sans">approved — running...</span>
          )
        ) : needsApproval ? (
          <span className="text-neutral-500 text-xs font-medium font-sans">awaiting approval</span>
        ) : (
          <span className="text-neutral-400 text-xs font-sans">running...</span>
        )}

        {/* Line count hint when collapsed */}
        {!needsApproval && hasOutput && !isExpanded && outputLines > 1 && (
          <span className="text-neutral-400 text-xs font-sans">{outputLines} lines</span>
        )}
      </div>

      {/* Approval - separate from tool display */}
      {needsApproval && status === 'running' && (
        <div className="mt-2 ml-5">
          <ApprovalButtons approvalSent={approvalSent} onApproval={handleApproval} toolName={name} description={pendingApproval?.description} batchRemaining={pendingApproval?.batch_remaining} />
        </div>
      )}

      {/* Output */}
      {!needsApproval && hasOutput && isExpanded && (
        <div className="mt-1 ml-5 pl-3 border-l-2 border-neutral-400">
          <pre className="text-xs text-neutral-700 whitespace-pre-wrap overflow-x-auto max-h-80 overflow-y-auto font-mono">
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}
