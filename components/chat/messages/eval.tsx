import { useState, useEffect } from 'react'
import type { EvalUI } from '../types'

interface EvalProps {
  eval: EvalUI
}

export function Eval({ eval: evalData }: EvalProps) {
  const [seconds, setSeconds] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const isEvaluating = evalData.status === 'evaluating'

  // Timer for evaluating state
  useEffect(() => {
    if (!isEvaluating) {
      setSeconds(0)
      return
    }

    const interval = setInterval(() => {
      setSeconds(s => s + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isEvaluating])

  // Evaluating state - show spinner
  if (isEvaluating) {
    return (
      <div className="flex justify-start py-1">
        <div className="flex items-center gap-1.5 text-neutral-400 border-l-2 border-neutral-200 pl-3">
          <div className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-neutral-400 animate-pulse animation-delay-0" />
            <span className="w-1 h-1 rounded-full bg-neutral-400 animate-pulse animation-delay-100" />
            <span className="w-1 h-1 rounded-full bg-neutral-400 animate-pulse animation-delay-200" />
          </div>
          <span className="text-xs">
            {seconds > 0 ? `${seconds}s · ` : ''}evaluating
          </span>
        </div>
      </div>
    )
  }

  // Done state - show structured result
  if (evalData.status === 'done' && evalData.summary) {
    const passed = evalData.passed ?? true
    const hasDetails = evalData.expected || evalData.eval_path

    return (
      <div className="flex justify-start py-1">
        <div className={`border-l-2 pl-3 ${passed ? 'border-green-200' : 'border-red-200'}`}>
          {/* Summary line - clickable to expand if has details */}
          <button
            onClick={() => hasDetails && setExpanded(!expanded)}
            className={`flex items-start gap-1.5 text-xs text-neutral-500 ${hasDetails ? 'hover:text-neutral-700 cursor-pointer' : 'cursor-default'} transition-colors text-left`}
          >
            {/* Status icon */}
            <span className={`flex-shrink-0 ${passed ? 'text-green-500' : 'text-red-500'}`}>
              {passed ? '✓' : '✗'}
            </span>
            {/* Summary text */}
            <span>{evalData.summary}</span>
            {/* Expand indicator */}
            {hasDetails && (
              <span className="flex-shrink-0 text-neutral-300 ml-1">
                {expanded ? '▾' : '▸'}
              </span>
            )}
          </button>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-1.5 pl-4 space-y-1 text-xs text-neutral-400">
              {/* Expected outcome */}
              {evalData.expected && (
                <div>
                  <span className="text-neutral-300">expected: </span>
                  {evalData.expected}
                </div>
              )}
              {/* Eval file path */}
              {evalData.eval_path && (
                <div className="font-mono text-neutral-300">
                  {evalData.eval_path}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
