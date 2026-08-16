'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  HiOutlineArrowLeft,
  HiOutlineListBullet,
  HiOutlineSparkles,
} from 'react-icons/hi2'
import type { PendingApproval, ProviderInvocationUI } from '../types'
import { ChatApproval } from '../chat-approval'
import {
  activitySummary,
  allProviderActivities,
  compactProviderTaskHeading,
  latestProviderActivity,
  type ProviderActivity,
  providerPermissionBoundary,
  providerPermissionLabel,
  providerSnapshotSummary,
} from './coding-agent-activity'
import { ToolStatus } from './tools/tool-status'

type WorkroomSection = 'overview' | 'activity'

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
  onProviderStop?: (invocationId: string) => void
  activityCount?: number
}

const terminal = new Set(['completed', 'failed', 'cancelled'])
const recentLimit = 3

type DisplayActivity = ProviderActivity & { occurrences?: number }

function recentActivityGroups(activities: ProviderActivity[]): DisplayActivity[] {
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
  return groups.slice(-recentLimit).reverse()
}

function displayStatus(status: ProviderInvocationUI['status']) {
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
  const [section, setSection] = useState<WorkroomSection>('overview')
  const [showEarlier, setShowEarlier] = useState(false)
  const [stopping, setStopping] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const current = continuations.at(-1) ?? invocation
  const running = !terminal.has(current.status)
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
  const summary = providerSnapshotSummary(
    current.status,
    latest,
    terminal.has(current.status)
      ? current.resultSummary || current.errorSummary
      : current.currentSummary,
  )
  const recentActivities = useMemo(() => recentActivityGroups(activities), [activities])
  const allActivities = useMemo(() => [...activities].reverse(), [activities])
  const visibleActivities = showEarlier ? allActivities : recentActivities
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
  const canStop = (current.status === 'starting' || current.status === 'running')
    && Boolean(onProviderStop)
  const progressDetail = current.status === 'awaiting_approval'
    ? `${completedSteps} of ${stepCount} steps completed · 1 decision needed`
    : current.status === 'failed'
      ? `${completedSteps} of ${stepCount} steps completed${failedSteps ? ` · ${failedSteps} need attention` : ''}`
      : current.status === 'completed'
        ? `${completedSteps || stepCount} of ${stepCount} steps completed`
        : `${completedSteps} of ${stepCount} steps completed`

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
            className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            <HiOutlineArrowLeft className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 id="workroom-heading" ref={headingRef} tabIndex={-1} className="truncate text-sm font-semibold text-neutral-950 focus:outline-none">
              {taskHeading}
            </h1>
            <p className="mt-0.5 text-xs text-neutral-500">
              {invocation.providerDisplayName} · {displayStatus(current.status)}
            </p>
          </div>
          {canStop ? (
            <button
              type="button"
              aria-label={`Stop ${current.providerDisplayName} run`}
              disabled={stopping}
              onClick={() => {
                if (stopping) return
                setStopping(true)
                onProviderStop?.(current.id)
              }}
              className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:cursor-not-allowed disabled:text-neutral-400"
            >
              {stopping ? 'Stopping…' : <>
                <span className="sm:hidden">Stop</span>
                <span className="hidden sm:inline">Stop {current.providerDisplayName} run</span>
              </>}
            </button>
          ) : null}
        </div>
      </header>

      <div className="shrink-0 border-b border-neutral-200 bg-white">
        <nav className="mx-auto flex max-w-3xl gap-1 px-4 py-2 sm:px-6" aria-label="Work Room sections">
          {([
            ['overview', 'Overview', HiOutlineSparkles],
            ['activity', 'Activity', HiOutlineListBullet],
          ] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-current={section === value ? 'page' : undefined}
              onClick={() => setSection(value)}
              className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 ${section === value ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {section === 'overview' && (
            <>
              <section aria-label="Work Room progress" className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <ToolStatus
                    status={current.status === 'completed'
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
                    <p className="mt-3 text-xs leading-5 text-neutral-500">
                      Access: <span className="font-medium text-neutral-700">{providerPermissionLabel(current.permissionMode)}</span>
                      {' · '}{providerPermissionBoundary(current.permissionMode)}
                    </p>
                  </div>
                </div>
              </section>

              {hasDecision && (
                <section aria-live="assertive" aria-label="Work Room decision" className="rounded-xl border border-amber-200 bg-amber-50 p-1">
                  <ChatApproval approval={pendingApproval!} onResponse={onApprovalResponse!} />
                </section>
              )}

              <section aria-label="Recent activity" className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-neutral-950">Recent activity</h2>
                  {activities.length > recentLimit && (
                    <button
                      type="button"
                      onClick={() => setSection('activity')}
                      className="min-h-11 rounded-lg px-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
                    >
                      View all
                    </button>
                  )}
                </div>
                <ActivityList activities={recentActivities} running={running} empty={running ? 'Waiting for provider activity…' : 'No provider activity reported.'} />
              </section>

              {files.length > 0 && (
                <section aria-label="Provider file evidence" className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
                  <h2 className="text-sm font-semibold text-neutral-950">Files changed</h2>
                  <ul className="mt-3 divide-y divide-neutral-100">
                    {files.map(file => (
                      <li key={file.name} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate font-medium text-neutral-800">{file.name}</span>
                        <span className="shrink-0 text-xs capitalize text-neutral-500">{file.status}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {section === 'activity' && (
            <section aria-label="All provider activity" className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-neutral-950">Activity</h2>
                {activities.length > recentLimit && (
                  <button
                    type="button"
                    onClick={() => setShowEarlier(value => !value)}
                    aria-expanded={showEarlier}
                    className="min-h-11 rounded-lg px-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
                  >
                    {showEarlier ? 'Show recent' : `Show ${activities.length - recentLimit} earlier`}
                  </button>
                )}
              </div>
              <ActivityList activities={visibleActivities} running={running} empty={running ? 'Waiting for provider activity…' : 'No provider activity reported.'} />
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
}: {
  activities: DisplayActivity[]
  running: boolean
  empty: string
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
            {activity.files?.length ? (
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
