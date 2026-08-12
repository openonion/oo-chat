'use client'

import { useEffect, useCallback } from 'react'
import { HiOutlineShieldCheck, HiOutlineClipboardList, HiOutlineLightningBolt } from 'react-icons/hi'
import type { ApprovalMode } from './types'

interface ModeStatusBarProps {
  mode: ApprovalMode
  onModeChange: (mode: ApprovalMode, options?: { turns?: number }) => void
  disabled?: boolean
  fullAccessTurnsRemaining?: number | null
  sessionState?: 'idle' | 'connected' | 'active' | 'disconnected' | 'reconnecting'
  isLoading?: boolean
  connectionError?: string | null
  onRetry?: () => void
  onReconnect?: () => void
}

// Shift+Tab covers only the base modes. Full access stays a deliberate click.
const CYCLE_MODES: ApprovalMode[] = ['default', 'plan', 'auto_approve']
const MODE_BUTTONS: ApprovalMode[] = [...CYCLE_MODES, 'full_access']

// Modes are differentiated by fill/weight, not hue — the active mode reads as a
// filled black chip. Red is reserved for Full access (dangerous, fully autonomous).
const MODE_CONFIG: Record<string, { icon: React.ElementType; label: string; shortLabel: string; description: string; color: string; bgColor: string }> = {
  default: {
    icon: HiOutlineShieldCheck,
    label: 'Default',
    shortLabel: 'Default',
    description: 'Ask before edits & commands',
    color: 'text-white',
    bgColor: 'bg-neutral-900 border-neutral-900',
  },
  plan: {
    icon: HiOutlineClipboardList,
    label: 'Plan Mode',
    shortLabel: 'Plan',
    description: 'Research first, then approve plan',
    color: 'text-white',
    bgColor: 'bg-neutral-900 border-neutral-900',
  },
  auto_approve: {
    icon: HiOutlineLightningBolt,
    label: 'Auto-approve',
    shortLabel: 'Auto-approve',
    description: 'Apply named edits without asking',
    color: 'text-white',
    bgColor: 'bg-neutral-900 border-neutral-900',
  },
  full_access: {
    icon: HiOutlineLightningBolt,
    label: 'Full access (YOLO)',
    shortLabel: 'Full access',
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

/** Left-right split status bar: connection on left, mode cycle on right */
export function ModeStatusBar({ mode, onModeChange, disabled, sessionState, connectionError, onRetry, onReconnect, fullAccessTurnsRemaining }: ModeStatusBarProps) {
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
                <button
                  onClick={onRetry}
                  className="-my-1.5 inline-flex min-h-6 items-center py-1.5 text-[11px] text-red-600 underline hover:text-red-700"
                >
                  retry
                </button>
              )}
            </div>
          ) : sessionState === 'disconnected' ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <span className="text-[11px] text-neutral-500">disconnected</span>
              {onReconnect && (
                <button
                  onClick={onReconnect}
                  className="-my-1.5 inline-flex min-h-6 items-center py-1.5 text-[11px] text-neutral-500 underline hover:text-neutral-700"
                >
                  reconnect
                </button>
              )}
            </div>
          ) : sessionState === 'active' ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
              <span className="text-[11px] text-brand-600">live</span>
            </div>
          ) : sessionState === 'connected' ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <span className="text-[11px] text-neutral-500">connected</span>
            </div>
          ) : null
        )}
      </div>

      {/* Right: Full access shows as a red pill (dangerous mode); otherwise a segmented mode control */}
      {mode === 'full_access' ? (
        <button
          onClick={() => onModeChange('default')}
          disabled={disabled}
          className="inline-flex min-h-6 items-center text-[11px] font-medium px-2.5 py-1 rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Full access (YOLO) — fully autonomous · Click to exit to Default"
        >
          Full access{typeof fullAccessTurnsRemaining === 'number' ? ` · ${fullAccessTurnsRemaining} left` : ''}
        </button>
      ) : (
        <div className="inline-flex gap-0.5 rounded-md border border-neutral-200 bg-neutral-100 p-0.5" role="group" aria-label="Approval mode">
          {MODE_BUTTONS.map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m, m === 'full_access' ? { turns: 100 } : undefined)}
              disabled={disabled}
              className={`inline-flex min-h-6 items-center text-[11px] px-2.5 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                m === mode
                  ? 'bg-neutral-900 border border-neutral-900 font-medium text-white'
                  : m === 'full_access'
                    ? 'border border-transparent text-red-600 hover:bg-red-50'
                    : 'border border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
              title={`${MODE_CONFIG[m].label} — ${MODE_CONFIG[m].description}${m === 'full_access' ? '' : ' · ⇧Tab to cycle'}`}
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
