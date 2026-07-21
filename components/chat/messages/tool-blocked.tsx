'use client'

import { HiOutlineBan, HiOutlineLightBulb } from 'react-icons/hi'
import type { ToolBlockedUI } from '../types'

interface ToolBlockedProps {
  data: ToolBlockedUI
}

export function ToolBlocked({ data }: ToolBlockedProps) {
  return (
    <div className="py-2.5">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-neutral-100 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <HiOutlineBan className="w-4 h-4 text-neutral-600" />
            <span className="text-sm font-semibold text-neutral-900">
              {data.tool} blocked
            </span>
          </div>
          <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
            Auto-redirected
          </span>
        </div>

        {/* Command */}
        {data.command && (
          <div className="px-3 pt-2.5 pb-0">
            <pre className="px-2.5 py-1.5 bg-neutral-100 rounded text-xs font-mono text-neutral-800 truncate">
              $ {data.command}
            </pre>
          </div>
        )}

        {/* Body */}
        <div className="px-3 py-2.5">
          <div className="flex items-start gap-2">
            <HiOutlineLightBulb className="w-4 h-4 text-neutral-600 mt-0.5 shrink-0" />
            <div className="text-sm text-neutral-700">
              <span className="font-medium">Tip:</span> {data.message}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
