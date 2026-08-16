'use client'

import { useState } from 'react'
import {
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineClock,
  HiOutlineEye,
  HiOutlineStop,
} from 'react-icons/hi'
import type { PendingApproval, ProviderInvocationUI } from '../types'
import { ChatApproval } from '../chat-approval'
import {
  activityRawDetails,
  activitySummary,
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

function statusTone(status: ProviderInvocationUI['status']) {
  if (status === 'failed') return 'bg-red-50 text-red-700'
  if (status === 'cancelled') return 'bg-neutral-100 text-neutral-700'
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700'
  if (status === 'awaiting_approval') return 'bg-neutral-100 text-neutral-700'
  return 'bg-blue-50 text-blue-700'
}

export function CodingAgentCard({
  invocation, continuations = [], expanded, onToggle, onStop, pendingApproval, onApprovalResponse, onMessageProvider,
}: CodingAgentCardProps) {
  const [workroomOpen, setWorkroomOpen] = useState(false)
  const current = continuations.at(-1) ?? invocation
  const running = !terminal.has(current.status)
  const summary = compactProviderTaskHeading(
    invocation.taskSummary || current.taskSummary,
    invocation.providerDisplayName,
  )
  const genericSummary = summary === `${invocation.providerDisplayName} work room`
  const status = current.status.replace('_', ' ')
  const activities = allProviderActivities(invocation, continuations)
  const latest = latestProviderActivity(invocation, continuations)
  const latestSummary = providerSnapshotSummary(current.status, latest)

  return (
    <section
      aria-label={`${invocation.providerDisplayName} ${status}`}
      className="my-3 min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
    >
      <div className="border-b border-neutral-100 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-start gap-2">
          <ToolStatus status={current.status === 'completed' ? 'done' : current.status === 'failed' ? 'error' : 'running'} className="mt-1" />
          <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggle}
            className="flex min-h-9 min-w-0 flex-1 items-start gap-2 text-left"
          >
            {expanded ? <HiOutlineChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <HiOutlineChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="min-w-0">
              <span className="block line-clamp-2 text-sm font-semibold text-neutral-950">{summary}</span>
              <span className="mt-0.5 block text-xs text-neutral-500">{genericSummary ? 'Live activity' : `${invocation.providerDisplayName} work room`}</span>
            </span>
          </button>
          {running && onStop && (
            <button
              type="button"
              onClick={onStop}
              className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-red-600"
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

        {/* This is a true activity snapshot, not a fabricated screenshot. */}
        <div
          aria-label="Live activity snapshot"
          className="mt-3 grid min-h-24 grid-cols-[auto_1fr] gap-x-3 rounded-lg border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-3"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <HiOutlineEye className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-neutral-900">{latestSummary}</p>
              <span
                aria-label={`Status: ${status}`}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusTone(current.status)}`}
              >
                {status}
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {activities.length === 0 ? 'Live activity will appear here as Codex works.' : `${activities.length} recorded step${activities.length === 1 ? '' : 's'} · newest activity first in Work Room`}
            </p>
          </div>
          <div className="col-span-2 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-200 pt-2 text-xs text-neutral-500">
            <span>{invocation.providerDisplayName}</span>
            <span className="flex items-center gap-1"><HiOutlineClock className="h-3.5 w-3.5" />{current.elapsedMs != null ? elapsed(current.elapsedMs) : running ? 'Live' : 'Finished'}</span>
            {current.sessionId && <span>Session connected</span>}
          </div>
        </div>
      </div>

      {pendingApproval && onApprovalResponse && (
        <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 sm:px-4">
          <ChatApproval approval={pendingApproval} onResponse={onApprovalResponse} />
        </div>
      )}

      {expanded && (
        <div className="px-3 py-3 sm:px-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Recent activity</p>
            <span className="text-xs text-neutral-400">Details stay collapsed by default</span>
          </div>
          <ol className="max-h-56 space-y-1 overflow-y-auto overscroll-contain pr-1" aria-label={`${invocation.providerDisplayName} activity`}>
            {[...activities].reverse().map(activity => (
              <li key={activity.id} className="rounded-lg border border-neutral-100 bg-neutral-50/70 px-2.5 py-2">
                <details>
                  <summary className="flex min-w-0 cursor-pointer list-none items-start gap-2 text-xs marker:hidden">
                    <ToolStatus status={activity.status} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-neutral-800">{activitySummary(activity, running)}</span>
                      <span className="mt-0.5 block capitalize text-neutral-500">{activity.status}</span>
                    </span>
                    <HiOutlineChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-neutral-900 p-2 text-[11px] leading-5 text-neutral-100">{activityRawDetails(activity)}</pre>
                </details>
              </li>
            ))}
          </ol>
          {activities.length === 0 && (
            <p className="py-2 text-xs text-neutral-500">{running ? 'Starting provider…' : 'No provider activity reported.'}</p>
          )}
          {(current.error || (current.result && terminal.has(current.status))) && (
            <p className={`mt-3 break-words rounded-md px-2.5 py-2 text-xs ${current.error ? 'bg-red-50 text-red-700' : 'bg-neutral-50 text-neutral-600'}`}>
              {current.error || current.result}
            </p>
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
          pendingApproval={pendingApproval}
          onApprovalResponse={onApprovalResponse}
        />
      )}
    </section>
  )
}
