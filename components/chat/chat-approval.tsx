'use client'

import { useState } from 'react'
import type { PendingApproval } from './types'
import { ApprovalButtons, type ApprovalState } from './messages/tools/approval-buttons'

export type { ApprovalState } from './messages/tools/approval-buttons'

interface ChatApprovalProps {
  approval: PendingApproval
  /**
   * A provider card and its Work Room can show the same correlated decision.
   * The card owns this optional state so a click in either surface settles both
   * before a Host lifecycle frame arrives. Omit it for standalone approvals.
   */
  approvalResolution?: ApprovalState
  onResponse: (
    approved: boolean,
    scope: 'once' | 'session',
    mode?: 'reject_soft' | 'reject_hard' | 'reject_explain',
    feedback?: string,
  ) => void
}

function safeFallback(approval: PendingApproval): NonNullable<PendingApproval['providerApproval']> {
  const provider = approval.provider === 'codex' ? 'Codex' : approval.provider === 'claude_code' ? 'Claude Code' : 'The agent'
  const nativeProvider = approval.provider === 'codex' || approval.provider === 'claude_code'
  return {
    action: `${provider} requested an action`,
    scope: nativeProvider ? 'Boundary could not be verified' : 'This request only',
    reason: 'Review the request before allowing it to continue',
    scopeClassification: 'unknown' as const,
    // A missing native presentation is not evidence that the request is small.
    // Generic framework approvals retain their normal one-shot decision, but a
    // Codex/Claude request without Core verification must fail closed.
    allowOnce: !nativeProvider,
    allowSession: false,
  }
}

/** A safe decision surface: default content never renders raw approval arguments. */
export function ChatApproval({ approval, approvalResolution, onResponse }: ChatApprovalProps) {
  const [localApprovalSent, setLocalApprovalSent] = useState<ApprovalState>(null)
  const controlled = approvalResolution !== undefined
  const approvalSent = controlled ? approvalResolution : localApprovalSent
  const presentation = approval.providerApproval || safeFallback(approval)

  const handleApproval = (
    approved: boolean,
    scope: 'once' | 'session',
    mode?: 'reject_soft' | 'reject_hard' | 'reject_explain',
  ) => {
    if (approvalSent) return
    if (!controlled) {
      if (approved) setLocalApprovalSent(scope === 'session' ? 'approved_session' : 'approved')
      else setLocalApprovalSent(mode === 'reject_soft' ? 'skipped' : 'stopped')
    }
    onResponse(approved, scope, mode)
  }

  return (
    <section aria-label="Approval required" className="rounded-xl border border-neutral-400 bg-white p-4 shadow-sm sm:p-6">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-950">
        <span aria-hidden className="h-2 w-2 rounded-full bg-neutral-950" />
        Decision needed
      </p>
      <h2 className="mt-2 text-lg font-semibold leading-6 text-neutral-950">{presentation.action}</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-700">{presentation.reason}</p>
      <dl className="mt-3 border-t border-neutral-200 pt-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Applies to</dt>
          <dd className="text-sm font-medium text-neutral-900">{presentation.scope}</dd>
        </div>
      </dl>
      {presentation.files?.length ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Affected files</p>
          <ul className="mt-2 flex max-w-full gap-2 overflow-x-auto pb-1">
            {presentation.files.map(file => (
              <li key={file} className="max-w-full shrink-0 overflow-x-auto rounded-md bg-neutral-50 px-2 py-1.5 text-sm text-neutral-900">
                <code className="whitespace-nowrap font-mono text-xs sm:text-sm">{file}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ApprovalButtons
        approvalSent={approvalSent}
        onApproval={handleApproval}
        allowOnce={presentation.allowOnce}
        allowSession={presentation.allowSession}
        blockedMessage={presentation.scopeClassification === 'unknown'
          ? 'The Work Room boundary could not be verified, so this request cannot be allowed here.'
          : undefined}
        batchRemaining={approval.batch_remaining}
      />
      {approval.provider && (
        <p className="mt-3 text-xs leading-5 text-neutral-600">
          Change preview unavailable from this provider. Review the scope and files before deciding.
        </p>
      )}
    </section>
  )
}
