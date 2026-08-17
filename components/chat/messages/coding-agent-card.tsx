'use client'

/**
 * Compact OIP-native Codex/Claude entry point. It renders only safe semantic
 * state and delegates evidence/approval to Work Room. See docs/WORKROOM.md for
 * Core → React → O Chat ownership and Stop lifecycle invariants.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { HiOutlineChevronRight } from 'react-icons/hi'
import type { PendingApproval, ProviderInvocationUI, ProviderStopHandler, ProviderStopPhase } from '../types'
import {
  allProviderActivities,
  compactProviderTaskHeading,
  currentProviderArtifactPreview,
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
  onProviderStop?: ProviderStopHandler
  /** SDK-owned Stop lifecycle for this invocation. */
  providerStopPhase?: ProviderStopPhase
  /** True when the surrounding SDK owns the acknowledgement timeout. */
  providerStopLifecycleOwned?: boolean
}

const terminal = new Set(['completed', 'failed', 'cancelled'])
const STOP_CONFIRMATION_TIMEOUT_MS = 15_000

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
  providerStopPhase,
  providerStopLifecycleOwned = false,
}: CodingAgentCardProps) {
  const current = continuations.at(-1) ?? invocation
  const [workroomOpen, setWorkroomOpen] = useState(false)
  // The SDK owns production state. Keeping this fallback lets an embedded card
  // retain the same lifecycle when its host supplies only `onProviderStop`.
  // This owner deliberately outlives the modal: closing Work Room must not
  // cancel its acknowledgement timeout or turn a pending Stop into a lie.
  const [localProviderStopPhase, setLocalProviderStopPhase] = useState<ProviderStopPhase | undefined>()
  const [localProviderStopNotice, setLocalProviderStopNotice] = useState<string | null>(null)
  const localStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopRequestRef = useRef(0)

  useEffect(() => () => {
    if (localStopTimerRef.current) clearTimeout(localStopTimerRef.current)
  }, [])

  useEffect(() => {
    if (!terminal.has(current.status)) return
    stopRequestRef.current += 1
    if (localStopTimerRef.current) {
      clearTimeout(localStopTimerRef.current)
      localStopTimerRef.current = null
    }
    // Terminal UI is derived from `current.status`, which masks local state
    // below. Do not synchronously clear React state here: a terminal frame is
    // already the authority and its only imperative work is cancelling the
    // fallback timeout.
  }, [current.status])
  const activities = allProviderActivities(invocation, continuations)
  const latest = latestProviderActivity(invocation, continuations)
  const preview = currentProviderArtifactPreview(invocation, continuations)
  const taskTitle = compactProviderTaskHeading(
    invocation.taskTitle || current.taskTitle,
    invocation.taskSummary || current.taskSummary,
    invocation.providerDisplayName,
  )
  // Once the surrounding SDK owns this lifecycle, its absence of a phase is
  // meaningful: either the provider reached a terminal state or it supplied a
  // newer correlated revision. Do not revive the card's short-lived fallback
  // after that point, or a fresh approval remains incorrectly hidden behind an
  // old local "Stop requested" state.
  const effectiveStopPhase = terminal.has(current.status)
    ? undefined
    : providerStopLifecycleOwned
      ? providerStopPhase
      : providerStopPhase ?? localProviderStopPhase
  const stopPending = effectiveStopPhase === 'requesting' || effectiveStopPhase === 'acknowledged'
  const stateNeedsConfirmation = effectiveStopPhase === 'unconfirmed' && !terminal.has(current.status)
  const state = stateNeedsConfirmation
    ? 'Status needs confirmation'
    : stopPending
      ? effectiveStopPhase === 'requesting' ? 'Requesting stop' : 'Stop requested'
      : statusLabel(current.status)
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
  // An approval is actionable only after the provider's own lifecycle event
  // says it is waiting. In particular, a rejected Stop leaves the run unknown,
  // not silently safe to approve from a stale local prompt.
  const reviewRequired = !effectiveStopPhase
    && current.status === 'awaiting_approval'
    && Boolean(pendingApproval && onApprovalResponse)
  const requestProviderStop = useCallback(async (invocationId: string) => {
    if (!onProviderStop || effectiveStopPhase) {
      throw new Error('This provider stop is no longer actionable.')
    }
    const requestVersion = stopRequestRef.current + 1
    stopRequestRef.current = requestVersion
    if (localStopTimerRef.current) clearTimeout(localStopTimerRef.current)
    setLocalProviderStopNotice(null)
    setLocalProviderStopPhase('requesting')
    try {
      // Production SDKs own the authoritative phase map; this local state keeps
      // the modal honest before React receives its next render and is the
      // durable fallback for embedded cards without that SDK contract.
      const acknowledgement = await onProviderStop(invocationId)
      if (stopRequestRef.current !== requestVersion) return
      setLocalProviderStopPhase('acknowledged')
      // The SDK manages its own timeout in O Chat. A standalone card owns this
      // fallback instead, so there is exactly one timeout authority per run.
      if (providerStopLifecycleOwned) return acknowledgement
      localStopTimerRef.current = setTimeout(() => {
        if (stopRequestRef.current !== requestVersion) return
        localStopTimerRef.current = null
        setLocalProviderStopPhase('unconfirmed')
        setLocalProviderStopNotice(
          'The Host accepted this stop request, but the provider has not confirmed a final state. No further action is available until the provider reports an updated status.',
        )
      }, STOP_CONFIRMATION_TIMEOUT_MS)
      return acknowledgement
    } catch {
      if (stopRequestRef.current !== requestVersion) return
      setLocalProviderStopPhase('unconfirmed')
      setLocalProviderStopNotice(
        'The Host could not confirm the current provider state. No further action is available until the provider reports an updated status.',
      )
    }
  }, [effectiveStopPhase, onProviderStop, providerStopLifecycleOwned])

  return (
    <section
      aria-label={`${invocation.providerDisplayName} ${state}`}
      className="my-3 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
    >
      <div className="flex min-h-[92px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ToolStatus
            status={stateNeedsConfirmation
              ? 'error'
              : stopPending
                ? 'paused'
              : terminal.has(current.status)
              ? current.status === 'completed' ? 'done' : current.status === 'cancelled' ? 'stopped' : 'error'
              : 'running'}
            awaitingApproval={!effectiveStopPhase && current.status === 'awaiting_approval'}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-neutral-500">
              {invocation.providerDisplayName} · {state}
            </p>
            <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-5 text-neutral-950">{taskTitle}</h3>
            <p className="mt-1 line-clamp-1 text-sm text-neutral-600">{summary}</p>
          </div>
        </div>
        {preview ? (
          <img
            src={preview.thumbnailDataUrl}
            alt={preview.alt}
            className="h-14 w-24 shrink-0 rounded-md border border-neutral-200 bg-neutral-100 object-contain"
          />
        ) : null}
        <button
          type="button"
          onClick={() => setWorkroomOpen(true)}
          className="flex min-h-12 w-full shrink-0 items-center justify-center gap-1 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 sm:w-auto"
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
          onProviderStop={requestProviderStop}
          activityCount={activities.length}
          providerStopPhase={effectiveStopPhase}
          providerStopNotice={localProviderStopNotice}
        />
      )}
    </section>
  )
}
