import { useState, useEffect } from 'react'
import type { ThinkingUI } from '../types'

// Claude-Code-style working indicator: a glyph that grows from a dot to a starburst,
// plus a rotating gerund. Shown on the running "thinking" line.
const SPINNER_FRAMES = ['·', '✢', '✳', '∗', '✻', '✽', '✻', '∗', '✳', '✢']
const GERUNDS = ['Thinking', 'Synthesizing', 'Reasoning', 'Pondering', 'Composing', 'Ruminating', 'Cooking', 'Crunching', 'Percolating', 'Noodling', 'Wrangling', 'Conjuring']

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
  const [frame, setFrame] = useState(0)
  const [word, setWord] = useState(0)
  const isRunning = thinking.status === 'running'

  useEffect(() => {
    if (!isRunning) return

    setSeconds(0)
    setFrame(0)
    setWord(0)

    const timeInterval = setInterval(() => setSeconds(s => s + 1), 1000)
    const spin = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 120)
    const cycle = setInterval(() => setWord(w => (w + 1) % GERUNDS.length), 2800)

    return () => {
      clearInterval(timeInterval)
      clearInterval(spin)
      clearInterval(cycle)
    }
  }, [isRunning])

  // Running state — starburst + rotating gerund + real elapsed time. Only the last
  // one renders, to avoid flooding. No token count here: there's no real streaming
  // count mid-run, and a simulated one is misleading — real tokens/cost/duration
  // show on the done line below.
  if (isRunning) {
    if (!isLast) return null

    return (
      <div className="py-1.5">
        <div className="flex items-center gap-1.5 text-xs font-mono ml-5">
          <span className="inline-block w-3 text-center text-sm leading-none text-neutral-400">{SPINNER_FRAMES[frame]}</span>
          <span className="font-medium text-neutral-500">{GERUNDS[word]}…</span>
          <span className="tabular-nums text-neutral-400">({seconds > 0 ? formatTime(seconds) : '0s'})</span>
        </div>
      </div>
    )
  }

  // Content state (e.g. detailed thoughts)
  if (thinking.content) {
    return (
      <div className="py-2 ml-5">
        <div className="relative pl-4 border-l-2 border-neutral-200">
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
        {/* Stats stay one line — the model name truncates first on narrow screens */}
        <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-xs text-neutral-400 font-mono ml-5">
          <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-neutral-300" />
          <span className="min-w-0 truncate">{model || 'done'}</span>
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
