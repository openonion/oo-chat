'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CollaborationMode, ExecutionProfile } from '@connectonion/react'
import {
  selectableExecutionProfiles,
  type HostPermissionOption,
} from './mode-policy'

interface ModeStatusBarProps {
  collaborationMode: CollaborationMode
  executionProfile: ExecutionProfile
  onCollaborationModeChange: (mode: CollaborationMode) => void
  onExecutionProfileChange: (profile: ExecutionProfile) => void
  availableExecutionProfiles?: ReadonlyArray<HostPermissionOption>
  disabled?: boolean
  permissionProfileChangePending?: boolean
  permissionProfileChangeError?: string | null
  permissionProfileRecoveryAction?: 'retry' | 'reconnect' | null
  onPermissionProfileRetry?: () => void
  fullAccessTurnsRemaining?: number | null
  sessionState?: 'idle' | 'connected' | 'active' | 'disconnected' | 'reconnecting'
  connectionError?: string | null
  onReconnect?: () => void
}

const FALLBACK_LABELS: Record<ExecutionProfile, string> = {
  safe: 'Read only',
  default: 'Auto',
  full_access: 'Full access',
}

const DESCRIPTIONS: Record<ExecutionProfile, string> = {
  safe: 'Ask before a scoped change.',
  default: 'Run bounded workspace work automatically; broader requests ask.',
  full_access: 'Skip per-action approval within the Host limit.',
}

/** Host permissions and the optional local planning workflow are deliberately separate. */
export function ModeStatusBar({
  collaborationMode,
  executionProfile,
  onCollaborationModeChange,
  onExecutionProfileChange,
  availableExecutionProfiles = [],
  disabled,
  permissionProfileChangePending,
  permissionProfileChangeError,
  permissionProfileRecoveryAction,
  onPermissionProfileRetry,
  sessionState,
  connectionError,
  onReconnect,
  fullAccessTurnsRemaining,
}: ModeStatusBarProps) {
  const [confirmFullAccess, setConfirmFullAccess] = useState(false)
  const [permissionMenuOpen, setPermissionMenuOpen] = useState(false)
  const controlsRef = useRef<HTMLDivElement>(null)
  const controlsDisabled = disabled || permissionProfileChangePending
  const togglePlan = useCallback(() => {
    if (controlsDisabled) return
    onCollaborationModeChange(collaborationMode === 'plan' ? 'default' : 'plan')
  }, [collaborationMode, controlsDisabled, onCollaborationModeChange])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && (permissionMenuOpen || confirmFullAccess)) {
        setPermissionMenuOpen(false)
        setConfirmFullAccess(false)
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmFullAccess, permissionMenuOpen])

  useEffect(() => {
    if (!permissionMenuOpen && !confirmFullAccess) return
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!controlsRef.current?.contains(event.target as Node)) {
        setPermissionMenuOpen(false)
        setConfirmFullAccess(false)
      }
    }
    window.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [confirmFullAccess, permissionMenuOpen])

  useEffect(() => {
    if (controlsDisabled) setPermissionMenuOpen(false)
  }, [controlsDisabled])

  const choices = selectableExecutionProfiles(availableExecutionProfiles)
  const fullOption = availableExecutionProfiles.find((option) => option.profile === 'full_access')
  const currentExecutionLabel = FALLBACK_LABELS[executionProfile]
  const showConnection = sessionState === 'active'
    || sessionState === 'connected'
    || sessionState === 'disconnected'
    || sessionState === 'reconnecting'
    || !!connectionError

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-h-11 items-center gap-1.5">
        {permissionProfileChangeError ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-red-600">{permissionProfileChangeError}</span>
            {onPermissionProfileRetry && (
              <button onClick={onPermissionProfileRetry} className="min-h-11 px-2 text-[11px] text-red-600 underline">
                {permissionProfileRecoveryAction === 'reconnect' ? 'reconnect' : 'retry'}
              </button>
            )}
          </div>
        ) : permissionProfileChangePending ? (
          <span role="status" className="text-[11px] text-neutral-500">changing execution mode…</span>
        ) : showConnection && (
          connectionError ? (
            <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /><span className="text-[11px] text-red-600">error</span></div>
          ) : sessionState === 'disconnected' ? (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
              <span className="text-[11px] text-neutral-500">disconnected</span>
              {onReconnect && <button onClick={onReconnect} className="min-h-11 px-2 text-[11px] text-neutral-500 underline">reconnect</button>}
            </div>
          ) : sessionState === 'active' ? (
            <><span className="h-1.5 w-1.5 rounded-full bg-brand-400" /><span className="text-[11px] text-brand-600">live</span></>
          ) : sessionState === 'connected' ? (
            <><span className="h-1.5 w-1.5 rounded-full bg-neutral-400" /><span className="text-[11px] text-neutral-500">connected</span></>
          ) : null
        )}
      </div>

      <div ref={controlsRef} className="relative ml-auto">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={togglePlan}
            disabled={controlsDisabled}
            aria-pressed={collaborationMode === 'plan'}
            aria-label={`Plan: ${collaborationMode === 'plan' ? 'On' : 'Off'}`}
            title="Plan changes the local workflow only; it does not change Host permission"
            className={`flex min-h-11 min-w-11 items-center rounded-md px-2 text-[11px] font-medium transition-colors disabled:opacity-50 ${
              collaborationMode === 'plan'
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-800'
            }`}
          >
            Plan · {collaborationMode === 'plan' ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (controlsDisabled) return
              setConfirmFullAccess(false)
              setPermissionMenuOpen((open) => !open)
            }}
            disabled={controlsDisabled}
            aria-haspopup="menu"
            aria-controls={permissionMenuOpen ? 'host-permission-menu' : undefined}
            aria-expanded={permissionMenuOpen}
            aria-label={`Permission: ${currentExecutionLabel}`}
            title="Choose Host execution permission"
            className="flex min-h-11 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            <span>{currentExecutionLabel}</span>
            {executionProfile === 'full_access' && typeof fullAccessTurnsRemaining === 'number' && (
              <span className="text-red-700">· {fullAccessTurnsRemaining} left</span>
            )}
            <span aria-hidden="true" className="text-neutral-400">⌄</span>
          </button>
        </div>

        {permissionMenuOpen && !confirmFullAccess && (
          <div
            id="host-permission-menu"
            role="menu"
            aria-label="Host permission"
            className="mt-2 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-lg sm:absolute sm:bottom-full sm:right-0 sm:z-30 sm:mb-2 sm:mt-0 sm:w-72"
          >
            <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">Host permission</p>
            {choices.map((profile) => {
              const fullAccess = profile === 'full_access'
              const active = profile === executionProfile
              const label = FALLBACK_LABELS[profile]
              const description = DESCRIPTIONS[profile]
              return (
                <button
                  key={profile}
                  type="button"
                  role="menuitemradio"
                  aria-label={label}
                  aria-checked={active}
                  onClick={() => {
                    if (fullAccess && !active) {
                      setPermissionMenuOpen(false)
                      setConfirmFullAccess(true)
                      return
                    }
                    onExecutionProfileChange(profile)
                    setPermissionMenuOpen(false)
                  }}
                  className={`flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left text-[11px] transition-colors ${
                    active
                      ? fullAccess
                        ? 'bg-red-50 font-semibold text-red-800'
                        : 'bg-neutral-100 font-semibold text-neutral-900'
                      : fullAccess
                        ? 'text-red-700 hover:bg-red-50'
                        : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span><span className="font-medium">{label}</span><span className={`block text-[10px] leading-4 ${fullAccess ? 'text-red-600/80' : 'text-neutral-500'}`}>{description}</span></span>
                  <span aria-hidden="true" className="ml-3 shrink-0">{active ? '✓' : ''}</span>
                </button>
              )
            })}
          </div>
        )}

        {confirmFullAccess && (
          <div role="dialog" aria-label="Confirm Full access" className="mt-2 w-full rounded-lg border border-red-300 bg-red-50 p-3 text-[11px] text-red-900 shadow-lg sm:absolute sm:bottom-full sm:right-0 sm:z-30 sm:mb-2 sm:mt-0 sm:w-72">
            <p className="font-medium">Enable Full access?</p>
            <p className="mt-1 text-red-800">Host limit: {fullOption?.bound || 'configured by Host'}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button className="min-h-9 rounded px-2.5 text-red-800 hover:bg-red-100" onClick={() => setConfirmFullAccess(false)}>Cancel</button>
              <button
                className="min-h-9 rounded bg-red-700 px-2.5 font-medium text-white hover:bg-red-800"
                onClick={() => { setConfirmFullAccess(false); onExecutionProfileChange('full_access') }}
              >Enable</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
