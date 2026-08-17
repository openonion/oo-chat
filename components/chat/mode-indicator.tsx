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
  default: 'Run scoped workspace work; broader requests ask.',
  full_access: 'Skip per-action approval within the Host limit.',
}

function isTypingTarget(el: Element | null) {
  if (!el) return false
  const tag = (el as HTMLElement).tagName
  return tag === 'TEXTAREA' || tag === 'INPUT' || (el as HTMLElement).isContentEditable
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
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const modeMenuRef = useRef<HTMLDivElement>(null)
  const controlsDisabled = disabled || permissionProfileChangePending
  const togglePlan = useCallback(() => {
    if (controlsDisabled) return
    onCollaborationModeChange(collaborationMode === 'plan' ? 'default' : 'plan')
  }, [collaborationMode, controlsDisabled, onCollaborationModeChange])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && (modeMenuOpen || confirmFullAccess)) {
        setModeMenuOpen(false)
        setConfirmFullAccess(false)
        return
      }
      if (isTypingTarget(document.activeElement)) return
      if (event.shiftKey && event.key === 'Tab') {
        event.preventDefault()
        togglePlan()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmFullAccess, modeMenuOpen, togglePlan])

  useEffect(() => {
    if (!modeMenuOpen && !confirmFullAccess) return
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!modeMenuRef.current?.contains(event.target as Node)) {
        setModeMenuOpen(false)
        setConfirmFullAccess(false)
      }
    }
    window.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [confirmFullAccess, modeMenuOpen])

  useEffect(() => {
    if (controlsDisabled) setModeMenuOpen(false)
  }, [controlsDisabled])

  const choices = selectableExecutionProfiles(availableExecutionProfiles)
  const fullOption = availableExecutionProfiles.find((option) => option.profile === 'full_access')
  const currentExecutionLabel = FALLBACK_LABELS[executionProfile]
  const currentModeLabel = collaborationMode === 'plan'
    ? `Plan · ${currentExecutionLabel}`
    : currentExecutionLabel
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

      <div ref={modeMenuRef} className="relative ml-auto">
        <button
          type="button"
          onClick={() => {
            if (controlsDisabled) return
            setConfirmFullAccess(false)
            setModeMenuOpen((open) => !open)
          }}
          disabled={controlsDisabled}
          aria-haspopup="menu"
          aria-controls={modeMenuOpen ? 'execution-mode-menu' : undefined}
          aria-expanded={modeMenuOpen}
          aria-label={`Mode: ${currentModeLabel}`}
          title="Choose planning workflow or Host execution permission"
          className="flex min-h-11 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 text-[11px] text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          <span className="text-neutral-500">Mode</span>
          <span className="font-medium text-neutral-900">{currentModeLabel}</span>
          {executionProfile === 'full_access' && typeof fullAccessTurnsRemaining === 'number' && (
            <span className="text-red-700">· {fullAccessTurnsRemaining} left</span>
          )}
          <span aria-hidden="true" className="text-neutral-400">⌄</span>
        </button>

        {modeMenuOpen && !confirmFullAccess && (
          <div
            id="execution-mode-menu"
            role="menu"
            aria-label="Execution mode"
            className="absolute bottom-full right-0 z-30 mb-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitemcheckbox"
              aria-label="Plan"
              aria-checked={collaborationMode === 'plan'}
              onClick={() => {
                togglePlan()
                setModeMenuOpen(false)
              }}
              className={`flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left text-[11px] ${
                collaborationMode === 'plan'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-800 hover:bg-neutral-100'
              }`}
            >
              <span><span className="font-medium">Plan</span><span className={`block text-[10px] ${collaborationMode === 'plan' ? 'text-neutral-300' : 'text-neutral-500'}`}>Think through the work; this does not change Host permission.</span></span>
              <span className="ml-3 shrink-0">{collaborationMode === 'plan' ? 'On' : 'Off'}</span>
            </button>
            <div role="separator" className="my-1 border-t border-neutral-100" />
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
                      setModeMenuOpen(false)
                      setConfirmFullAccess(true)
                      return
                    }
                    onExecutionProfileChange(profile)
                    setModeMenuOpen(false)
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
          <div role="dialog" aria-label="Confirm Full access" className="absolute bottom-full right-0 z-30 mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-red-300 bg-red-50 p-3 text-[11px] text-red-900 shadow-lg">
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
