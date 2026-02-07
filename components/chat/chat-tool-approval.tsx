'use client'

import { useState } from 'react'
import { cn } from './utils'
import type { PendingApproval } from './types'
import { ApprovalButtons } from './messages/tools/approval-buttons'

interface ChatToolApprovalProps {
  approval: PendingApproval
  onResponse: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  className?: string
}

export function ChatToolApproval({ approval, onResponse, className }: ChatToolApprovalProps) {
  const { tool, arguments: args } = approval
  const [approvalSent, setApprovalSent] = useState<'approved' | 'approved_session' | 'skipped' | 'stopped' | null>(null)

  const handleApproval = (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain') => {
    if (approvalSent) return
    if (approved) {
      setApprovalSent(scope === 'session' ? 'approved_session' : 'approved')
    } else {
      setApprovalSent(mode === 'reject_soft' || mode === 'reject_explain' ? 'skipped' : 'stopped')
    }
    onResponse(approved, scope, mode)
  }

  return (
    <div className={cn(
      'mx-4 mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4',
      className
    )}>
      <div className="mb-3">
        <p className="font-medium text-gray-800">
          Tool requires approval: <code className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">{tool}</code>
        </p>
        {args && Object.keys(args).length > 0 && (
          <pre className="mt-2 max-h-32 overflow-auto rounded bg-gray-800 p-2 text-xs text-gray-100">
            {JSON.stringify(args, null, 2)}
          </pre>
        )}
      </div>

      <ApprovalButtons approvalSent={approvalSent} onApproval={handleApproval} batchRemaining={approval.batch_remaining} />
    </div>
  )
}
