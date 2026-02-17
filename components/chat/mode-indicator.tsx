'use client'

import { useEffect, useCallback } from 'react'
import { HiOutlineShieldCheck, HiOutlineClipboardList, HiOutlineLightningBolt } from 'react-icons/hi'
import { HiOutlineRocketLaunch } from 'react-icons/hi2'
import type { ApprovalMode } from './types'

interface ModeIndicatorProps {
  mode: ApprovalMode
  onModeChange: (mode: ApprovalMode, options?: { turns?: number }) => void
  disabled?: boolean
  /** ULW mode: turns remaining (max - used) */
  ulwTurnsRemaining?: number | null
}

const MODES: ApprovalMode[] = ['safe', 'plan', 'accept_edits', 'ulw']

const MODE_CONFIG: Record<ApprovalMode, { icon: React.ElementType; label: string; shortLabel: string; color: string; bgColor: string }> = {
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
    shortLabel: 'accept edits',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  },
  ulw: {
    icon: HiOutlineRocketLaunch,
    label: 'Ultra Light Work',
    shortLabel: 'ulw',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
  },
}

export function ModeIndicator({ mode, onModeChange, disabled }: ModeIndicatorProps) {
  const currentMode = MODE_CONFIG[mode] || MODE_CONFIG.safe
  const Icon = currentMode.icon

  // Cycle to next mode
  const cycleMode = useCallback(() => {
    if (disabled) return
    const currentIndex = MODES.indexOf(mode)
    const nextIndex = (currentIndex + 1) % MODES.length
    onModeChange(MODES[nextIndex])
  }, [mode, onModeChange, disabled])

  // Keyboard shortcut: Shift+Tab to cycle modes
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.key === 'Tab') {
        // Only trigger if not in an input/textarea with actual tab behavior needed
        const target = e.target as HTMLElement
        if (target.tagName !== 'TEXTAREA' || !target.closest('[data-mode-indicator-input]')) {
          e.preventDefault()
          cycleMode()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cycleMode])

  return (
    <button
      onClick={cycleMode}
      disabled={disabled}
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium
        border transition-all
        ${currentMode.bgColor}
        hover:opacity-80
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      title="Click or Shift+Tab to cycle modes"
    >
      <Icon className={`w-3.5 h-3.5 ${currentMode.color}`} />
      <span className={currentMode.color}>{currentMode.shortLabel}</span>
    </button>
  )
}

/** Compact status bar below input - Claude Code style */
export function ModeStatusBar({ mode, onModeChange, disabled, ulwTurnsRemaining }: ModeIndicatorProps) {
  const currentMode = MODE_CONFIG[mode] || MODE_CONFIG.safe
  const Icon = currentMode.icon

  // Cycle to next mode
  const cycleMode = useCallback(() => {
    if (disabled) return
    const currentIndex = MODES.indexOf(mode)
    const nextIndex = (currentIndex + 1) % MODES.length
    onModeChange(MODES[nextIndex])
  }, [mode, onModeChange, disabled])

  // Keyboard shortcut: Shift+Tab to cycle modes
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.key === 'Tab') {
        e.preventDefault()
        cycleMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cycleMode])

  // Build label with ULW turns if applicable
  const modeLabel = mode === 'ulw' && ulwTurnsRemaining != null
    ? `${currentMode.shortLabel} (${ulwTurnsRemaining} left)`
    : currentMode.shortLabel

  return (
    <div className="flex items-center justify-center gap-3 pt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
      {/* Mode indicator */}
      <button
        onClick={cycleMode}
        disabled={disabled}
        className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        title="Click or Shift+Tab to cycle modes"
      >
        <span className={currentMode.color}>▸▸</span>
        <Icon className={`w-3 h-3 ${currentMode.color}`} />
        <span className={`font-medium ${currentMode.color}`}>{modeLabel}</span>
      </button>

      <span className="text-neutral-300 dark:text-neutral-600">·</span>

      {/* Hints */}
      <span>shift+tab to cycle</span>
      <span className="text-neutral-300 dark:text-neutral-600">·</span>
      <span>enter to send</span>
    </div>
  )
}
