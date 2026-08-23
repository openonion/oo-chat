'use client'

/**
 * Compact OIP-native Codex/Claude entry point. It renders only safe semantic
 * state and shares a correlated approval resolution with Work Room. See
 * docs/WORKROOM.md for Core → React → O Chat ownership and Stop lifecycle
 * invariants.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { HiOutlineChevronRight } from 'react-icons/hi'
import type { PendingApproval, ProviderInputHandler, ProviderInvocationUI, ProviderPermissionHandler, ProviderStopHandler, ProviderStopPhase } from '../types'
import type { ApprovalState } from '../chat-approval'
import {
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
  onProviderInput?: ProviderInputHandler
  onProviderPermission?: ProviderPermissionHandler
  /** SDK-owned Stop lifecycle for this invocation. */
  providerStopPhase?: ProviderStopPhase
  /** True when the surrounding SDK owns the acknowledgement timeout. */
  providerStopLifecycleOwned?: boolean
}

const terminal = new Set(['completed', 'failed', 'cancelled'])
const STOP_CONFIRMATION_TIMEOUT_MS = 15_000
type ProviderApprovalPresentation = NonNullable<PendingApproval['providerApproval']>
type ResolvedNativeApproval = {
  key: string
  approval: PendingApproval
  state: Exclude<ApprovalState, null>
}

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

/** Direct controls need an explicit native approval identity, never a guessed prompt. */
function correlatedProviderApprovalKey(
  approval: PendingApproval | null | undefined,
  invocation: ProviderInvocationUI,
) {
  if (
    !approval?.id
    || !approval.providerApproval
    || approval.providerInvocationId !== invocation.id
    || approval.parentToolCallId !== invocation.parentToolCallId
  ) return undefined
  return `${invocation.id}:${approval.id}`
}

/** Keep only the semantic approval evidence while Host advances its state. */
function safeResolvedApproval(approval: PendingApproval): PendingApproval {
  return {
    id: approval.id,
    tool: approval.tool,
    arguments: {},
    provider: approval.provider,
    providerInvocationId: approval.providerInvocationId,
    parentToolCallId: approval.parentToolCallId,
    activityId: approval.activityId,
    providerApproval: approval.providerApproval,
  }
}

function approvalResolutionCopy(resolution: Exclude<ApprovalState, null>) {
  return resolution === 'approved_session'
    ? 'Session trust confirmed — continuing…'
    : resolution === 'approved'
      ? 'Allowed once — continuing…'
      : resolution === 'skipped'
        ? 'This request was rejected'
        : 'This request was stopped'
}

function approvalRisk(presentation: ProviderApprovalPresentation) {
  return presentation.scopeClassification === 'workroom'
    ? 'Limited to this Work Room'
    : presentation.scopeClassification === 'elevated'
      ? 'Broader scope — review before allowing'
      : 'Boundary could not be verified'
}

/**
 * The card is an alternate viewport of the same native approval, not a second
 * authority. It gets only the safe direct decision and a route to full context;
 * session trust and every detail beyond scope/reason remain in Work Room.
 */
function ProviderApprovalPreview({
  presentation,
  resolution,
  onResolve,
  onOpenWorkroom,
}: {
  presentation: ProviderApprovalPresentation
  resolution: ApprovalState
  onResolve: (approved: boolean, scope: 'once', mode?: 'reject_soft') => void
  onOpenWorkroom: () => void
}) {
  const canAllow = presentation.scopeClassification === 'workroom' && presentation.allowOnce
  return (
    <section aria-label="Provider approval preview" className="border-t border-neutral-300 bg-neutral-50 px-4 py-3">
      <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-neutral-950">{presentation.action}</h4>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-700">
        <span className="font-medium text-neutral-900">Scope:</span> {presentation.scope}
        <span aria-hidden="true"> · </span>
        <span className="font-medium text-neutral-900">Reason:</span> {presentation.reason}
      </p>
      <p className={`mt-1 text-xs ${canAllow ? 'font-medium text-neutral-700' : 'font-semibold text-neutral-950'}`}>
        Risk: {approvalRisk(presentation)}
      </p>
      {resolution ? (
        <p role="status" className="mt-3 text-sm font-medium text-neutral-700">{approvalResolutionCopy(resolution)}</p>
      ) : (
        <div className={`mt-3 grid gap-2 ${canAllow ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canAllow && (
            <button
              type="button"
              onClick={() => onResolve(true, 'once')}
              className="min-h-12 rounded-lg bg-neutral-900 px-3 text-sm font-semibold text-white hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
            >
              Allow once
            </button>
          )}
          <button
            type="button"
            onClick={() => onResolve(false, 'once', 'reject_soft')}
            className="min-h-12 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            Reject this request
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onOpenWorkroom}
        className="mt-2 flex min-h-9 items-center gap-1 rounded-lg px-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
      >
        Review details in Work Room
        <HiOutlineChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </section>
  )
}

/** A compact transcript summary. Detailed evidence and review options stay in Work Room. */
export function CodingAgentCard({
  invocation,
  continuations = [],
  pendingApproval,
  onApprovalResponse,
  onProviderStop,
  onProviderInput,
  onProviderPermission,
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
  const [resolvedApproval, setResolvedApproval] = useState<ResolvedNativeApproval | null>(null)
  const localStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopRequestRef = useRef(0)
  const resolvedApprovalKeyRef = useRef<string | null>(null)

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
  const activeApprovalKey = reviewRequired
    ? correlatedProviderApprovalKey(pendingApproval, current)
    : undefined
  const settledApproval = !activeApprovalKey
    && !effectiveStopPhase
    && current.status === 'awaiting_approval'
    && resolvedApproval?.approval.providerInvocationId === current.id
    && resolvedApproval.approval.parentToolCallId === current.parentToolCallId
    ? resolvedApproval
    : undefined
  // An unverified/native-legacy approval remains available only in Work Room.
  // It must not lose its detailed fail-closed surface merely because it lacks
  // the identity required for direct card controls.
  const displayedApproval = reviewRequired ? pendingApproval : settledApproval?.approval
  const approvalKey = activeApprovalKey ?? settledApproval?.key
  const approvalPresentation = activeApprovalKey
    ? pendingApproval?.providerApproval
    : settledApproval?.approval.providerApproval
  const sharedApprovalResolution = approvalKey && resolvedApproval?.key === approvalKey
    ? resolvedApproval.state
    : null
  const resolveProviderApproval = (
    approved: boolean,
    scope: 'once' | 'session',
    mode?: 'reject_soft' | 'reject_hard' | 'reject_explain',
    feedback?: string,
  ) => {
    if (!activeApprovalKey || !pendingApproval || !onApprovalResponse || resolvedApprovalKeyRef.current === activeApprovalKey) return
    resolvedApprovalKeyRef.current = activeApprovalKey
    const state = approved
      ? scope === 'session' ? 'approved_session' : 'approved'
      : mode === 'reject_soft' ? 'skipped' : 'stopped'
    setResolvedApproval({
      key: activeApprovalKey,
      approval: safeResolvedApproval(pendingApproval),
      state,
    })
    if (feedback === undefined) onApprovalResponse(approved, scope, mode)
    else onApprovalResponse(approved, scope, mode, feedback)
  }
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
      className="my-2 overflow-hidden rounded-lg bg-neutral-50/80 ring-1 ring-inset ring-neutral-200/70"
    >
      <div className="flex min-h-16 items-center gap-2 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <ToolStatus
            status={stateNeedsConfirmation
              ? 'error'
              : stopPending
                ? 'paused'
              : terminal.has(current.status)
              ? current.status === 'completed' ? 'done' : current.status === 'cancelled' ? 'stopped' : 'error'
              : 'running'}
            awaitingApproval={!effectiveStopPhase && current.status === 'awaiting_approval'}
            className="mt-1 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-medium leading-5 text-neutral-950">{taskTitle}</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              {invocation.providerDisplayName} · {state}
            </p>
            <p className="mt-0.5 line-clamp-1 text-xs text-neutral-600">{summary}</p>
          </div>
        </div>
        {preview ? (
          <img
            src={preview.thumbnailDataUrl}
            alt={preview.alt}
            className="hidden h-14 w-24 shrink-0 rounded-md border border-neutral-200 bg-white object-contain sm:block sm:w-32"
          />
        ) : null}
        {!approvalPresentation && (
          <button
            type="button"
            aria-label={reviewRequired ? 'Review decision' : 'Open Work Room'}
            onClick={() => setWorkroomOpen(true)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 ${
              reviewRequired
                ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                : 'text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900'
            }`}
          >
            <span className="sr-only">{reviewRequired ? 'Review decision' : 'Open Work Room'}</span>
            <HiOutlineChevronRight className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {approvalPresentation && approvalKey && (
        <ProviderApprovalPreview
          presentation={approvalPresentation}
          resolution={sharedApprovalResolution}
          onResolve={resolveProviderApproval}
          onOpenWorkroom={() => setWorkroomOpen(true)}
        />
      )}
      {workroomOpen && (
        <CodingAgentWorkroom
          invocation={invocation}
          continuations={continuations}
          onClose={() => setWorkroomOpen(false)}
          pendingApproval={displayedApproval}
          onApprovalResponse={approvalKey ? resolveProviderApproval : onApprovalResponse}
          approvalResolution={approvalKey ? sharedApprovalResolution : undefined}
          onProviderStop={requestProviderStop}
          onProviderInput={onProviderInput}
          onProviderPermission={onProviderPermission}
          providerStopPhase={effectiveStopPhase}
          providerStopNotice={localProviderStopNotice}
        />
      )}
    </section>
  )
}
