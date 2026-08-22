'use client'

import { useMemo } from 'react'
import type { ThinkingUI } from '../types'
import { usageStats } from './usage-stats'

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
  const { contextPercent, totalCost, totalTokens, cachedTokens, uncachedTokens, cacheWriteTokens, hasBreakdown } = useMemo(() => {
    let contextPercent = 0
    let totalCost = 0
    let totalTokens = 0
    let cachedTokens = 0
    let uncachedTokens = 0
    let cacheWriteTokens = 0
    let hasBreakdown = false

    for (const item of thinkingItems) {
      if (item.context_percent !== undefined) {
        contextPercent = item.context_percent
      }
      if (item.status === 'done' && item.usage) {
        const usage = usageStats(item.usage)
        totalCost += usage.cost
        totalTokens += usage.totalTokens
        cachedTokens += usage.cachedTokens
        uncachedTokens += usage.uncachedInputTokens
        cacheWriteTokens += usage.cacheWriteTokens
        hasBreakdown ||= usage.hasBreakdown
      }
    }

    return { contextPercent, totalCost, totalTokens, cachedTokens, uncachedTokens, cacheWriteTokens, hasBreakdown }
  }, [thinkingItems])

  const showSessionState = sessionState === 'reconnecting'
  const hasTokenData = totalTokens > 0

  // Don't show if no data and no session issue
  if (!hasTokenData && !showSessionState) return null

  const roundedContext = Math.round(contextPercent)

  // Color based on context usage
  let contextColor = 'text-neutral-400'
  if (roundedContext >= 80) contextColor = 'text-red-500'
  else if (roundedContext >= 50) contextColor = 'text-neutral-600 font-medium'

  return (
    <div className="px-4 py-1.5">
      <div className="mx-auto max-w-3xl flex items-center justify-between text-xs text-neutral-400">
        {/* Left: session state indicator */}
        <div>
          {sessionState === 'reconnecting' && (
            <span className="flex items-center gap-1.5 text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse" />
              reconnecting
            </span>
          )}
        </div>

        {/* Right: tokens / cost / context */}
        {hasTokenData && (
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              {formatTokens(totalTokens)} tok
              {hasBreakdown && ` · ${formatTokens(uncachedTokens)} new`}
              {hasBreakdown && ` · ${formatTokens(cachedTokens)} cached`}
              {hasBreakdown && cacheWriteTokens > 0 && ` · ${formatTokens(cacheWriteTokens)} cache write`}
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
