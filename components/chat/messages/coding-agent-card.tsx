'use client'

import { useState } from 'react'
import { HiOutlineChevronRight } from 'react-icons/hi'
import type { PendingApproval, ProviderInvocationUI } from '../types'
import {
  allProviderActivities,
  compactProviderTaskHeading,
  latestProviderActivity,
  providerSnapshotSummary,
} from './coding-agent-activity'
import { ToolStatus } from './tools/tool-status'
import { CodingAgentWorkroom } from './coding-agent-workroom'

interface CodingAgentCardProps {
  invocation: ProviderInvocationUI
  continuations?: ProviderInvocationUI[]
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (
    approved: boolean,
    scope: 'once' | 'session',
    mode?: 'reject_soft' | 'reject_hard' | 'reject_explain',
    feedback?: string,
  ) => void
  onProviderStop?: (invocationId: string) => void
}

const terminal = new Set(['completed', 'failed', 'cancelled'])

function statusLabel(status: ProviderInvocationUI['status']) {
  return status === 'awaiting_approval'
    ? 'Needs your decision'
    : status === 'completed'
      ? 'Completed'
      : status === 'failed'
        ? 'Needs attention'
        : status === 'cancelled'
          ? 'Stopped'
          : 'Working'
}

/** A compact transcript summary. Decisions and evidence belong in the Work Room. */
export function CodingAgentCard({
  invocation,
  continuations = [],
  pendingApproval,
  onApprovalResponse,
  onProviderStop,
}: CodingAgentCardProps) {
  const [workroomOpen, setWorkroomOpen] = useState(false)
  const current = continuations.at(-1) ?? invocation
  const activities = allProviderActivities(invocation, continuations)
  const latest = latestProviderActivity(invocation, continuations)
  const taskTitle = compactProviderTaskHeading(
    invocation.taskTitle || current.taskTitle,
    invocation.taskSummary || current.taskSummary,
    invocation.providerDisplayName,
  )
  const state = statusLabel(current.status)
  const summary = providerSnapshotSummary(
    current.status,
    latest,
    terminal.has(current.status)
      ? current.resultSummary || current.errorSummary
      : current.currentSummary,
  )
  const reviewRequired = Boolean(pendingApproval && onApprovalResponse)

  return (
    <section
      aria-label={`${invocation.providerDisplayName} ${state}`}
      className="my-3 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
    >
      <div className="flex min-h-[92px] items-center gap-3 px-4 py-3">
        <ToolStatus
          status={terminal.has(current.status)
            ? current.status === 'completed' ? 'done' : current.status === 'cancelled' ? 'stopped' : 'error'
            : 'running'}
          awaitingApproval={current.status === 'awaiting_approval'}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-neutral-500">
            {invocation.providerDisplayName} · {state}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-neutral-950">{taskTitle}</h3>
          <p className="mt-1 line-clamp-1 text-sm text-neutral-600">{summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setWorkroomOpen(true)}
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          {reviewRequired ? 'Review decision' : 'Open Work Room'}
          <HiOutlineChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {reviewRequired && (
        <p className="border-t border-neutral-100 bg-neutral-50 px-4 py-2 text-sm text-neutral-700">
          Your decision is needed in the Work Room.
        </p>
      )}
      {workroomOpen && (
        <CodingAgentWorkroom
          invocation={invocation}
          continuations={continuations}
          onClose={() => setWorkroomOpen(false)}
          pendingApproval={pendingApproval}
          onApprovalResponse={onApprovalResponse}
          onProviderStop={onProviderStop}
          activityCount={activities.length}
        />
      )}
    </section>
  )
}
