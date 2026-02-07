'use client'

import { HiOutlineBan, HiOutlineLightBulb } from 'react-icons/hi'
import type { ToolBlockedUI } from '../types'

interface ToolBlockedProps {
  data: ToolBlockedUI
}

export function ToolBlocked({ data }: ToolBlockedProps) {
  return (
    <div className="py-2.5">
      <div className="rounded-lg border border-amber-300 bg-amber-50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-amber-100 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <HiOutlineBan className="w-4 h-4 text-amber-700" />
            <span className="text-sm font-semibold text-amber-900">
              {data.tool} blocked
            </span>
          </div>
          <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">
            Auto-redirected
          </span>
        </div>

        {/* Body */}
        <div className="px-3 py-3">
          <div className="flex items-start gap-2">
            <HiOutlineLightBulb className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-medium">Tip:</span> {data.message}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
