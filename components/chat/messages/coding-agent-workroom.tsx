'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HiOutlineArrowLeft } from 'react-icons/hi2'
import type { PendingApproval, ProviderInvocationUI, ProviderStopHandler } from '../types'
import { ChatApproval } from '../chat-approval'
import {
  activitySummary,
  allProviderActivities,
  compactProviderTaskHeading,
  latestProviderActivity,
  type ProviderActivity,
  providerPermissionBoundary,
  providerSnapshotSummary,
} from './coding-agent-activity'
import { ToolStatus } from './tools/tool-status'

interface CodingAgentWorkroomProps {
  invocation: ProviderInvocationUI
  continuations?: ProviderInvocationUI[]
  onClose: () => void
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (
    approved: boolean,
    scope: 'once' | 'session',
    mode?: 'reject_soft' | 'reject_hard' | 'reject_explain',
    feedback?: string,
  ) => void
  onProviderStop?: ProviderStopHandler
  activityCount?: number
}

const terminal = new Set(['completed', 'failed', 'cancelled'])
const STOP_CONFIRMATION_TIMEOUT_MS = 15_000

type DisplayActivity = ProviderActivity & { occurrences?: number }

function groupedProviderActivities(activities: ProviderActivity[]): DisplayActivity[] {
  const groups: DisplayActivity[] = []
  for (const activity of activities) {
    const previous = groups.at(-1)
    const repeat = previous
      && previous.title === activity.title
      && previous.summary === activity.summary
      && previous.status === activity.status
      && !previous.files?.length
      && !activity.files?.length
      && previous.legacy === false
      && activity.legacy === false
    if (repeat) {
      previous.occurrences = (previous.occurrences || 1) + 1
    } else {
      groups.push({ ...activity, occurrences: 1 })
    }
  }
  return groups
}

function displayStatus(
  status: ProviderInvocationUI['status'],
  stateNeedsConfirmation = false,
) {
  if (stateNeedsConfirmation) return 'Status needs confirmation'
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

function focusable(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter(element => !element.hasAttribute('hidden'))
}

/** One-scroll, keyboard-safe decision and evidence surface for a provider run. */
export function CodingAgentWorkroom({
  invocation,
  continuations = [],
  onClose,
  pendingApproval,
  onApprovalResponse,
  onProviderStop,
  activityCount,
}: CodingAgentWorkroomProps) {
  const [showHistory, setShowHistory] = useState(false)
  const [stopPhase, setStopPhase] = useState<'idle' | 'requesting' | 'requested'>('idle')
  const [stopStateNotice, setStopStateNotice] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopRequestRef = useRef(0)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
  }, [])

  const current = continuations.at(-1) ?? invocation
  const running = !terminal.has(current.status)
  const stateNeedsConfirmation = Boolean(stopStateNotice) && running
  const taskHeading = compactProviderTaskHeading(
    invocation.taskTitle || current.taskTitle,
    invocation.taskSummary || current.taskSummary,
    invocation.providerDisplayName,
  )
  const activities = useMemo(
    () => allProviderActivities(invocation, continuations),
    [invocation, continuations],
  )
  const latest = latestProviderActivity(invocation, continuations)
  const summary = stateNeedsConfirmation
    ? 'Provider status needs confirmation'
    : providerSnapshotSummary(
      current.status,
      latest,
      terminal.has(current.status)
        ? current.resultSummary || current.errorSummary
        : current.currentSummary,
    )
  const groupedActivities = useMemo(() => groupedProviderActivities(activities), [activities])
  const allActivities = useMemo(() => [...groupedActivities].reverse(), [groupedActivities])
  const files = useMemo(() => {
    const items = new Map<string, { status: 'running' | 'done' | 'error' }>()
    for (const activity of activities) {
      // A generic compatibility event can mention a path in unverified raw
      // arguments. It is useful only as legacy activity, never as file proof.
      const names = activity.legacy === false ? activity.files || [] : []
      for (const name of names) {
        if (name) items.set(name, { status: activity.status })
      }
    }
    return Array.from(items, ([name, value]) => ({ name, ...value }))
  }, [activities])

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const root = rootRef.current
    if (!root) return
    const previousOverflow = document.body.style.overflow
    const siblings = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element !== root)
      .map(element => ({
        element,
        ariaHidden: element.getAttribute('aria-hidden'),
        inert: element.hasAttribute('inert'),
      }))
    document.body.style.overflow = 'hidden'
    siblings.forEach(({ element }) => {
      element.setAttribute('aria-hidden', 'true')
      element.setAttribute('inert', '')
    })
    requestAnimationFrame(() => headingRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusable(root)
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      siblings.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
        if (!inert) element.removeAttribute('inert')
      })
      window.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [])

  const stepCount = activityCount ?? activities.length
  const completedSteps = activities.filter(activity => activity.status === 'done').length
  const failedSteps = activities.filter(activity => activity.status === 'error').length
  const hasDecision = Boolean(pendingApproval && onApprovalResponse)
  const canStop = !stateNeedsConfirmation
    && (current.status === 'starting' || current.status === 'running')
    && Boolean(onProviderStop)
  const stopPending = stopPhase !== 'idle'
  const progressDetail = current.status === 'awaiting_approval'
    ? `${completedSteps} of ${stepCount} steps completed · 1 decision needed`
    : current.status === 'failed'
      ? `${completedSteps} of ${stepCount} steps completed${failedSteps ? ` · ${failedSteps} need attention` : ''}`
        : current.status === 'completed'
          ? `${completedSteps || stepCount} of ${stepCount} steps completed`
          : `${completedSteps} of ${stepCount} steps completed`

  useEffect(() => {
    if (!terminal.has(current.status)) return
    stopRequestRef.current += 1
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    setStopPhase('idle')
    setStopStateNotice(null)
  }, [current.status])

  const requestProviderStop = async () => {
    if (!onProviderStop || stopPending) return
    const requestVersion = stopRequestRef.current + 1
    stopRequestRef.current = requestVersion
    setStopPhase('requesting')
    setStopStateNotice(null)
    try {
      // The SDK resolves only after the Host acknowledges this exact invocation.
      // A terminal provider event remains the authoritative stopped state.
      await onProviderStop(current.id)
      if (stopRequestRef.current !== requestVersion) return
      setStopPhase('requested')
      stopTimerRef.current = setTimeout(() => {
        if (stopRequestRef.current !== requestVersion) return
        stopTimerRef.current = null
        setStopPhase('idle')
        setStopStateNotice(
          'The Host accepted this stop request, but the provider has not confirmed a final state. Return to the conversation to refresh its status.',
        )
      }, STOP_CONFIRMATION_TIMEOUT_MS)
    } catch {
      if (stopRequestRef.current !== requestVersion) return
      setStopPhase('idle')
      setStopStateNotice(
        'The Host could not confirm the current provider state. Return to the conversation to refresh it before taking another action.',
      )
    }
  }

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] flex min-h-0 flex-col bg-neutral-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workroom-heading"
    >
      <header className="shrink-0 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to conversation"
            className="flex min-h-12 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            <HiOutlineArrowLeft className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 id="workroom-heading" ref={headingRef} tabIndex={-1} className="line-clamp-2 text-sm font-semibold text-neutral-950 focus:outline-none sm:truncate sm:line-clamp-none">
              {taskHeading}
            </h1>
            <p className="mt-0.5 text-xs text-neutral-500">
              {invocation.providerDisplayName} · {displayStatus(current.status, stateNeedsConfirmation)}
            </p>
          </div>
          {canStop ? (
            <button
              type="button"
              aria-label={`Stop ${current.providerDisplayName} run`}
              disabled={stopPending}
              onClick={() => { void requestProviderStop() }}
              className="min-h-12 shrink-0 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:cursor-not-allowed disabled:text-neutral-400"
            >
              {stopPhase === 'requesting' ? 'Requesting stop…' : stopPhase === 'requested' ? 'Stop requested' : <>
                <span className="sm:hidden">Stop</span>
                <span className="hidden sm:inline">Stop {current.providerDisplayName} run</span>
              </>}
            </button>
          ) : null}
        </div>
        {stopPhase === 'requested' && (
          <p role="status" className="mx-auto max-w-3xl px-4 pb-3 text-sm text-neutral-600 sm:px-6">
            Stop requested. Waiting for {current.providerDisplayName} to confirm.
          </p>
        )}
        {stopStateNotice && (
          <p role="alert" className="mx-auto max-w-3xl px-4 pb-3 text-sm text-red-700 sm:px-6">
            {stopStateNotice}
          </p>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <section aria-label="Work Room progress" className={`rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 ${hasDecision ? 'order-2' : ''}`}>
            <div className="flex items-start gap-3">
              <ToolStatus
                status={stateNeedsConfirmation
                  ? 'error'
                  : current.status === 'completed'
                  ? 'done'
                  : current.status === 'cancelled'
                    ? 'stopped'
                    : current.status === 'failed'
                      ? 'error'
                      : 'running'}
                awaitingApproval={current.status === 'awaiting_approval'}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Current progress</p>
                <p className="mt-1 text-base font-semibold text-neutral-950">{summary}</p>
                <p className="mt-1 text-sm text-neutral-600">{progressDetail}</p>
                <p aria-label="Permission boundary" className="mt-3 text-xs leading-5 text-neutral-500">
                  {stateNeedsConfirmation
                    ? 'Return to the conversation to refresh the provider state before taking another action.'
                    : providerPermissionBoundary(current.permissionMode, current.status)}
                </p>
                {files.length > 0 && (
                  <p aria-label="Provider file evidence" className="mt-3 text-xs text-neutral-500">
                    {files.length} verified {files.length === 1 ? 'file change' : 'file changes'} recorded
                  </p>
                )}
                {activities.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowHistory(value => !value)}
                    aria-expanded={showHistory}
                    className="mt-3 min-h-12 rounded-lg px-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
                  >
                    {showHistory
                      ? 'Hide activity history'
                      : groupedActivities.length === activities.length
                        ? `Show all ${activities.length} steps`
                        : `Show ${activities.length} recorded steps (${groupedActivities.length} groups)`}
                  </button>
                )}
              </div>
            </div>
          </section>

          {hasDecision && (
            <section aria-live="assertive" aria-label="Work Room decision" className="order-1 rounded-xl border border-neutral-300 bg-neutral-50 p-1">
              <ChatApproval approval={pendingApproval!} onResponse={onApprovalResponse!} />
            </section>
          )}

          {showHistory && (
            <section aria-label="All provider activity" className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-neutral-950">Activity history</h2>
              <ActivityList
                activities={allActivities}
                running={running}
                empty={running ? 'Waiting for provider activity…' : 'No provider activity reported.'}
                showFiles
              />
            </section>
          )}

        </div>
      </main>
    </div>,
    document.body,
  )
}

function ActivityList({
  activities,
  running,
  empty,
  showFiles = false,
}: {
  activities: DisplayActivity[]
  running: boolean
  empty: string
  showFiles?: boolean
}) {
  if (!activities.length) return <p className="mt-3 text-sm text-neutral-600">{empty}</p>
  return (
    <ol className="mt-3 divide-y divide-neutral-100">
      {activities.map(activity => (
        <li key={activity.id} className="flex min-h-14 items-start gap-3 py-3">
          <ToolStatus status={activity.status} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900">{activity.title || activitySummary(activity, running)}</p>
            <p className="mt-0.5 text-sm text-neutral-600">
              {activity.summary || activitySummary(activity, running)}
              {activity.occurrences && activity.occurrences > 1
                ? ` · ${activity.occurrences} recorded checks`
                : ''}
            </p>
            {showFiles && activity.files?.length ? (
              <p className="mt-1 text-xs text-neutral-500">{activity.files.join(', ')}</p>
            ) : activity.legacy ? (
              <p className="mt-1 text-xs text-neutral-500">Legacy activity</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
