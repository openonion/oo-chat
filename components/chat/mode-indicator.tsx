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

// Cycling (click / Shift+Tab) covers only the base modes — ULW is a deliberate
// opt-in with an explicit turns budget (see mode-switcher.tsx), never reached by accident.
const CYCLE_MODES: ApprovalMode[] = ['safe', 'plan', 'accept_edits']

// Modes are differentiated by fill/weight, not hue — the active mode reads as a
// filled black chip. Red is reserved for ULW (dangerous, fully autonomous).
const MODE_CONFIG: Record<string, { icon: React.ElementType; label: string; shortLabel: string; description: string; color: string; bgColor: string }> = {
  safe: {
    icon: HiOutlineShieldCheck,
    label: 'Safe Mode',
    shortLabel: 'safe',
    description: 'Ask before edits & commands',
    color: 'text-white',
    bgColor: 'bg-neutral-900 border-neutral-900',
  },
  plan: {
    icon: HiOutlineClipboardList,
    label: 'Plan Mode',
    shortLabel: 'plan',
    description: 'Research first, then approve plan',
    color: 'text-white',
    bgColor: 'bg-neutral-900 border-neutral-900',
  },
  accept_edits: {
    icon: HiOutlineLightningBolt,
    label: 'Accept Edits',
    shortLabel: 'accept',
    description: 'Edit without asking',
    color: 'text-white',
    bgColor: 'bg-neutral-900 border-neutral-900',
  },
  ulw: {
    icon: HiOutlineLightningBolt,
    label: 'Ultra Work',
    shortLabel: 'ultra',
    description: 'Fully autonomous for a set number of turns',
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
  },
}

// A trust mode must never flip silently while the user is typing.
function isTypingTarget(el: Element | null) {
  if (!el) return false
  const tag = (el as HTMLElement).tagName
  return tag === 'TEXTAREA' || tag === 'INPUT' || (el as HTMLElement).isContentEditable
}

export function ModeIndicator({ mode, onModeChange, disabled }: ModeIndicatorProps) {
  const currentMode = MODE_CONFIG[mode] || MODE_CONFIG.safe
  const Icon = currentMode.icon

  const cycleMode = useCallback(() => {
    if (disabled) return
    const currentIndex = CYCLE_MODES.indexOf(mode)
    const nextIndex = (currentIndex + 1) % CYCLE_MODES.length
    onModeChange(CYCLE_MODES[nextIndex])
  }, [mode, onModeChange, disabled])

  // Shift+Tab cycles modes, but never while focus is in an input, textarea, or
  // contentEditable — a security-relevant setting must not flip while typing.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(document.activeElement)) return
      if (e.shiftKey && e.key === 'Tab') {
        e.preventDefault()
        cycleMode()
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
export function ModeStatusBar({ mode, onModeChange, disabled, sessionState, connectionError, onRetry, onReconnect, ulwTurnsRemaining }: ModeStatusBarProps) {
  const cycleMode = useCallback(() => {
    if (disabled) return
    const currentIndex = CYCLE_MODES.indexOf(mode)
    const nextIndex = (currentIndex + 1) % CYCLE_MODES.length
    onModeChange(CYCLE_MODES[nextIndex])
  }, [mode, onModeChange, disabled])

  // Shift+Tab cycles modes, but never while focus is in an input, textarea, or
  // contentEditable — a security-relevant setting must not flip while typing.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(document.activeElement)) return
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
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[11px] text-red-600">error</span>
              {onRetry && (
                <button onClick={onRetry} className="text-[11px] text-red-600 hover:text-red-700 underline">
                  retry
                </button>
              )}
            </div>
          ) : sessionState === 'disconnected' ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <span className="text-[11px] text-neutral-500">disconnected</span>
              {onReconnect && (
                <button onClick={onReconnect} className="text-[11px] text-neutral-500 hover:text-neutral-700 underline">
                  reconnect
                </button>
              )}
            </div>
          ) : sessionState === 'active' ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[11px] text-green-600">live</span>
            </div>
          ) : sessionState === 'connected' ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <span className="text-[11px] text-neutral-500">connected</span>
            </div>
          ) : null
        )}
      </div>

      {/* Right: ULW shows as a red pill (dangerous mode); otherwise a segmented mode control */}
      {mode === 'ulw' ? (
        <button
          onClick={() => onModeChange('safe')}
          disabled={disabled}
          className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Ultra Work — fully autonomous · Click to exit to safe"
        >
          ultra{typeof ulwTurnsRemaining === 'number' ? ` · ${ulwTurnsRemaining} left` : ''}
        </button>
      ) : (
        <div className="inline-flex rounded-md border border-neutral-200 bg-neutral-100 p-0.5" role="group" aria-label="Approval mode">
          {CYCLE_MODES.map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              disabled={disabled}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                m === mode
                  ? 'bg-neutral-900 border border-neutral-900 font-medium text-white'
                  : 'border border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
              title={`${MODE_CONFIG[m].label} — ${MODE_CONFIG[m].description} · ⇧Tab to cycle`}
              aria-pressed={m === mode}
            >
              {MODE_CONFIG[m].shortLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
