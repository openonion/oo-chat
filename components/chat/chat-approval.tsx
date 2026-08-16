'use client'

import { useState } from 'react'
import type { PendingApproval } from './types'
import { ApprovalButtons, type ApprovalState } from './messages/tools/approval-buttons'

interface ChatApprovalProps {
  approval: PendingApproval
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
export function ChatApproval({ approval, onResponse }: ChatApprovalProps) {
  const [approvalSent, setApprovalSent] = useState<ApprovalState>(null)
  const presentation = approval.providerApproval || safeFallback(approval)

  const handleApproval = (
    approved: boolean,
    scope: 'once' | 'session',
    mode?: 'reject_soft' | 'reject_hard' | 'reject_explain',
  ) => {
    if (approvalSent) return
    if (approved) setApprovalSent(scope === 'session' ? 'approved_session' : 'approved')
    else setApprovalSent(mode === 'reject_soft' ? 'skipped' : 'stopped')
    onResponse(approved, scope, mode)
  }

  return (
    <section aria-label="Approval required" className="rounded-xl bg-white p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Needs your decision</p>
      <h2 className="mt-1 text-base font-semibold text-neutral-950">{presentation.action}</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-neutral-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Where</dt>
          <dd className="mt-1 text-sm font-medium text-neutral-900">{presentation.scope}</dd>
        </div>
        <div className="rounded-lg bg-neutral-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Why</dt>
          <dd className="mt-1 text-sm font-medium text-neutral-900">{presentation.reason}</dd>
        </div>
      </dl>
      {presentation.files?.length ? (
        <p className="mt-3 text-sm text-neutral-600">Files: {presentation.files.join(', ')}</p>
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
    </section>
  )
}
