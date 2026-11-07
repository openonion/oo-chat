'use client'

import { useState } from 'react'
import {
  HiOutlineChevronDown,
  HiOutlineCheck,
  HiOutlineQuestionMarkCircle,
  HiOutlineShieldCheck,
  HiOutlineX,
} from 'react-icons/hi'

export type ApprovalState = 'approved' | 'approved_session' | 'skipped' | 'stopped' | null

interface BatchTool {
  tool: string
  arguments: string
}

interface ApprovalButtonsProps {
  approvalSent: ApprovalState
  onApproval: (
    approved: boolean,
    scope: 'once' | 'session',
    mode?: 'reject_soft' | 'reject_hard' | 'reject_explain',
  ) => void
  description?: string
  /** The step row's own title ("Edit parse.ts"). A description that only says
   *  the same thing with a longer path ("Edit src/date/parse.ts") is dropped. */
  stepTitle?: string
  /** Kept for generic tool-card compatibility; native approval copy comes from Core. */
  toolName?: string
  batchRemaining?: BatchTool[]
  allowOnce?: boolean
  allowSession?: boolean
  /** Specific safe reason a native request has no approve control. */
  blockedMessage?: string
}

/** Same words once every path is cut to its file name, ignoring case. */
function restates(description: string, stepTitle?: string) {
  const plain = (text: string) => text.trim().split(/\s+/).map(word => word.split('/').pop()).join(' ').toLowerCase()
  return Boolean(stepTitle) && plain(description) === plain(stepTitle!)
}

/** Deliberate approval hierarchy: one primary action; broader trust is confirmed. */
export function ApprovalButtons({
  approvalSent,
  onApproval,
  description,
  stepTitle,
  batchRemaining,
  allowOnce = true,
  allowSession = false,
  blockedMessage,
}: ApprovalButtonsProps) {
  const [confirmSession, setConfirmSession] = useState(false)
  if (approvalSent) {
    const copy = approvalSent === 'approved_session'
      ? 'Session trust confirmed — continuing…'
      : approvalSent === 'approved'
        ? 'Allowed once — continuing…'
        : approvalSent === 'skipped'
          ? 'Declined'
          : 'This request was stopped'
    return <p className="px-1 py-3 text-sm font-medium text-neutral-700" role="status">{copy}</p>
  }

  return (
    <div className="mt-3 space-y-3">
      {description && !restates(description, stepTitle) && <p className="text-sm font-medium leading-6 text-neutral-900">{description}</p>}
      {!allowOnce && (
        <p className="rounded-lg bg-co-danger-soft px-3 py-3 text-sm text-co-danger">
          {blockedMessage || 'This request is outside the selected Work Room and cannot be allowed here.'}
        </p>
      )}
      {/* The one Fresh fill on the card, sized to its words: 44px on touch, 36px
          with a fine pointer. Decline is the secondary line button beside it. */}
      <div className="flex flex-wrap items-center gap-2">
        {allowOnce && (
          <button
            type="button"
            onClick={() => onApproval(true, 'once')}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-co-green px-4 text-sm font-semibold text-co-on-green hover:bg-co-green-hover focus:outline-none focus-visible:shadow-[var(--co-focus)] pointer-fine:min-h-9 max-sm:flex-1"
          >
            <HiOutlineCheck className="h-4 w-4 shrink-0 stroke-[2.5]" aria-hidden />
            Allow once
          </button>
        )}
        <button
          type="button"
          onClick={() => onApproval(false, 'once', 'reject_soft')}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-co-surface px-4 text-sm font-semibold text-co-ink shadow-[inset_0_0_0_1px_var(--co-line)] hover:bg-co-raised focus:outline-none focus-visible:shadow-[var(--co-focus)] pointer-fine:min-h-9 max-sm:flex-1"
        >
          <HiOutlineX className="h-4 w-4 shrink-0" aria-hidden />
          Decline
        </button>
      </div>
      <details className="border-t border-neutral-200 pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-2 text-sm font-medium text-neutral-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-identity-700">
          <span>{allowSession ? 'Session trust or explanation' : 'Ask for an explanation'}</span>
          <HiOutlineChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-500" />
        </summary>
        <div className="space-y-3 pt-2">
          {allowSession && !confirmSession && (
            <button
              type="button"
              onClick={() => setConfirmSession(true)}
              className="flex min-h-12 w-full items-center gap-2 rounded-lg border border-neutral-300 px-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
            >
              <HiOutlineShieldCheck className="h-5 w-5 shrink-0" aria-hidden />
              Trust this Work Room for the session
            </button>
          )}
          {allowSession && confirmSession && (
            <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-3">
              <p className="text-sm font-medium text-neutral-950">Trust future matching requests in this Work Room?</p>
              <p className="mt-1 text-sm text-neutral-700">You can end the session to remove this trust.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setConfirmSession(false)} className="min-h-12 rounded-lg border border-neutral-300 px-3 text-sm font-medium text-neutral-700 hover:bg-white">Cancel</button>
                <button type="button" onClick={() => onApproval(true, 'session')} className="min-h-11 rounded-lg bg-co-green px-4 text-sm font-semibold text-co-on-green hover:bg-co-green-hover pointer-fine:min-h-9">Confirm trust</button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => onApproval(false, 'once', 'reject_explain')}
            className="flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            <HiOutlineQuestionMarkCircle className="h-5 w-5" aria-hidden />
            Decline and ask why
          </button>
          <p className="px-1 text-xs leading-5 text-neutral-500">
            Raw provider commands and output are not shown here. This decision
            uses the verified action and Work Room boundary above.
          </p>
        </div>
      </details>
      {batchRemaining?.length ? (
        <p className="text-xs text-neutral-500">Additional approval requests may follow.</p>
      ) : null}
    </div>
  )
}
