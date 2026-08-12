'use client'

/**
 * @purpose Terminal UI for a Host-bounded Full access checkpoint
 * @llm-note
 *   Dependencies: imports from [react, react-icons, ./utils.ts, ./types.ts] | imported by [chat.tsx]
 *   Data flow: receives {checkpoint, onResponse} → user ends the bounded run through React-owned cancellation
 *   State/Effects: no state, immediate actions
 *   Integration: exposes ChatFullAccessCheckpoint component | used when pendingFullAccessCheckpoint is not null
 *   Errors: no error handling
 */

import { HiOutlineRocketLaunch } from 'react-icons/hi2'
import { HiOutlineStop } from 'react-icons/hi'
import { cn } from './utils'
import type { PendingFullAccessCheckpoint } from './types'

interface ChatFullAccessCheckpointProps {
  checkpoint: PendingFullAccessCheckpoint
  onResponse: () => void
  className?: string
}

export function ChatFullAccessCheckpoint({ checkpoint, onResponse, className }: ChatFullAccessCheckpointProps) {
  const { turns_used, max_turns } = checkpoint

  return (
    <div className={cn(
      'mx-4 mb-5 rounded-2xl border border-neutral-200 bg-neutral-50/50 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-3 duration-500',
      className
    )}>
      {/* Header */}
      <div className="p-5 border-b border-neutral-100 bg-neutral-50">
        <div className="flex items-start gap-4">
          <div className="shrink-0 mt-0.5 bg-neutral-100 p-1.5 rounded-lg">
            <HiOutlineRocketLaunch className="w-5 h-5 text-neutral-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900 leading-relaxed">
              Full access checkpoint
            </p>
            <p className="text-xs text-neutral-600 mt-1">
              {/* A host that omits max_turns produced "Completed 20 of 0 turns" —
                  an impossible sentence at the moment someone decides whether to
                  grant another hundred. State what is known. */}
              {max_turns > 0
                ? `Completed ${turns_used} of ${max_turns} turns`
                : `Completed ${turns_used} turns`}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4">
        <button
          onClick={onResponse}
          className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left text-sm transition-all duration-200 group border bg-white/40 text-neutral-600 hover:bg-white/80 hover:text-neutral-900 border-transparent hover:border-neutral-200"
        >
          <div className="shrink-0 w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
            <HiOutlineStop className="w-4 h-4 text-neutral-600" />
          </div>
          <div className="flex-1">
            <span className="font-medium block">End Full access run</span>
            <span className="text-xs text-neutral-500">Stop this run; choose another Host mode after it settles</span>
          </div>
        </button>
      </div>
    </div>
  )
}
