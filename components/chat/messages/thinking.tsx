import { useState, useEffect } from 'react'
import type { ThinkingUI } from '../types'

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return `${tokens}`
}

function getActualTokens(usage: ThinkingUI['usage']): number {
  if (!usage) return 0
  return usage.total_tokens ||
    ((usage.input_tokens || usage.prompt_tokens || 0) +
     (usage.output_tokens || usage.completion_tokens || 0))
}

export function Thinking({ thinking, isLast = true }: { thinking: ThinkingUI; isLast?: boolean }) {
  const [seconds, setSeconds] = useState(0)
  const [simulatedTokens, setSimulatedTokens] = useState(0)
  const isRunning = thinking.status === 'running'

  useEffect(() => {
    if (!isRunning) {
      setSeconds(0)
      setSimulatedTokens(0)
      return
    }

    const timeInterval = setInterval(() => setSeconds(s => s + 1), 1000)
    const tokenInterval = setInterval(() => {
      setSimulatedTokens(prev => Math.min(prev + 11, 1100))
    }, 100)

    return () => {
      clearInterval(timeInterval)
      clearInterval(tokenInterval)
    }
  }, [isRunning])

  // Running state — single line matching done state style
  if (isRunning) {
    const model = thinking.model || 'thinking'

    return (
      <div className="py-1.5">
        <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono ml-5">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span>{model}</span>
          <span className="text-neutral-300">·</span>
          <span className="tabular-nums">{seconds > 0 ? formatTime(seconds) : '0s'}</span>
          {simulatedTokens > 0 && (
            <>
              <span className="text-neutral-300">·</span>
              <span className="tabular-nums text-neutral-400">~{formatTokens(simulatedTokens)} tok</span>
            </>
          )}
        </div>
      </div>
    )
  }

  // Content state (e.g. detailed thoughts)
  if (thinking.content) {
    return (
      <div className="py-2 ml-5">
        <div className="relative pl-4 border-l-2 border-indigo-100">
          <div className="text-[13px] text-neutral-600 leading-relaxed italic">
            {thinking.content}
          </div>
        </div>
      </div>
    )
  }

  // Done state — collapsed summary line
  if (thinking.status === 'done') {
    if (!isLast) return null

    const model = thinking.model
    const tokens = getActualTokens(thinking.usage)
    const cost = thinking.usage?.cost
    const duration = thinking.duration_ms ? Math.round(thinking.duration_ms / 1000) : 0

    return (
      <div className="py-1.5">
        <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono ml-5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-200" />
          <span>{model || 'done'}</span>
          <span className="text-neutral-300">·</span>
          <span className="tabular-nums">{formatTokens(tokens)} tok</span>
          {cost && cost > 0 && (
            <>
              <span className="text-neutral-300">·</span>
              <span className="tabular-nums">${cost.toFixed(4)}</span>
            </>
          )}
          {duration > 0 && (
            <>
              <span className="text-neutral-300">·</span>
              <span className="tabular-nums">{formatTime(duration)}</span>
            </>
          )}
        </div>
      </div>
    )
  }

  return null
}
