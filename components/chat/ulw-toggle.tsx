'use client'

/**
 * @purpose Prominent ULW (Ultra Light Work) toggle button
 *
 * ULW is a "turbo boost" mode - let agent work autonomously for N turns.
 * This is separate from the mode selector (safe/plan/accept_edits) because:
 * - It's a temporary autonomous session, not a permission mode
 * - Users toggle it frequently
 * - It needs to be visually prominent and easy to access
 */

import { useState, useCallback } from 'react'
import { HiOutlineRocketLaunch } from 'react-icons/hi2'
import { HiX } from 'react-icons/hi'
import type { ApprovalMode } from './types'

interface UlwToggleProps {
  isActive: boolean
  turnsRemaining: number | null
  onActivate: (turns: number) => void
  onDeactivate: () => void
  disabled?: boolean
}

const DEFAULT_TURNS = 100

export function UlwToggle({
  isActive,
  turnsRemaining,
  onActivate,
  onDeactivate,
  disabled
}: UlwToggleProps) {
  const [showTurnsMenu, setShowTurnsMenu] = useState(false)

  const handleActivate = useCallback((turns: number) => {
    onActivate(turns)
    setShowTurnsMenu(false)
  }, [onActivate])

  if (isActive) {
    // ULW is ON - prominent blue pill showing remaining turns
    return (
      <div className="relative">
        <button
          onClick={onDeactivate}
          disabled={disabled}
          className="group flex items-center gap-2 px-4 py-2 rounded-full
            bg-gradient-to-r from-blue-500 to-blue-600
            text-white font-medium text-sm
            shadow-lg shadow-blue-500/30
            hover:from-blue-600 hover:to-blue-700
            hover:shadow-blue-500/40
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            animate-in fade-in slide-in-from-bottom-2"
          title="Click to stop ultra work mode"
        >
          <HiOutlineRocketLaunch className="w-4 h-4" />
          <span>{turnsRemaining ?? '?'} turns left</span>
          <HiX className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    )
  }

  // ULW is OFF - show toggle button
  return (
    <div className="relative">
      <button
        onClick={() => setShowTurnsMenu(!showTurnsMenu)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full
          bg-neutral-100 dark:bg-neutral-800
          text-neutral-600 dark:text-neutral-400
          hover:bg-blue-50 dark:hover:bg-blue-950/50
          hover:text-blue-600 dark:hover:text-blue-400
          border border-neutral-200 dark:border-neutral-700
          hover:border-blue-300 dark:hover:border-blue-600
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200
          text-sm font-medium"
        title="Enable ultra work mode - agent works autonomously"
      >
        <HiOutlineRocketLaunch className="w-4 h-4" />
        <span>Ultra</span>
      </button>

      {/* Turns selection dropdown */}
      {showTurnsMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowTurnsMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 z-50
            bg-white dark:bg-neutral-800
            rounded-xl shadow-xl
            border border-neutral-200 dark:border-neutral-700
            overflow-hidden
            min-w-[180px]
            animate-in fade-in slide-in-from-top-2 duration-150">

            <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Autonomous turns
              </p>
            </div>

            <div className="py-1">
              {[10, 50, 100, 200].map((turns) => (
                <button
                  key={turns}
                  onClick={() => handleActivate(turns)}
                  className="w-full px-4 py-2 text-left text-sm
                    text-neutral-700 dark:text-neutral-300
                    hover:bg-blue-50 dark:hover:bg-blue-950/50
                    hover:text-blue-600 dark:hover:text-blue-400
                    transition-colors"
                >
                  <span className="font-medium">{turns}</span>
                  <span className="text-neutral-400 ml-1">turns</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Wrapper props for use with mode/session state */
interface UlwToggleWrapperProps {
  mode: ApprovalMode
  ulwTurnsRemaining: number | null
  onModeChange: (mode: ApprovalMode, options?: { turns?: number }) => void
  disabled?: boolean
}

export function UlwToggleWrapper({
  mode,
  ulwTurnsRemaining,
  onModeChange,
  disabled
}: UlwToggleWrapperProps) {
  const isActive = mode === 'ulw'

  const handleActivate = useCallback((turns: number) => {
    onModeChange('ulw', { turns })
  }, [onModeChange])

  const handleDeactivate = useCallback(() => {
    onModeChange('safe')
  }, [onModeChange])

  return (
    <UlwToggle
      isActive={isActive}
      turnsRemaining={ulwTurnsRemaining}
      onActivate={handleActivate}
      onDeactivate={handleDeactivate}
      disabled={disabled}
    />
  )
}
