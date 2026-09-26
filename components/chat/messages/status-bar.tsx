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

export function StatusBar({ thinkingItems }: StatusBarProps) {
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

  const hasTokenData = totalTokens > 0

  if (!hasTokenData) return null

  const roundedContext = Math.round(contextPercent)

  // Color based on context usage
  let contextColor = 'text-neutral-400'
  if (roundedContext >= 80) contextColor = 'text-red-500'
  else if (roundedContext >= 50) contextColor = 'text-neutral-600 font-medium'

  return (
    <details className="group mt-6 text-xs text-neutral-500">
      <summary className="w-fit cursor-pointer rounded px-1 py-2 focus-visible:outline-2 focus-visible:outline-neutral-900">
        Session usage{totalCost > 0 ? ` · ${formatCost(totalCost)}` : ''}
      </summary>
      <dl className="mt-2 grid max-w-sm grid-cols-2 gap-x-8 gap-y-2 rounded-lg bg-neutral-50 p-4 text-neutral-600">
        <dt>Total tokens</dt><dd className="text-right tabular-nums">{formatTokens(totalTokens)}</dd>
        {hasBreakdown && <><dt>New input</dt><dd className="text-right tabular-nums">{formatTokens(uncachedTokens)}</dd>
          <dt>Cached input</dt><dd className="text-right tabular-nums">{formatTokens(cachedTokens)}</dd></>}
        {cacheWriteTokens > 0 && <><dt>Cache write</dt><dd className="text-right tabular-nums">{formatTokens(cacheWriteTokens)}</dd></>}
        {roundedContext >= 10 && <><dt>Context used</dt><dd className={`text-right tabular-nums ${contextColor}`}>{roundedContext}%</dd></>}
      </dl>
    </details>
  )
}
