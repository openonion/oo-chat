'use client'

import { useState } from 'react'
import type { PendingApproval } from './types'
import { ApprovalButtons, type ApprovalState } from './messages/tools/approval-buttons'
import { KVRows } from './messages/tools/kv-rows'

interface ChatApprovalProps {
  approval: PendingApproval
  onResponse: (
    approved: boolean,
    scope: 'once' | 'session',
    mode?: 'reject_soft' | 'reject_hard' | 'reject_explain',
    feedback?: string,
  ) => void
}

/** Decision surface for a permission request that has no separate tool update. */
export function ChatApproval({ approval, onResponse }: ChatApprovalProps) {
  const [approvalSent, setApprovalSent] = useState<ApprovalState>(null)
  const toolName = approval.tool.split(':')[0]
  const hasArguments = Object.keys(approval.arguments).length > 0

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
    <section
      aria-label={`Approval required for ${toolName}`}
      className="my-2 overflow-hidden rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Approval required</span>
        <span className="font-mono text-sm font-semibold text-neutral-800">{toolName}</span>
      </div>

      {hasArguments && (
        <div className="mt-2 rounded-md bg-neutral-50 px-3 py-2">
          <KVRows data={approval.arguments} />
        </div>
      )}

      <ApprovalButtons
        approvalSent={approvalSent}
        onApproval={handleApproval}
        toolName={toolName}
        description={approval.description}
        batchRemaining={approval.batch_remaining}
      />
    </section>
  )
}
