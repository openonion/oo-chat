'use client'

/**
 * Detailed OIP-native provider surface. Core owns authority and React owns
 * protocol normalization; this component only renders the supplied lifecycle.
 * Keep its single-scroll, one-conditional-action contract in docs/WORKROOM.md.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HiOutlineArrowLeft } from 'react-icons/hi2'
import type { PendingApproval, ProviderInvocationUI, ProviderStopPhase } from '../types'
import { ChatApproval } from '../chat-approval'
import {
  activitySummary,
  allProviderActivities,
  compactProviderTaskHeading,
  currentProviderArtifactPreview,
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
  /** Card/SDK owns Stop acknowledgement; Work Room only dispatches the action. */
  onProviderStop?: (invocationId: string) => Promise<unknown>
  activityCount?: number
  /** SDK-owned Stop lifecycle for this invocation. */
  providerStopPhase?: ProviderStopPhase
  /** Safe explanatory text supplied by the lifecycle owner, if available. */
  providerStopNotice?: string | null
}

const terminal = new Set(['completed', 'failed', 'cancelled'])

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
  stopPhase?: ProviderStopPhase,
) {
  if (stopPhase === 'unconfirmed') return 'Status needs confirmation'
  if (stopPhase === 'requesting' || stopPhase === 'acknowledged') return 'Stopping'
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
    'a[href], button:not([disabled]), summary:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter(element => {
    if (element.hasAttribute('hidden')) return false
    // Closed disclosure content is not tabbable in the browser. Its summary is
    // the one exception, so the dialog trap must preserve it as the last stop.
    const closedDisclosure = element.closest('details:not([open])')
    return !closedDisclosure || element.matches('summary')
  })
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
  providerStopPhase,
  providerStopNotice,
}: CodingAgentWorkroomProps) {
  const [showHistory, setShowHistory] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const current = continuations.at(-1) ?? invocation
  const running = !terminal.has(current.status)
  const effectiveStopPhase = terminal.has(current.status)
    ? undefined
    : providerStopPhase
  const stopPending = effectiveStopPhase === 'requesting' || effectiveStopPhase === 'acknowledged'
  const stateNeedsConfirmation = effectiveStopPhase === 'unconfirmed' && running
  const stateConfirmationNotice = stateNeedsConfirmation
    ? providerStopNotice ?? 'The provider state needs confirmation after a stop request. No further action is available until the provider reports an updated status.'
    : null
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
  const preview = currentProviderArtifactPreview(invocation, continuations)
  const summary = stateNeedsConfirmation
    ? 'Waiting for a refreshed provider state'
    : stopPending
      ? `Waiting for ${current.providerDisplayName} to confirm the stop request`
      : providerSnapshotSummary(
      current.status,
      latest,
      terminal.has(current.status)
        ? current.resultSummary || current.errorSummary
        : current.currentSummary,
    )
  const groupedActivities = useMemo(() => groupedProviderActivities(activities), [activities])
  const allActivities = useMemo(() => [...groupedActivities].reverse(), [groupedActivities])
  const latestCompleted = useMemo(
    () => [...activities].reverse().find(activity => activity.status === 'done'),
    [activities],
  )

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
  const progressPercent = stepCount > 0
    ? Math.min(100, Math.round((completedSteps / stepCount) * 100))
    : 0
  const hasDecision = !effectiveStopPhase
    && current.status === 'awaiting_approval'
    && Boolean(pendingApproval && onApprovalResponse)
  const showStopControl = Boolean(onProviderStop) && (
    stopPending
    || (!effectiveStopPhase && (current.status === 'starting' || current.status === 'running'))
  )
  const progressDetail = stateNeedsConfirmation
    ? `Last reported: ${completedSteps} of ${stepCount} steps completed`
    : stopPending
      ? `Last reported: ${completedSteps} of ${stepCount} steps completed`
      : current.status === 'awaiting_approval'
    ? `${completedSteps} of ${stepCount} steps completed · 1 decision needed`
    : current.status === 'failed'
      ? `${completedSteps} of ${stepCount} steps completed${failedSteps ? ` · ${failedSteps} need attention` : ''}`
        : current.status === 'completed'
          ? `${completedSteps || stepCount} of ${stepCount} steps completed`
          : `${completedSteps} of ${stepCount} steps completed`

  const requestProviderStop = () => {
    if (!onProviderStop || effectiveStopPhase) return
    // The Card/SDK owns request, acknowledgement and timeout state. Work Room
    // only renders it, so closing this dialog cannot lose a live Stop lifecycle.
    void onProviderStop(current.id)
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
              {invocation.providerDisplayName} · {displayStatus(current.status, effectiveStopPhase)}
            </p>
          </div>
          {showStopControl ? (
            <button
              type="button"
              aria-label={`Stop ${current.providerDisplayName} run`}
              disabled={stopPending}
              onClick={requestProviderStop}
              className="min-h-12 shrink-0 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:cursor-not-allowed disabled:text-neutral-400"
            >
              {effectiveStopPhase === 'requesting' || effectiveStopPhase === 'acknowledged' ? 'Stopping…' : <>
                <span className="sm:hidden">Stop</span>
                <span className="hidden sm:inline">Stop {current.providerDisplayName} run</span>
              </>}
            </button>
          ) : null}
        </div>
        {effectiveStopPhase === 'requesting' && (
          <p role="status" className="mx-auto max-w-3xl px-4 pb-3 text-sm text-neutral-600 sm:px-6">
            Waiting for Host confirmation.
          </p>
        )}
        {effectiveStopPhase === 'acknowledged' && (
          <p role="status" className="mx-auto max-w-3xl px-4 pb-3 text-sm text-neutral-600 sm:px-6">
            Waiting for {current.providerDisplayName} to confirm the stop.
          </p>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {hasDecision && (
            <section aria-live="assertive" aria-label="Work Room decision" className="rounded-xl border border-neutral-300 bg-neutral-50 p-1">
              <ChatApproval approval={pendingApproval!} onResponse={onApprovalResponse!} />
            </section>
          )}

          {stateNeedsConfirmation && stateConfirmationNotice && (
            <section role="alert" aria-label="Provider status confirmation" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:p-5">
              <p>{stateConfirmationNotice}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 min-h-12 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-900 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
              >
                Return to conversation
              </button>
            </section>
          )}

          {preview ? (
            <figure aria-label="Latest provider view" className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <img
                src={preview.thumbnailDataUrl}
                alt={preview.alt}
                className="aspect-video w-full bg-neutral-100 object-contain"
              />
            </figure>
          ) : null}

          <section aria-label="Work Room progress" className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <ToolStatus
                status={stateNeedsConfirmation
                  ? 'error'
                  : stopPending
                    ? 'paused'
                  : current.status === 'completed'
                  ? 'done'
                  : current.status === 'cancelled'
                    ? 'stopped'
                    : current.status === 'failed'
                      ? 'error'
                      : 'running'}
                awaitingApproval={!stateNeedsConfirmation && !stopPending && current.status === 'awaiting_approval'}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Current progress</p>
                {!stateNeedsConfirmation && !stopPending && !hasDecision && (
                  <p className="mt-1 text-base font-semibold text-neutral-950">{summary}</p>
                )}
                <p className="mt-1 text-sm text-neutral-600">{progressDetail}</p>
                {stepCount > 0 && (
                  <div
                    role="progressbar"
                    aria-label="Run progress"
                    aria-valuemin={0}
                    aria-valuemax={stepCount}
                    aria-valuenow={Math.min(completedSteps, stepCount)}
                    aria-valuetext={progressDetail}
                    className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100"
                  >
                    <div className="h-full rounded-full bg-neutral-900 transition-[width]" style={{ width: `${progressPercent}%` }} />
                  </div>
                )}
                {!stateNeedsConfirmation && !stopPending && !hasDecision && (
                  <p aria-label="Permission boundary" className="mt-3 text-xs leading-5 text-neutral-500">
                    {providerPermissionBoundary(current.permissionMode, current.status)}
                  </p>
                )}
                {latestCompleted && (
                  <p aria-label="Latest completed step" className="mt-3 text-xs leading-5 text-neutral-600">
                    Latest completed: {activitySummary(latestCompleted, false)}
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
                      : `Show activity history (${activities.length} steps)`}
                  </button>
                )}
              </div>
            </div>
          </section>

          {showHistory && (
            <section aria-label="All provider activity" className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-neutral-950">Activity history</h2>
              {groupedActivities.length < activities.length && (
                <p className="mt-1 text-xs leading-5 text-neutral-500">Repeated activity is grouped for readability.</p>
              )}
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
