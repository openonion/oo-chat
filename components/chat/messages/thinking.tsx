import { useState, useEffect } from 'react'
import type { ThinkingUI } from '../types'
import { usageStats } from './usage-stats'

// The running "thinking" line: three dots in a CSS wave (`.status-wave`), a rotating
// gerund and the real elapsed time. When the run ends the dots resolve to a check
// that draws itself (`.status-check`). It used to be a JS spinner that re-rendered
// the line every 120ms; the wave costs no renders. Screen readers hear one stable
// status ("Agent is working", then "Done"), never the gerund or the clock.
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

export function Thinking({ thinking, isLast = true, blocked = false }: {
  thinking: ThinkingUI
  isLast?: boolean
  /** The run is stopped, waiting for a human answer. It is not working. */
  blocked?: boolean
}) {
  const [seconds, setSeconds] = useState(0)
  const [word, setWord] = useState(0)
  /** The run just ended in this view: show the check for a moment. */
  const [justDone, setJustDone] = useState(false)
  const isRunning = thinking.status === 'running'

  // Resetting the counters is a state change driven by a prop change, not a
  // side effect. React's documented shape for that is an adjustment during
  // render — doing it inside the effect renders the stale value once first.
  const [prevRunning, setPrevRunning] = useState(isRunning)
  if (prevRunning !== isRunning) {
    setPrevRunning(isRunning)
    setSeconds(0)
    setWord(0)
    setJustDone(prevRunning && !isRunning)
  }

  useEffect(() => {
    if (!isRunning) return

    const timeInterval = setInterval(() => setSeconds(s => s + 1), 1000)
    const cycle = setInterval(() => setWord(w => (w + 1) % GERUNDS.length), 2800)

    return () => {
      clearInterval(timeInterval)
      clearInterval(cycle)
    }
  }, [isRunning])

  // The check stays long enough to be seen, then the line settles.
  useEffect(() => {
    if (!justDone) return
    const hide = setTimeout(() => setJustDone(false), 1600)
    return () => clearTimeout(hide)
  }, [justDone])

  // One live region for the whole line, always the first child, so a screen reader
  // hears the change from "working" to "done" instead of a node being swapped out.
  const announce = isRunning && isLast && !blocked ? 'Agent is working' : justDone && isLast ? 'Done' : ''
  const live = <span role="status" aria-live="polite" className="sr-only">{announce}</span>
  // The dots resolve to a check that draws itself, for a moment after the run ends.
  const check = justDone && isLast ? (
    <div data-agent-thinking="done" className="py-1.5">
      <div className="ml-[60px] flex items-center gap-1.5 text-xs font-mono">
        <svg aria-hidden="true" className="status-check h-3 w-3 text-success-700" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.5l2.2 2.2L9.5 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
        </svg>
        <span aria-hidden="true" className="font-medium text-neutral-500">Done</span>
      </div>
    </div>
  ) : null

  return <>{live}{renderBody()}</>

  function renderBody() {
    // Running state — starburst + rotating gerund + real elapsed time. Only the last
    // one renders, to avoid flooding. No token count here: there's no real streaming
    // count mid-run, and a simulated one is misleading — real tokens/cost/duration
    // show on the done line below.
    if (isRunning) {
      if (!isLast) return null

      // A spinner and a rising clock while the run is stopped on an approval is the
      // page's loudest statement, and it is false. Every other global signal agreed
      // with it — the composer stayed enabled with a Stop button, the token counter
      // kept ticking — while the one true indicator, "Waiting for Permission", was
      // pushed off the right edge of the phone. The reader is left with a screen that
      // says "busy" and a job that never finishes (#59).
      if (blocked) {
        return (
          <div className="py-1.5 ml-[60px] flex items-center gap-1.5 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 shrink-0" />
            <span className="font-medium text-neutral-700">Waiting on your answer</span>
          </div>
        )
      }

      return (
        <div data-agent-thinking="active" className="py-1.5">
          <div className="flex items-center gap-1.5 text-xs font-mono ml-[60px]">
            <span aria-hidden="true" className="status-wave text-neutral-400"><span /><span /><span /></span>
            <span aria-hidden="true" className="font-medium text-neutral-500">{GERUNDS[word]}…</span>
            <span aria-hidden="true" className="tabular-nums text-neutral-400">({seconds > 0 ? formatTime(seconds) : '0s'})</span>
          </div>
        </div>
      )
    }

    // Content state (e.g. detailed thoughts)
    if (thinking.content) {
      return (
        <div className="py-2 ml-[60px]">
          <div className="relative pl-4 border-l-2 border-neutral-200">
            <div className="text-ui text-neutral-600 leading-relaxed italic">
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
      const usage = usageStats(thinking.usage)
      const duration = thinking.duration_ms ? Math.round(thinking.duration_ms / 1000) : 0
      const hasModel = Boolean(model)
      const hasTokens = usage.totalTokens > 0
      const hasCost = usage.cost > 0
      const hasDuration = duration > 0

      // A bare "done · 0 tok" line adds noise without reporting any honest
      // telemetry. Keep the transcript quiet until the Host supplied at least one
      // real completion fact.
      if (!hasModel && !hasTokens && !hasCost && !hasDuration) return check

      return (
        <>
        {check}
        <details className="text-xs text-neutral-500">
          <summary className="w-fit cursor-pointer rounded py-2 focus-visible:outline-2 focus-visible:outline-neutral-900">Response details</summary>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 font-mono">
            <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-neutral-300" />
            {hasModel && <span className="hidden min-w-0 truncate sm:inline">{model}</span>}
            {hasModel && (hasTokens || hasCost || hasDuration) && <span className="hidden text-neutral-300 sm:inline">·</span>}
            {hasTokens && usage.hasBreakdown && (
              <>
                <span className="tabular-nums">{formatTokens(usage.uncachedInputTokens)} new</span>
                <span className="text-neutral-300">·</span>
                <span className="tabular-nums">{formatTokens(usage.cachedTokens)} cached</span>
                {usage.cacheWriteTokens > 0 && (
                  <>
                    <span className="text-neutral-300">·</span>
                    <span className="tabular-nums">{formatTokens(usage.cacheWriteTokens)} cache write</span>
                  </>
                )}
                <span className="text-neutral-300">·</span>
                <span className="tabular-nums">{formatTokens(usage.outputTokens)} out</span>
              </>
            )}
            {hasTokens && !usage.hasBreakdown && (
              <span className="tabular-nums">{formatTokens(usage.totalTokens)} tok</span>
            )}
            {hasTokens && (hasCost || hasDuration) && <span className="text-neutral-300">·</span>}
            {hasCost && (
              <>
                <span className="tabular-nums">${usage.cost.toFixed(4)}</span>
              </>
            )}
            {hasCost && hasDuration && <span className="text-neutral-300">·</span>}
            {hasDuration && (
              <>
                <span className="tabular-nums">{formatTime(duration)}</span>
              </>
            )}
          </div>
        </details>
        </>
      )
    }

    return check
  }
}
