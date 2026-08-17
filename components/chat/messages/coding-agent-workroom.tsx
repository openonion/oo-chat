'use client'

/**
 * Detailed OIP-native provider surface. Core owns authority and React owns
 * protocol normalization; this component only renders the supplied lifecycle.
 * Keep its single-scroll, current-session-first contract in docs/WORKROOM.md.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HiOutlineArrowUp } from 'react-icons/hi'
import { HiOutlineArrowLeft } from 'react-icons/hi2'
import type { PendingApproval, ProviderInputHandler, ProviderInvocationUI, ProviderStopPhase } from '../types'
import { ChatApproval } from '../chat-approval'
import {
  activitySummary,
  allProviderActivities,
  compactProviderTaskHeading,
  currentProviderArtifactPreview,
  latestProviderActivity,
  type ProviderActivity,
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
  /** Direct native Codex message; never routed through the outer chat agent. */
  onProviderInput?: ProviderInputHandler
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

/** One-scroll, keyboard-safe native session surface for a provider run. */
export function CodingAgentWorkroom({
  invocation,
  continuations = [],
  onClose,
  pendingApproval,
  onApprovalResponse,
  onProviderStop,
  onProviderInput,
  providerStopPhase,
  providerStopNotice,
}: CodingAgentWorkroomProps) {
  const [showHistory, setShowHistory] = useState(false)
  const [showEarlierMessages, setShowEarlierMessages] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [composeError, setComposeError] = useState<string | null>(null)
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
    ? providerStopNotice ?? 'The provider state needs confirmation before any action can be taken. No further action is available until the provider reports an updated status.'
    : null
  const hasDecision = !effectiveStopPhase
    && current.status === 'awaiting_approval'
    && Boolean(pendingApproval && onApprovalResponse)
  const taskHeading = compactProviderTaskHeading(
    invocation.taskTitle || current.taskTitle,
    invocation.taskSummary || current.taskSummary,
    invocation.providerDisplayName,
  )
  const activities = useMemo(
    () => allProviderActivities(invocation, continuations),
    [invocation, continuations],
  )
  const conversation = useMemo(() => {
    const seen = new Set<string>()
    return [invocation, ...continuations]
      .flatMap(item => item.messages || [])
      .filter(message => {
        if (seen.has(message.id)) return false
        seen.add(message.id)
        return true
      })
  }, [invocation, continuations])
  const visibleConversation = showEarlierMessages
    ? conversation
    : conversation.slice(-3)
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
  const earlierActivities = useMemo(
    () => groupedActivities.slice(0, -1).reverse(),
    [groupedActivities],
  )
  const directCodex = current.provider === 'codex' && Boolean(onProviderInput)
  // An empty conversation is not useful context, and a native approval must
  // not compete with a transcript or preview. Show the native session only
  // when it has real evidence, outside an active decision.
  const showDirectConversation = !hasDecision
    && directCodex
    && (conversation.length > 0 || Boolean(preview))
  const composerBlocked = stateNeedsConfirmation || stopPending || current.status === 'awaiting_approval'
  const canSendDirectMessage = directCodex && !composerBlocked
  const sendDirectMessage = useCallback(async () => {
    const text = draft.trim()
    if (!onProviderInput || !text || !canSendDirectMessage || sending) return
    setSending(true)
    setComposeError(null)
    try {
      await onProviderInput(current.id, text)
      setDraft('')
    } catch (error) {
      setComposeError(error instanceof Error ? error.message : 'Codex could not receive that message. Try again.')
    } finally {
      setSending(false)
    }
  }, [canSendDirectMessage, current.id, draft, onProviderInput, sending])

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

  const showStopControl = Boolean(onProviderStop) && (
    stopPending
    || (!effectiveStopPhase && (current.status === 'starting' || current.status === 'running'))
  )
  const stopLabel = current.provider === 'codex' ? 'Pause' : 'Stop'
  const requestProviderStop = () => {
    if (!onProviderStop || effectiveStopPhase) return
    // The Card/SDK owns request, acknowledgement and timeout state. Work Room
    // only renders it, so closing this dialog cannot lose a live Stop lifecycle.
    void onProviderStop(current.id)
  }

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] flex min-h-0 flex-col bg-white"
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
              aria-label={`${stopLabel} ${current.providerDisplayName} run`}
              disabled={stopPending}
              onClick={requestProviderStop}
              className="min-h-12 shrink-0 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:cursor-not-allowed disabled:text-neutral-400"
            >
              {effectiveStopPhase === 'requesting' || effectiveStopPhase === 'acknowledged'
                ? 'Stopping…'
                : stopLabel}
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

      <main className="min-h-0 flex-1 overflow-y-auto bg-white px-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col">
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

          {!hasDecision && (
            <section aria-label="Current provider status" className="border-b border-neutral-200 py-4">
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
                  {!stateNeedsConfirmation && !stopPending && (
                    <p className="text-base font-semibold text-neutral-950">{summary}</p>
                  )}
                  {latest && latest.title && latest.title !== summary && (
                    <p className="mt-1 text-sm text-neutral-600">Latest: {latest.title}</p>
                  )}
                  {activities.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowHistory(value => !value)}
                      aria-expanded={showHistory}
                      className="mt-2 min-h-11 rounded-lg px-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
                    >
                      {showHistory
                        ? 'Hide earlier activity'
                        : `Show earlier activity (${activities.length - 1})`}
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {showDirectConversation ? (
            <section aria-label="Codex conversation" className="border-b border-neutral-200 py-5">
              {preview ? (
                <figure aria-label="Latest provider view" className="mx-auto flex aspect-video w-full max-w-xl items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                  <img
                    src={preview.thumbnailDataUrl}
                    alt={preview.alt}
                    className="block h-full w-full object-contain"
                  />
                </figure>
              ) : null}
              {conversation.length > 0 && (
                <ol className={preview ? 'mt-4 space-y-3' : 'space-y-3'} aria-live="polite">
                  {visibleConversation.map(message => (
                    <li key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                      <div className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-6 whitespace-pre-wrap break-words ${
                        message.role === 'user'
                          ? 'bg-neutral-900 text-white'
                          : 'bg-neutral-100 text-neutral-900'
                      }`}>
                        {message.text}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {conversation.length > visibleConversation.length && (
                <button
                  type="button"
                  onClick={() => setShowEarlierMessages(true)}
                  className="mt-3 min-h-11 rounded-lg px-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
                >
                  Show earlier messages ({conversation.length - visibleConversation.length})
                </button>
              )}
            </section>
          ) : !hasDecision && preview ? (
            <figure aria-label="Latest provider view" className="mx-auto my-5 flex aspect-video w-full max-w-xl items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
              <img
                src={preview.thumbnailDataUrl}
                alt={preview.alt}
                className="block h-full w-full bg-neutral-100 object-contain"
              />
            </figure>
          ) : null}

          {showHistory && (
            <section aria-label="Earlier provider activity" className="border-b border-neutral-200 py-4 sm:py-5">
              <h2 className="text-sm font-semibold text-neutral-950">Earlier activity</h2>
              {groupedActivities.length < activities.length && (
                <p className="mt-1 text-xs leading-5 text-neutral-500">Repeated activity is grouped for readability.</p>
              )}
              <ActivityList
                activities={earlierActivities}
                running={running}
                empty={running ? 'Waiting for provider activity…' : 'No provider activity reported.'}
                showFiles
              />
            </section>
          )}

        </div>
      </main>
      {directCodex && !hasDecision && (
        <footer className="shrink-0 border-t border-neutral-200 bg-white px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-3xl">
            {composeError && <p role="alert" className="mb-2 text-sm text-red-700">{composeError}</p>}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2 focus-within:border-neutral-400 focus-within:bg-white">
              <textarea
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void sendDirectMessage()
                  }
                }}
                disabled={!canSendDirectMessage || sending}
                rows={1}
                maxLength={12_000}
                aria-label="Message Codex directly"
                placeholder={composerBlocked
                  ? 'Codex is waiting for the current state to settle…'
                  : terminal.has(current.status)
                    ? 'Continue this Codex session…'
                    : 'Tell Codex what to adjust…'}
                className="max-h-32 min-h-12 w-full resize-y bg-transparent px-2 py-2 text-sm text-neutral-950 placeholder-neutral-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-1 pt-2">
                <p className="text-xs text-neutral-500">Enter sends · Shift+Enter adds a line</p>
                <button
                  type="button"
                  onClick={() => { void sendDirectMessage() }}
                  disabled={!draft.trim() || !canSendDirectMessage || sending}
                  aria-label="Send message to Codex"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  <HiOutlineArrowUp className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </footer>
      )}
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
    <ol className="mt-2 divide-y divide-neutral-100">
      {activities.map(activity => (
        <li key={activity.id} className="flex items-start gap-3 py-2.5">
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
