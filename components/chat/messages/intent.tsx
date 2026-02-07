import { useState, useEffect } from 'react'
import type { IntentUI } from '../types'

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

export function Intent({ intent }: { intent: IntentUI }) {
  const [seconds, setSeconds] = useState(0)
  const [simulatedTokens, setSimulatedTokens] = useState(0)
  const isAnalyzing = intent.status === 'analyzing'

  useEffect(() => {
    if (!isAnalyzing) {
      setSeconds(0)
      setSimulatedTokens(0)
      return
    }

    const timeInterval = setInterval(() => setSeconds(s => s + 1), 1000)
    const tokenInterval = setInterval(() => {
      setSimulatedTokens(prev => Math.min(prev + 7, 500))
    }, 100)

    return () => {
      clearInterval(timeInterval)
      clearInterval(tokenInterval)
    }
  }, [isAnalyzing])

  if (isAnalyzing) {
    return (
      <div className="py-1.5">
        <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono ml-5">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span>understanding</span>
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

  // Understood state — show ack as assistant message
  if (intent.status === 'understood' && intent.ack) {
    return (
      <div className="flex justify-start py-3">
        <div className="text-neutral-800">
          {intent.ack}
        </div>
      </div>
    )
  }

  return null
}
