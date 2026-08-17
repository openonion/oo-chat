'use client'

import { useState } from 'react'
import {
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
  /** Kept for generic tool-card compatibility; native approval copy comes from Core. */
  toolName?: string
  batchRemaining?: BatchTool[]
  allowOnce?: boolean
  allowSession?: boolean
  /** Specific safe reason a native request has no approve control. */
  blockedMessage?: string
}

/** Deliberate approval hierarchy: one primary action; broader trust is confirmed. */
export function ApprovalButtons({
  approvalSent,
  onApproval,
  description,
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
          ? 'This request was rejected'
          : 'This request was stopped'
    return <p className="px-1 py-3 text-sm font-medium text-neutral-700" role="status">{copy}</p>
  }

  return (
    <div className="mt-4 space-y-3">
      <div className={`grid gap-2 ${allowOnce ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {allowOnce ? (
          <button
            type="button"
            onClick={() => onApproval(true, 'once')}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 text-sm font-semibold text-white hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            <HiOutlineCheck className="h-5 w-5 shrink-0" aria-hidden />
            Allow once
          </button>
        ) : (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
            {blockedMessage || 'This request is outside the selected Work Room and cannot be allowed here.'}
          </p>
        )}
        <button
          type="button"
          onClick={() => onApproval(false, 'once', 'reject_soft')}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
        >
          <HiOutlineX className="h-5 w-5 shrink-0" aria-hidden />
          Reject this request
        </button>
      </div>
      {description && <p className="text-sm text-neutral-600">{description}</p>}

      <details className="rounded-lg border border-neutral-200 bg-white">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900">
          <span>Other review options</span>
          <span aria-hidden="true" className="text-neutral-400">⌄</span>
        </summary>
        <div className="space-y-3 border-t border-neutral-100 p-3">
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
                <button type="button" onClick={() => onApproval(true, 'session')} className="min-h-12 rounded-lg bg-neutral-900 px-3 text-sm font-semibold text-white hover:bg-neutral-800">Confirm trust</button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => onApproval(false, 'once', 'reject_explain')}
            className="flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            <HiOutlineQuestionMarkCircle className="h-5 w-5" aria-hidden />
            Reject and ask for an explanation
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
