'use client'

import { useState } from 'react'
import { HiOutlineChevronDown, HiOutlineChevronRight, HiOutlineStop } from 'react-icons/hi'
import type { PendingApproval, ProviderInvocationUI } from '../types'
import { ChatApproval } from '../chat-approval'
import { ToolStatus } from './tools/tool-status'
import { CodingAgentWorkroom } from './coding-agent-workroom'

interface CodingAgentCardProps {
  invocation: ProviderInvocationUI
  continuations?: ProviderInvocationUI[]
  expanded: boolean
  onToggle: () => void
  onStop?: () => void
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  onMessageProvider?: (message: string) => void
}

const terminal = new Set(['completed', 'failed', 'cancelled'])

function elapsed(ms?: number) {
  if (typeof ms !== 'number') return ''
  if (ms < 1000) return `${ms}ms`
  return `${Math.round(ms / 1000)}s`
}

export function CodingAgentCard({
  invocation, continuations = [], expanded, onToggle, onStop, pendingApproval, onApprovalResponse, onMessageProvider,
}: CodingAgentCardProps) {
  const [workroomOpen, setWorkroomOpen] = useState(false)
  const running = !terminal.has(invocation.status)
  const summary = invocation.taskSummary || 'Coding task'
  const status = invocation.status.replace('_', ' ')

  return (
    <section
      aria-label={`${invocation.providerDisplayName} ${status}`}
      className="my-2 min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
    >
      <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
        <ToolStatus status={invocation.status === 'completed' ? 'done' : invocation.status === 'failed' ? 'error' : 'running'} />
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expanded ? <HiOutlineChevronDown className="h-4 w-4 shrink-0" /> : <HiOutlineChevronRight className="h-4 w-4 shrink-0" />}
          <span className="shrink-0 text-sm font-semibold text-neutral-900">{invocation.providerDisplayName}</span>
          <span className="truncate text-sm text-neutral-600">{summary}</span>
        </button>
        <span className="shrink-0 text-xs capitalize text-neutral-500">{status}</span>
        {invocation.elapsedMs != null && <span className="shrink-0 text-xs tabular-nums text-neutral-400">{elapsed(invocation.elapsedMs)}</span>}
        {running && onStop && (
          <button
            type="button"
            onClick={onStop}
            className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-red-600"
            aria-label={`Stop ${invocation.providerDisplayName}`}
          >
            <HiOutlineStop className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setWorkroomOpen(true)}
          className="min-h-9 shrink-0 rounded-md border border-neutral-200 px-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Open Work Room
        </button>
      </div>

      {expanded && (
        <div className="border-t border-neutral-100 px-3 py-2">
          <ol className="space-y-1" aria-label={`${invocation.providerDisplayName} activity`}>
            {invocation.activities.map(activity => (
              <li key={activity.id} className="flex min-w-0 items-start gap-2 py-1 text-xs">
                <ToolStatus status={activity.status} className="mt-0.5" />
                <span className="shrink-0 font-medium text-neutral-700">{activity.name}</span>
                <span className="min-w-0 flex-1 overflow-hidden font-mono text-neutral-500">
                  <span className="block truncate">
                    {String(activity.args?.command || activity.args?.file_path || activity.args?.path || activity.result || '')}
                  </span>
                  {activity.result != null && Boolean(activity.args?.command || activity.args?.file_path || activity.args?.path) && (
                    <span className="block break-words text-neutral-400">{String(activity.result)}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          {invocation.activities.length === 0 && running && (
            <p className="py-1 text-xs text-neutral-500">Starting provider…</p>
          )}
          {(invocation.error || (invocation.result && terminal.has(invocation.status))) && (
            <p className={`mt-2 break-words rounded-md px-2 py-1.5 text-xs ${invocation.error ? 'bg-red-50 text-red-700' : 'bg-neutral-50 text-neutral-600'}`}>
              {invocation.error || invocation.result}
            </p>
          )}
          {pendingApproval && onApprovalResponse && (
            <ChatApproval approval={pendingApproval} onResponse={onApprovalResponse} />
          )}
        </div>
      )}
      {workroomOpen && (
        <CodingAgentWorkroom
          invocation={invocation}
          continuations={continuations}
          onClose={() => setWorkroomOpen(false)}
          onStop={onStop}
          onMessage={onMessageProvider}
        />
      )}
    </section>
  )
}
