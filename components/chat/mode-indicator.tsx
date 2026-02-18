'use client'

import { useEffect, useCallback } from 'react'
import { HiOutlineShieldCheck, HiOutlineClipboardList, HiOutlineLightningBolt } from 'react-icons/hi'
import type { ApprovalMode } from './types'

interface ModeIndicatorProps {
  mode: ApprovalMode
  onModeChange: (mode: ApprovalMode, options?: { turns?: number }) => void
  disabled?: boolean
  ulwTurnsRemaining?: number | null
}

// Base modes only - ULW is a separate toggle component
const BASE_MODES: ApprovalMode[] = ['safe', 'plan', 'accept_edits']

const MODE_CONFIG: Record<string, { icon: React.ElementType; label: string; shortLabel: string; color: string; bgColor: string }> = {
  safe: {
    icon: HiOutlineShieldCheck,
    label: 'Safe Mode',
    shortLabel: 'safe',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  },
  plan: {
    icon: HiOutlineClipboardList,
    label: 'Plan Mode',
    shortLabel: 'plan',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
  },
  accept_edits: {
    icon: HiOutlineLightningBolt,
    label: 'Accept Edits',
    shortLabel: 'accept',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  },
}

export function ModeIndicator({ mode, onModeChange, disabled }: ModeIndicatorProps) {
  // When in ULW, show 'safe' as the display mode (ULW is handled separately)
  const displayMode = mode === 'ulw' ? 'safe' : mode
  const isUlwActive = mode === 'ulw'
  const currentMode = MODE_CONFIG[displayMode] || MODE_CONFIG.safe
  const Icon = currentMode.icon

  // Cycle through base modes (not ULW)
  const cycleMode = useCallback(() => {
    if (disabled || isUlwActive) return
    const currentIndex = BASE_MODES.indexOf(displayMode as ApprovalMode)
    const nextIndex = (currentIndex + 1) % BASE_MODES.length
    onModeChange(BASE_MODES[nextIndex])
  }, [displayMode, onModeChange, disabled, isUlwActive])

  // Keyboard shortcut: Shift+Tab to cycle modes
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.key === 'Tab' && !isUlwActive) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'TEXTAREA' || !target.closest('[data-mode-indicator-input]')) {
          e.preventDefault()
          cycleMode()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cycleMode, isUlwActive])

  return (
    <button
      onClick={cycleMode}
      disabled={disabled || isUlwActive}
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium
        border transition-all
        ${currentMode.bgColor}
        hover:opacity-80
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      title={isUlwActive ? 'Exit ULW to change mode' : 'Click or Shift+Tab to cycle modes'}
    >
      <Icon className={`w-3.5 h-3.5 ${currentMode.color}`} />
      <span className={currentMode.color}>{currentMode.shortLabel}</span>
    </button>
  )
}

/** Minimal status bar - whisper quiet, goal-focused */
export function ModeStatusBar({ mode, onModeChange, disabled, ulwTurnsRemaining }: ModeIndicatorProps) {
  const displayMode = mode === 'ulw' ? 'safe' : mode
  const isUlwActive = mode === 'ulw'

  // Cycle through base modes (not ULW)
  const cycleMode = useCallback(() => {
    if (disabled || isUlwActive) return
    const currentIndex = BASE_MODES.indexOf(displayMode as ApprovalMode)
    const nextIndex = (currentIndex + 1) % BASE_MODES.length
    onModeChange(BASE_MODES[nextIndex])
  }, [displayMode, onModeChange, disabled, isUlwActive])

  // Keyboard shortcut: Shift+Tab to cycle modes (only when not in ULW)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.key === 'Tab' && !isUlwActive) {
        e.preventDefault()
        cycleMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cycleMode, isUlwActive])

  return (
    <div className="flex items-center justify-between">
      {/* Left: Mode - tiny, muted, clickable */}
      <button
        onClick={cycleMode}
        disabled={disabled || isUlwActive}
        className={`
          text-[11px] transition-colors
          ${isUlwActive
            ? 'text-orange-400 cursor-default'
            : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
          }
        `}
        title={isUlwActive ? `Ultra work mode · ${ulwTurnsRemaining} turns left` : `${displayMode} mode · Click or ⇧Tab to cycle`}
      >
        {isUlwActive ? `ultra · ${ulwTurnsRemaining ?? 100}` : displayMode}
      </button>

      {/* Right: Auto toggle - minimal switch */}
      <button
        onClick={() => isUlwActive
          ? onModeChange('safe')
          : onModeChange('ulw', { turns: 100 })
        }
        className="group flex items-center gap-1.5"
        title={isUlwActive ? 'Turn off ultra work mode' : 'Turn on ultra work mode (100 turns)'}
      >
        {/* Switch track */}
        <div className={`
          relative w-8 h-4 rounded-full transition-all duration-200
          ${isUlwActive
            ? 'bg-orange-500'
            : 'bg-neutral-300 dark:bg-neutral-600 group-hover:bg-neutral-400 dark:group-hover:bg-neutral-500'
          }
        `}>
          {/* Switch thumb */}
          <div className={`
            absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm
            transition-all duration-200
            ${isUlwActive ? 'left-[calc(100%-0.875rem)]' : 'left-0.5'}
          `} />
        </div>

        {/* Label - only show when off */}
        {!isUlwActive && (
          <span className="text-[10px] text-neutral-400 group-hover:text-neutral-500">
            ultra
          </span>
        )}
      </button>
    </div>
  )
}
