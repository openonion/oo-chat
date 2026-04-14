import { useState, useEffect } from 'react'
import type { CompactUI } from '../types'

interface CompactProps {
  compact: CompactUI
}

export function Compact({ compact }: CompactProps) {
  const [seconds, setSeconds] = useState(0)
  const isCompacting = compact.status === 'compacting'

  // Timer for compacting state
  useEffect(() => {
    if (!isCompacting) {
      setSeconds(0)
      return
    }

    const interval = setInterval(() => {
      setSeconds(s => s + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isCompacting])

  // Compacting state - show spinner with context percentage
  if (isCompacting) {
    return (
      <div className="flex justify-start py-1">
        <div className="flex items-center gap-1.5 text-neutral-400 border-l-2 border-violet-200 pl-3">
          <div className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse animation-delay-0" />
            <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse animation-delay-100" />
            <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse animation-delay-200" />
          </div>
          <span className="text-xs">
            {seconds > 0 ? `${seconds}s · ` : ''}
            {compact.context_percent !== undefined ? `${compact.context_percent}% · ` : ''}
            compacting
          </span>
        </div>
      </div>
    )
  }

  // Done state - show context reduction
  if (compact.status === 'done') {
    const before = compact.context_before
    const after = compact.context_after
    const reduction = before && after ? before - after : null

    return (
      <div className="flex justify-start py-1">
        <div className="border-l-2 border-violet-200 pl-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="text-violet-500">⟲</span>
            <span>
              {reduction !== null
                ? `compacted ${before}% → ${after}% (freed ${reduction}%)`
                : compact.message || 'context compacted'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (compact.status === 'error') {
    return (
      <div className="flex justify-start py-1">
        <div className="border-l-2 border-red-200 pl-3">
          <div className="flex items-center gap-1.5 text-xs text-red-400">
            <span>✗</span>
            <span>{compact.error || 'compact failed'}</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}
