'use client'

import { useEffect, useRef, useState } from 'react'
import type { Mode } from '@connectonion/react'
import { HiChevronDown } from 'react-icons/hi2'
import { selectableModes, type HostModeOption } from './mode-policy'
import { ActivityStatus, deriveActivityPhase, type ActivityPhase } from './activity-status'

interface ModeStatusBarProps {
  mode: Mode
  turnsLeft?: number | null
  onModeChange: (mode: Mode) => void
  availableModes?: ReadonlyArray<HostModeOption>
  disabled?: boolean
  modeChangePending?: boolean
  modeChangeError?: string | null
  modeRecoveryAction?: 'retry' | 'reconnect' | null
  onModeRetry?: () => void
  sessionState?: 'idle' | 'connected' | 'active' | 'disconnected' | 'reconnecting'
  connectionError?: string | null
  onReconnect?: () => void
  activityPhase?: ActivityPhase
}

const LABELS: Record<Mode, string> = {
  'read-only': 'Read only',
  auto: 'Auto',
  'full-access': 'Full access',
}

const DESCRIPTIONS: Record<Mode, string> = {
  'read-only': 'Ask before any change.',
  auto: 'Review each action and approve safe work automatically.',
  'full-access': 'Bypass approval for the bounded user-driven turns shown.',
}

export function ModeStatusBar({
  mode,
  turnsLeft,
  onModeChange,
  availableModes = [],
  disabled,
  modeChangePending,
  modeChangeError,
  modeRecoveryAction,
  onModeRetry,
  sessionState,
  connectionError,
  onReconnect,
  activityPhase,
}: ModeStatusBarProps) {
  const controlsDisabled = Boolean(disabled || modeChangePending)
  const phase = activityPhase ?? deriveActivityPhase({ connectionError, sessionState })
  const showActivity = phase !== 'connected' && phase !== 'idle'

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {phase === 'connected' && <span role="status" className="sr-only">Connected</span>}
      {(modeChangeError || modeChangePending || showActivity) && <div className="flex min-h-11 items-center gap-1.5">
        {modeChangeError ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-red-700">{modeChangeError}</span>
            {onModeRetry && (
              <button onClick={onModeRetry} className="min-h-11 px-2 text-xs text-red-700 underline">
                {modeRecoveryAction === 'reconnect' ? 'Reconnect' : 'Retry'}
              </button>
            )}
          </div>
        ) : modeChangePending ? (
          <span role="status" className="text-xs text-neutral-600">Changing mode…</span>
        ) : showActivity ? (
          <ActivityStatus phase={phase} compact onReconnect={onReconnect} />
        ) : null}
      </div>}
      <ModeControls key={controlsDisabled ? 'disabled' : 'ready'} mode={mode} turnsLeft={turnsLeft} onModeChange={onModeChange} availableModes={availableModes} disabled={controlsDisabled} />
    </div>
  )
}

function ModeControls({ mode, turnsLeft, onModeChange, availableModes, disabled }: {
  mode: Mode
  turnsLeft?: number | null
  onModeChange: (mode: Mode) => void
  availableModes: ReadonlyArray<HostModeOption>
  disabled: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmFullAccess, setConfirmFullAccess] = useState(false)
  const controlsRef = useRef<HTMLDivElement>(null)
  const choices = selectableModes(availableModes)
  const label = mode === 'full-access' && typeof turnsLeft === 'number'
    ? `${LABELS[mode]} · ${turnsLeft} turns left`
    : LABELS[mode]

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); setConfirmFullAccess(false) }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])

  useEffect(() => {
    if (!menuOpen && !confirmFullAccess) return
    const close = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
        setConfirmFullAccess(false)
      }
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menuOpen, confirmFullAccess])

  return (
    <div ref={controlsRef} className={`relative ml-auto flex flex-wrap items-center gap-1 ${mode === 'full-access' ? 'w-full justify-between rounded-lg bg-amber-50 px-1' : ''}`}>
      <button type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Mode: ${label}`} onClick={() => { setConfirmFullAccess(false); setMenuOpen((open) => !open) }} className={`flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-medium disabled:opacity-50 ${mode === 'full-access' ? 'text-amber-900' : 'text-neutral-700 hover:bg-neutral-100'}`}>
        <span>{label}</span><HiChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-neutral-500" />
      </button>

      {mode === 'full-access' && <button type="button" aria-label="Exit Full access" disabled={disabled}
        onClick={() => onModeChange('auto')}
        className="min-h-11 rounded px-2 text-xs font-semibold text-amber-950 underline decoration-amber-400 underline-offset-4 hover:bg-amber-100 disabled:opacity-50">Exit Full access</button>}

      {menuOpen && !confirmFullAccess && (
        <div role="menu" aria-label="Agent mode" className="absolute bottom-full right-0 z-30 mb-2 w-72 max-w-[calc(100vw-3rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
          {choices.map((choice) => (
            <button key={choice} role="menuitemradio" aria-label={LABELS[choice]} aria-checked={choice === mode} className="flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs hover:bg-neutral-100" onClick={() => {
              if (choice === 'full-access' && choice !== mode) { setMenuOpen(false); setConfirmFullAccess(true) }
              else { setMenuOpen(false); onModeChange(choice) }
            }}>
              <span><span className="font-medium">{LABELS[choice]}</span><span className="block text-neutral-500">{DESCRIPTIONS[choice]}</span></span>
              <span aria-hidden="true">{choice === mode ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      )}

      {confirmFullAccess && (
        <div role="dialog" aria-label="Confirm Full access" className="absolute bottom-full right-0 z-30 mb-2 w-72 max-w-[calc(100vw-3rem)] rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900 shadow-lg">
          <p className="font-medium">Enable bounded Full access?</p>
          <p className="mt-1 text-red-800">It bypasses approvals only for Host-limited user-driven turns and never continues by itself.</p>
          <div className="mt-3 flex justify-end gap-2">
            <button className="min-h-9 rounded px-2.5" onClick={() => setConfirmFullAccess(false)}>Cancel</button>
            <button className="min-h-9 rounded bg-red-700 px-2.5 font-medium text-white" onClick={() => { setConfirmFullAccess(false); onModeChange('full-access') }}>Enable</button>
          </div>
        </div>
      )}
    </div>
  )
}
