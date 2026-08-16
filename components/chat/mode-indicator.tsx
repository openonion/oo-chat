'use client'

import { useCallback, useEffect, useState } from 'react'
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
  safe: 'Review each request before it runs',
  default: 'Runs low-risk workspace work automatically; broader or unresolved work still asks or is denied',
  full_access: 'Bypass per-action approval only within the Host-defined bound',
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
  const controlsDisabled = disabled || permissionProfileChangePending
  const togglePlan = useCallback(() => {
    if (controlsDisabled) return
    onCollaborationModeChange(collaborationMode === 'plan' ? 'default' : 'plan')
  }, [collaborationMode, controlsDisabled, onCollaborationModeChange])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(document.activeElement)) return
      if (event.shiftKey && event.key === 'Tab') {
        event.preventDefault()
        togglePlan()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlan])

  const choices = selectableExecutionProfiles(availableExecutionProfiles)
  const fullOption = availableExecutionProfiles.find((option) => option.profile === 'full_access')
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

      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        <button
          onClick={togglePlan}
          disabled={controlsDisabled}
          aria-pressed={collaborationMode === 'plan'}
          title="Plan the work without changing Host permissions · ⇧Tab to switch"
          className="min-h-11 rounded-md border border-neutral-200 px-2.5 text-[11px] text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 aria-pressed:bg-neutral-900 aria-pressed:text-white"
        >
          {collaborationMode === 'plan' ? 'Exit plan' : 'Plan'}
        </button>

        {confirmFullAccess ? (
          <div role="group" aria-label="Confirm Full access" className="flex min-h-11 flex-wrap items-center gap-1 rounded-md border border-red-300 bg-red-50 p-1 text-[11px] text-red-800">
            <span className="px-1">Host limit: {fullOption?.bound || 'configured by Host'}</span>
            <button
              className="min-h-9 rounded bg-red-700 px-2.5 font-medium text-white"
              onClick={() => { setConfirmFullAccess(false); onExecutionProfileChange('full_access') }}
            >Enable</button>
            <button className="min-h-9 rounded px-2.5" onClick={() => setConfirmFullAccess(false)}>Cancel</button>
          </div>
        ) : (
          <div className="inline-flex gap-0.5 rounded-md border border-neutral-200 bg-white p-0.5" role="group" aria-label="Execution mode">
            {choices.map((profile) => {
              const fullAccess = profile === 'full_access'
              const active = profile === executionProfile
              const option = availableExecutionProfiles.find((item) => item.profile === profile)
              const label = option?.name || FALLBACK_LABELS[profile]
              const description = option?.description || DESCRIPTIONS[profile]
              return (
                <button
                  key={profile}
                  onClick={() => fullAccess && !active
                    ? setConfirmFullAccess(true)
                    : onExecutionProfileChange(profile)}
                  disabled={controlsDisabled}
                  className={`min-h-11 min-w-11 rounded px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${
                    active
                      ? fullAccess
                        ? 'bg-red-100 font-semibold text-red-800 ring-1 ring-red-300'
                        : 'bg-neutral-200 font-semibold text-neutral-900'
                      : fullAccess
                        ? 'text-red-700 hover:bg-red-50'
                        : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                  title={description}
                  aria-label={`${label}${active ? ', current mode' : ''}`}
                  aria-pressed={active}
                >
                  {label}
                  {active && fullAccess && typeof fullAccessTurnsRemaining === 'number'
                    ? ` · ${fullAccessTurnsRemaining} left`
                    : ''}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
