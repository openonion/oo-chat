'use client'

import { useCallback, useEffect } from 'react'
import type { CollaborationMode, PermissionProfile } from './types'
import {
  selectablePermissionProfiles,
  type HostPermissionOption,
} from './mode-policy'

interface ModeStatusBarProps {
  collaborationMode: CollaborationMode
  permissionProfile: PermissionProfile
  onCollaborationModeChange: (mode: CollaborationMode) => void
  onPermissionProfileChange: (profile: PermissionProfile) => void
  availablePermissionProfiles?: ReadonlyArray<HostPermissionOption>
  disabled?: boolean
  permissionProfileChangePending?: boolean
  permissionProfileChangeError?: string | null
  permissionProfileRecoveryAction?: 'retry' | 'reconnect' | null
  onPermissionProfileRetry?: () => void
  fullAccessTurnsRemaining?: number | null
  sessionState?: 'idle' | 'connected' | 'active' | 'disconnected' | 'reconnecting'
  isLoading?: boolean
  connectionError?: string | null
  onReconnect?: () => void
}

const COLLABORATION_MODES: CollaborationMode[] = ['default', 'plan']
const PERMISSION_PROFILES: PermissionProfile[] = [
  ':read-only',
  ':workspace',
  ':danger-full-access',
]

const COLLABORATION_LABELS: Record<CollaborationMode, string> = {
  default: 'Default',
  plan: 'Plan',
}

const PERMISSION_LABELS: Record<PermissionProfile, string> = {
  ':read-only': 'Read only',
  ':workspace': 'Auto',
  ':danger-full-access': 'Full access',
}

const PERMISSION_DESCRIPTIONS: Record<PermissionProfile, string> = {
  ':read-only': 'Read freely; ask before edits and commands',
  ':workspace': 'Edit the workspace automatically; broader actions still ask',
  ':danger-full-access': 'Skip approval prompts within the configured turn limit',
}

function isTypingTarget(el: Element | null) {
  if (!el) return false
  const tag = (el as HTMLElement).tagName
  return tag === 'TEXTAREA' || tag === 'INPUT' || (el as HTMLElement).isContentEditable
}

/** Codex-style status bar: collaboration intent and permissions are independent. */
export function ModeStatusBar({
  collaborationMode,
  permissionProfile,
  onCollaborationModeChange,
  onPermissionProfileChange,
  availablePermissionProfiles = [],
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
  const controlsDisabled = disabled || permissionProfileChangePending
  const cycleCollaborationMode = useCallback(() => {
    if (controlsDisabled) return
    const currentIndex = COLLABORATION_MODES.indexOf(collaborationMode)
    onCollaborationModeChange(
      COLLABORATION_MODES[(currentIndex + 1) % COLLABORATION_MODES.length],
    )
  }, [collaborationMode, controlsDisabled, onCollaborationModeChange])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(document.activeElement)) return
      if (event.shiftKey && event.key === 'Tab') {
        event.preventDefault()
        cycleCollaborationMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cycleCollaborationMode])

  const permissionChoices = selectablePermissionProfiles(
    availablePermissionProfiles,
  ).filter((profile) => PERMISSION_PROFILES.includes(profile))
  const showConnection = sessionState === 'active'
    || sessionState === 'connected'
    || sessionState === 'disconnected'
    || sessionState === 'reconnecting'
    || !!connectionError

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
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
          <span role="status" className="text-[11px] text-neutral-500">
            changing permissions…
          </span>
        ) : showConnection && (
          connectionError ? (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              <span className="text-[11px] text-red-600">error</span>
            </div>
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
        <div className="inline-flex gap-0.5 rounded-md border border-neutral-200 bg-neutral-100 p-0.5" role="group" aria-label="Collaboration mode">
          {COLLABORATION_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => onCollaborationModeChange(mode)}
              disabled={controlsDisabled}
              className={`min-h-11 min-w-11 rounded px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${
                mode === collaborationMode
                  ? 'bg-neutral-900 font-medium text-white'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
              title={`${COLLABORATION_LABELS[mode]} collaboration mode · ⇧Tab to switch`}
              aria-pressed={mode === collaborationMode}
            >
              {COLLABORATION_LABELS[mode]}
            </button>
          ))}
        </div>

        <div className="inline-flex gap-0.5 rounded-md border border-neutral-200 bg-white p-0.5" role="group" aria-label="Permission profile">
          {permissionChoices.map((profile) => {
            const fullAccess = profile === ':danger-full-access'
            const active = profile === permissionProfile
            return (
              <button
                key={profile}
                onClick={() => onPermissionProfileChange(profile)}
                disabled={controlsDisabled}
                className={`min-h-11 min-w-11 rounded px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${
                  active
                    ? fullAccess
                      ? 'bg-red-50 font-medium text-red-700'
                      : 'bg-neutral-200 font-medium text-neutral-900'
                    : fullAccess
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-neutral-500 hover:bg-neutral-100'
                }`}
                title={PERMISSION_DESCRIPTIONS[profile]}
                aria-pressed={active}
              >
                {PERMISSION_LABELS[profile]}
                {active && fullAccess && typeof fullAccessTurnsRemaining === 'number'
                  ? ` · ${fullAccessTurnsRemaining} left`
                  : ''}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
