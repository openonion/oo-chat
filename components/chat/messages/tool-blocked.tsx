'use client'

import { HiOutlineExclamationCircle } from 'react-icons/hi'
import type { ToolBlockedUI } from '../types'

interface ToolBlockedProps {
  data: ToolBlockedUI
}

export function ToolBlocked({ data }: ToolBlockedProps) {
  return (
    <div className="py-2">
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
        <HiOutlineExclamationCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-amber-800">
            {data.tool} blocked
          </span>
          <span className="text-xs text-amber-700">
            {data.message}
          </span>
        </div>
      </div>
    </div>
  )
}
