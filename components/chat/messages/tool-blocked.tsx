'use client'

import { HiOutlineNoSymbol } from 'react-icons/hi2'
import type { ToolBlockedUI } from '../types'
import { StatusPill } from '../status-pill'

interface ToolBlockedProps {
  data: ToolBlockedUI
}

/** A tool the Host refused and steered the agent away from: one card, one status. */
export function ToolBlocked({ data }: ToolBlockedProps) {
  return (
    <div className="py-2.5">
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <HiOutlineNoSymbol aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-600" />
            <span className="truncate text-sm font-semibold text-neutral-900">{data.tool} blocked</span>
          </div>
          <StatusPill status="redirected" />
        </div>
        {data.command && (
          <pre className="mx-3 truncate rounded-lg bg-neutral-100 px-2.5 py-1.5 font-mono text-xs text-neutral-800">
            $ {data.command}
          </pre>
        )}
        <p className="px-3 py-2.5 text-[13px] leading-5 text-neutral-600">{data.message}</p>
      </div>
    </div>
  )
}
