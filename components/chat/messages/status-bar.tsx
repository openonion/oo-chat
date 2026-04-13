'use client'

import { useMemo } from 'react'
import type { ThinkingUI } from '../types'

interface StatusBarProps {
  thinkingItems: ThinkingUI[]
  sessionState: 'idle' | 'connected' | 'active' | 'disconnected' | 'reconnecting'
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return `${tokens}`
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

export function StatusBar({ thinkingItems, sessionState }: StatusBarProps) {
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

  const showSessionState = sessionState === 'reconnecting'
  const hasTokenData = totalTokens > 0

  // Don't show if no data and no session issue
  if (!hasTokenData && !showSessionState) return null

  const roundedContext = Math.round(contextPercent)

  // Color based on context usage
  let contextColor = 'text-neutral-400'
  if (roundedContext >= 80) contextColor = 'text-red-500'
  else if (roundedContext >= 50) contextColor = 'text-amber-500'

  return (
    <div className="px-4 py-1.5">
      <div className="mx-auto max-w-3xl flex items-center justify-between text-xs text-neutral-400">
        {/* Left: session state indicator */}
        <div>
          {sessionState === 'reconnecting' && (
            <span className="flex items-center gap-1.5 text-amber-500">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              reconnecting
            </span>
          )}
        </div>

        {/* Right: tokens / cost / context */}
        {hasTokenData && (
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              {formatTokens(totalTokens)} tok
              {totalCost > 0 && ` · ${formatCost(totalCost)}`}
            </span>
            {roundedContext >= 10 && (
              <span className={`tabular-nums ${contextColor}`}>
                {roundedContext}% ctx
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
