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
  const showConnection = sessionState === 'active'
    || sessionState === 'connected'
    || sessionState === 'disconnected'
    || sessionState === 'reconnecting'
    || !!connectionError
  const phase = activityPhase ?? deriveActivityPhase({ connectionError, sessionState })

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-h-11 items-center gap-1.5">
        {modeChangeError ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-red-600">{modeChangeError}</span>
            {onModeRetry && (
              <button onClick={onModeRetry} className="min-h-11 px-2 text-[11px] text-red-600 underline">
                {modeRecoveryAction === 'reconnect' ? 'reconnect' : 'retry'}
              </button>
            )}
          </div>
        ) : modeChangePending ? (
          <span role="status" className="text-[11px] text-neutral-500">changing mode…</span>
        ) : showConnection || activityPhase ? (
          <ActivityStatus phase={phase} compact onReconnect={onReconnect} />
        ) : null}
      </div>
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
    ? `${LABELS[mode]} · ${turnsLeft} left`
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
    <div ref={controlsRef} className="relative ml-auto">
      <button type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Mode: ${label}`} onClick={() => { setConfirmFullAccess(false); setMenuOpen((open) => !open) }} className="flex min-h-11 items-center gap-1 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-800 shadow-sm disabled:opacity-50">
        <span>{label}</span><HiChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-neutral-400" />
      </button>

      {menuOpen && !confirmFullAccess && (
        <div role="menu" aria-label="Agent mode" className="mt-2 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-lg sm:absolute sm:bottom-full sm:right-0 sm:z-30 sm:mb-2 sm:mt-0 sm:w-72">
          {choices.map((choice) => (
            <button key={choice} role="menuitemradio" aria-label={LABELS[choice]} aria-checked={choice === mode} className="flex min-h-11 w-full items-center justify-between rounded-md px-3 py-1 text-left text-[11px] hover:bg-neutral-100" onClick={() => {
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
        <div role="dialog" aria-label="Confirm Full access" className="mt-2 w-full rounded-lg border border-red-300 bg-red-50 p-3 text-[11px] text-red-900 shadow-lg sm:absolute sm:bottom-full sm:right-0 sm:z-30 sm:mb-2 sm:mt-0 sm:w-72">
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
