'use client'

/**
 * @purpose ULW checkpoint prompt allowing user to continue, extend turns, or switch modes
 * @llm-note
 *   Dependencies: imports from [react, react-icons, ./utils.ts, ./types.ts] | imported by [chat.tsx]
 *   Data flow: receives {checkpoint: PendingUlwTurnsReached, onResponse: (action, options) => void} → user clicks continue/switch → onResponse sends to agent
 *   State/Effects: no state, immediate actions
 *   Integration: exposes ChatUlwCheckpoint component | used when pendingUlwTurnsReached is not null
 *   Errors: no error handling
 */

import { HiOutlineRocketLaunch } from 'react-icons/hi2'
import { HiOutlinePlay, HiOutlineShieldCheck, HiOutlineLightningBolt } from 'react-icons/hi'
import { cn } from './utils'
import type { PendingUlwTurnsReached, ApprovalMode } from './types'

interface ChatUlwCheckpointProps {
  checkpoint: PendingUlwTurnsReached
  onResponse: (action: 'continue' | 'switch_mode', options?: { turns?: number; mode?: ApprovalMode }) => void
  className?: string
}

export function ChatUlwCheckpoint({ checkpoint, onResponse, className }: ChatUlwCheckpointProps) {
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
              Ultra work mode checkpoint
            </p>
            <p className="text-xs text-neutral-600 mt-1">
              Completed {turns_used} of {max_turns} turns
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-2">
        {/* Continue with more turns */}
        <button
          onClick={() => onResponse('continue', { turns: 100 })}
          className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left text-sm transition-all duration-200 group border bg-white/40 text-neutral-600 hover:bg-white/80 hover:text-neutral-900 border-transparent hover:border-neutral-200"
        >
          <div className="shrink-0 w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
            <HiOutlinePlay className="w-4 h-4 text-neutral-600" />
          </div>
          <div className="flex-1">
            <span className="font-medium block">Continue (+100 turns)</span>
            <span className="text-xs text-neutral-500">Keep working in ultra mode</span>
          </div>
        </button>

        {/* Switch to Accept Edits */}
        <button
          onClick={() => onResponse('switch_mode', { mode: 'accept_edits' })}
          className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left text-sm transition-all duration-200 group border bg-white/40 text-neutral-600 hover:bg-white/80 hover:text-neutral-900 border-transparent hover:border-neutral-200"
        >
          <div className="shrink-0 w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
            <HiOutlineLightningBolt className="w-4 h-4 text-neutral-600" />
          </div>
          <div className="flex-1">
            <span className="font-medium block">Switch to Accept Edits</span>
            <span className="text-xs text-neutral-500">Auto-approve all edits</span>
          </div>
        </button>

        {/* Switch to Safe mode */}
        <button
          onClick={() => onResponse('switch_mode', { mode: 'safe' })}
          className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left text-sm transition-all duration-200 group border bg-white/40 text-neutral-600 hover:bg-white/80 hover:text-neutral-900 border-transparent hover:border-neutral-200"
        >
          <div className="shrink-0 w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
            <HiOutlineShieldCheck className="w-4 h-4 text-neutral-600" />
          </div>
          <div className="flex-1">
            <span className="font-medium block">Switch to Safe Mode</span>
            <span className="text-xs text-neutral-500">Review each tool call</span>
          </div>
        </button>
      </div>
    </div>
  )
}
