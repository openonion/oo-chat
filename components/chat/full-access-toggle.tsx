'use client'

/**
 * @purpose Prominent Full access (YOLO) toggle button
 *
 * Full access is a "turbo boost" mode - let agent work autonomously for N turns.
 * This is separate from the base mode selector (`default`/`plan`/`auto_approve`) because:
 * - It's a temporary autonomous session, not a permission mode
 * - Users toggle it frequently
 * - It needs to be visually prominent and easy to access
 */

import { useState, useCallback } from 'react'
import { HiOutlineRocketLaunch } from 'react-icons/hi2'
import { HiX } from 'react-icons/hi'
import type { ApprovalMode } from './types'

interface FullAccessToggleProps {
  isActive: boolean
  turnsRemaining: number | null
  onActivate: (turns: number) => void
  onDeactivate: () => void
  disabled?: boolean
}

export function FullAccessToggle({
  isActive,
  turnsRemaining,
  onActivate,
  onDeactivate,
  disabled
}: FullAccessToggleProps) {
  const [showTurnsMenu, setShowTurnsMenu] = useState(false)

  const handleActivate = useCallback((turns: number) => {
    onActivate(turns)
    setShowTurnsMenu(false)
  }, [onActivate])

  if (isActive) {
    // Full access is ON - prominent black pill showing remaining turns
    return (
      <div className="relative">
        <button
          onClick={onDeactivate}
          disabled={disabled}
          className="group flex items-center gap-2 px-4 py-2 rounded-full
            bg-neutral-900
            text-white font-medium text-sm
            shadow-lg
            hover:bg-neutral-800
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            animate-in fade-in slide-in-from-bottom-2"
          title="Click to stop full access mode"
        >
          <HiOutlineRocketLaunch className="w-4 h-4" />
          <span>{turnsRemaining ?? '?'} turns left</span>
          <HiX className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    )
  }

  // Full access is OFF - show toggle button
  return (
    <div className="relative">
      <button
        onClick={() => setShowTurnsMenu(!showTurnsMenu)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full
          bg-neutral-100
          text-neutral-600
          hover:bg-neutral-200
          hover:text-neutral-900
          border border-neutral-200
          hover:border-neutral-300
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200
          text-sm font-medium"
        title="Enable full access mode - agent works autonomously"
      >
        <HiOutlineRocketLaunch className="w-4 h-4" />
        <span>Full access</span>
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
            bg-white
            rounded-xl shadow-xl
            border border-neutral-200
            overflow-hidden
            min-w-[180px]
            animate-in fade-in slide-in-from-top-2 duration-150">

            <div className="px-3 py-2 border-b border-neutral-100">
              <p className="text-xs font-medium text-neutral-500">
                Autonomous turns
              </p>
            </div>

            <div className="py-1">
              {[10, 50, 100, 200].map((turns) => (
                <button
                  key={turns}
                  onClick={() => handleActivate(turns)}
                  className="w-full px-4 py-2 text-left text-sm
                    text-neutral-700
                    hover:bg-neutral-50
                    hover:text-neutral-900
                    transition-colors"
                >
                  <span className="font-medium">{turns}</span>
                  <span className="text-neutral-500 ml-1">turns</span>
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
interface FullAccessToggleWrapperProps {
  mode: ApprovalMode
  fullAccessTurnsRemaining: number | null
  onModeChange: (mode: ApprovalMode, options?: { turns?: number }) => void
  disabled?: boolean
}

export function FullAccessToggleWrapper({
  mode,
  fullAccessTurnsRemaining,
  onModeChange,
  disabled
}: FullAccessToggleWrapperProps) {
  const isActive = mode === 'full_access'

  const handleActivate = useCallback((turns: number) => {
    onModeChange('full_access', { turns })
  }, [onModeChange])

  const handleDeactivate = useCallback(() => {
    onModeChange('default')
  }, [onModeChange])

  return (
    <FullAccessToggle
      isActive={isActive}
      turnsRemaining={fullAccessTurnsRemaining}
      onActivate={handleActivate}
      onDeactivate={handleDeactivate}
      disabled={disabled}
    />
  )
}
