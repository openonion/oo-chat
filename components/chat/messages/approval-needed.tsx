import type { ApprovalNeededUI } from '../types'
import { HiOutlineShieldCheck } from 'react-icons/hi'

export function ApprovalNeeded({ approval }: { approval: ApprovalNeededUI }) {
  return (
    <div className="flex justify-start py-1.5">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 max-w-[85%]">
        <div className="flex items-start gap-3">
          <HiOutlineShieldCheck className="w-5 h-5 text-neutral-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-neutral-900 mb-1">
              Approval needed for tool
            </div>
            <code className="text-sm text-neutral-800 bg-neutral-100 rounded px-1.5 py-0.5">
              {approval.tool}
            </code>
            {approval.arguments && Object.keys(approval.arguments).length > 0 && (
              <pre className="mt-2 max-h-24 overflow-auto rounded bg-neutral-800 p-2 text-xs text-neutral-100">
                {JSON.stringify(approval.arguments, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
