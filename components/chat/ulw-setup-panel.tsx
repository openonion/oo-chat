'use client'

import { useState, useRef, useEffect } from 'react'
import { HiOutlineRocketLaunch } from 'react-icons/hi2'
import { HiX, HiOutlineChevronDown } from 'react-icons/hi'
import { cn } from './utils'

interface UlwSetupPanelProps {
  initialGoal?: string
  onStart: (turns: number, goal: string, direction: string) => void
  onCancel: () => void
}

const TURN_OPTIONS = [10, 50, 100, 200]
const DEFAULT_TURNS = 100

export function UlwSetupPanel({ initialGoal = '', onStart, onCancel }: UlwSetupPanelProps) {
  const [goal, setGoal] = useState(initialGoal)
  const [turns, setTurns] = useState(DEFAULT_TURNS)
  const [direction, setDirection] = useState('')
  const [showDirection, setShowDirection] = useState(false)
  const [showTurnsMenu, setShowTurnsMenu] = useState(false)
  const goalRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    goalRef.current?.focus()
  }, [])

  const handleStart = () => {
    if (!goal.trim()) return
    onStart(turns, goal.trim(), direction.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleStart()
    }
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className="px-4 pb-6 pt-2">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-blue-100">
            <div className="flex items-center gap-2">
              <HiOutlineRocketLaunch className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Ultra Work Mode</span>
            </div>
            <button
              onClick={onCancel}
              className="text-blue-400 hover:text-blue-600 transition-colors"
              aria-label="Cancel"
            >
              <HiX className="w-4 h-4" />
            </button>
          </div>

          {/* Goal input */}
          <div className="px-4 pt-3 pb-2">
            <label className="text-[11px] font-medium text-blue-500 uppercase tracking-wide mb-1.5 block">
              Goal
            </label>
            <textarea
              ref={goalRef}
              value={goal}
              onChange={e => setGoal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What should the agent work on?"
              rows={2}
              className="w-full resize-none bg-transparent text-[15px] text-neutral-900 placeholder-neutral-400 focus:outline-none font-medium leading-relaxed"
            />
          </div>

          {/* Direction (optional) */}
          {showDirection ? (
            <div className="px-4 pb-3">
              <label className="text-[11px] font-medium text-blue-400 uppercase tracking-wide mb-1.5 block">
                Direction (optional)
              </label>
              <textarea
                value={direction}
                onChange={e => setDirection(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. mobile-first, clean code, skip tests"
                rows={2}
                className="w-full resize-none bg-transparent text-[13px] text-neutral-600 placeholder-neutral-400 focus:outline-none leading-relaxed"
              />
            </div>
          ) : (
            <div className="px-4 pb-3">
              <button
                onClick={() => setShowDirection(true)}
                className="text-[11px] text-blue-400 hover:text-blue-600 transition-colors"
              >
                + Add direction (optional)
              </button>
            </div>
          )}

          {/* Footer: turns + start */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-blue-100 bg-blue-50">
            {/* Turns picker */}
            <div className="relative">
              <button
                onClick={() => setShowTurnsMenu(!showTurnsMenu)}
                aria-expanded={showTurnsMenu}
                aria-haspopup="listbox"
                className="flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:text-blue-800 transition-colors"
              >
                <span>{turns} turns</span>
                <HiOutlineChevronDown className={cn('w-3.5 h-3.5 transition-transform', showTurnsMenu && 'rotate-180')} />
              </button>

              {showTurnsMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTurnsMenu(false)} />
                  <div
                    role="listbox"
                    aria-label="Select turns"
                    className="absolute left-0 bottom-full mb-1 z-50 bg-white rounded-xl shadow-xl border border-neutral-200 overflow-hidden min-w-[120px]"
                  >
                    {TURN_OPTIONS.map(t => (
                      <button
                        key={t}
                        role="option"
                        aria-selected={t === turns}
                        onClick={() => { setTurns(t); setShowTurnsMenu(false) }}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm transition-colors',
                          t === turns
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-neutral-700 hover:bg-neutral-50'
                        )}
                      >
                        {t} turns
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Start button */}
            <button
              onClick={handleStart}
              disabled={!goal.trim()}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-blue-600 text-white text-sm font-medium
                hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-150 shadow-sm"
            >
              <HiOutlineRocketLaunch className="w-4 h-4" />
              Start
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-neutral-400 mt-2">
          Ctrl+Enter to start · Esc to cancel
        </p>
      </div>
    </div>
  )
}
