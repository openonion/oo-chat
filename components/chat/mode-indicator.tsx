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

interface ModeStatusBarProps extends ModeIndicatorProps {
  sessionState?: 'idle' | 'connected' | 'active' | 'disconnected' | 'reconnecting'
  isLoading?: boolean
  connectionError?: string | null
  onRetry?: () => void
  onReconnect?: () => void
}

const BASE_MODES: ApprovalMode[] = ['safe', 'plan', 'accept_edits', 'ulw']

const MODE_CONFIG: Record<string, { icon: React.ElementType; label: string; shortLabel: string; color: string; bgColor: string }> = {
  safe: {
    icon: HiOutlineShieldCheck,
    label: 'Safe Mode',
    shortLabel: 'safe',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 border-emerald-200',
  },
  plan: {
    icon: HiOutlineClipboardList,
    label: 'Plan Mode',
    shortLabel: 'plan',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
  },
  accept_edits: {
    icon: HiOutlineLightningBolt,
    label: 'Accept Edits',
    shortLabel: 'accept',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-200',
  },
  ulw: {
    icon: HiOutlineLightningBolt,
    label: 'Ultra Work',
    shortLabel: 'ultra',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
  },
}

export function ModeIndicator({ mode, onModeChange, disabled }: ModeIndicatorProps) {
  const currentMode = MODE_CONFIG[mode] || MODE_CONFIG.safe
  const Icon = currentMode.icon

  const cycleMode = useCallback(() => {
    if (disabled) return
    const currentIndex = BASE_MODES.indexOf(mode)
    const nextIndex = (currentIndex + 1) % BASE_MODES.length
    onModeChange(BASE_MODES[nextIndex])
  }, [mode, onModeChange, disabled])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.key === 'Tab') {
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

/** Left-right split status bar: connection on left, mode cycle on right */
export function ModeStatusBar({ mode, onModeChange, disabled, sessionState, connectionError, onRetry, onReconnect }: ModeStatusBarProps) {
  const currentMode = MODE_CONFIG[mode] || MODE_CONFIG.safe

  const cycleMode = useCallback(() => {
    if (disabled) return
    const currentIndex = BASE_MODES.indexOf(mode)
    const nextIndex = (currentIndex + 1) % BASE_MODES.length
    onModeChange(BASE_MODES[nextIndex])
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

  // Connection indicator (left side)
  const showConnection = sessionState === 'active' || sessionState === 'connected' || sessionState === 'disconnected' || sessionState === 'reconnecting' || !!connectionError

  return (
    <div className="flex items-center justify-between">
      {/* Left: Connection status */}
      <div className="flex items-center gap-1.5">
        {showConnection && (
          connectionError ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-[11px] text-red-400">error</span>
              {onRetry && (
                <button onClick={onRetry} className="text-[11px] text-red-400 hover:text-red-600 underline">
                  retry
                </button>
              )}
            </div>
          ) : sessionState === 'disconnected' ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <span className="text-[11px] text-neutral-400">disconnected</span>
              {onReconnect && (
                <button onClick={onReconnect} className="text-[11px] text-neutral-400 hover:text-neutral-600 underline">
                  reconnect
                </button>
              )}
            </div>
          ) : sessionState === 'active' ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[11px] text-green-500">live</span>
            </div>
          ) : sessionState === 'connected' ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <span className="text-[11px] text-neutral-400">connected</span>
            </div>
          ) : null
        )}
      </div>

      {/* Right: Mode cycle */}
      <button
        onClick={cycleMode}
        disabled={disabled}
        className="text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={`${currentMode.shortLabel} mode · Click or ⇧Tab to cycle`}
      >
        {BASE_MODES.map((m, i) => (
          <span key={m}>
            {i > 0 && <span className="mx-0.5">·</span>}
            <span className={m === mode ? 'text-neutral-700 font-medium' : ''}>
              {MODE_CONFIG[m].shortLabel}
            </span>
          </span>
        ))}
      </button>
    </div>
  )
}
