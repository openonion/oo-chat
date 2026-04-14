'use client'

import { useMemo } from 'react'
import type { ThinkingUI } from '../types'

interface StatusBarProps {
  thinkingItems: ThinkingUI[]
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return `${tokens}`
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

export function StatusBar({ thinkingItems }: StatusBarProps) {
  // Accumulate totals
  const { contextPercent, totalCost, totalTokens } = useMemo(() => {
    let contextPercent = 0
    let totalCost = 0
    let totalTokens = 0

    for (const item of thinkingItems) {
      if (item.context_percent !== undefined) {
        contextPercent = item.context_percent
      }
      if (item.status === 'done' && item.usage) {
        totalCost += item.usage.cost || 0
        const tokens = item.usage.total_tokens ||
          ((item.usage.input_tokens || item.usage.prompt_tokens || 0) +
           (item.usage.output_tokens || item.usage.completion_tokens || 0))
        totalTokens += tokens
      }
    }

    return { contextPercent, totalCost, totalTokens }
  }, [thinkingItems])

  // Don't show if no data
  if (totalTokens === 0) return null

  const roundedContext = Math.round(contextPercent)

  // Color based on context usage
  let contextColor = 'text-neutral-400'
  if (roundedContext >= 80) contextColor = 'text-red-500'
  else if (roundedContext >= 50) contextColor = 'text-amber-500'

  return (
    <div className="px-4 py-1.5">
      <div className="mx-auto max-w-3xl flex items-center justify-end gap-3 text-xs text-neutral-400">
        {/* Total tokens · cost */}
        <span className="tabular-nums">
          {formatTokens(totalTokens)} tok
          {totalCost > 0 && ` · ${formatCost(totalCost)}`}
        </span>
        {/* Context % - only show when meaningful */}
        {roundedContext >= 10 && (
          <span className={`tabular-nums ${contextColor}`}>
            {roundedContext}% ctx
          </span>
        )}
      </div>
    </div>
  )
}
