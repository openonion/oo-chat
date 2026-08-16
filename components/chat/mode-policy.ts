import type {
  CollaborationMode,
  ExecutionProfile,
  HostSessionModeState,
  PermissionProfile,
} from '@connectonion/react'

export type HostPermissionOption = HostSessionModeState['availableModes'][number]
export type PermissionProfileRecoveryAction = 'retry' | 'reconnect'

/** Collaboration choices are independent from Host permission authority. */
export const COLLABORATION_MODES: readonly CollaborationMode[] = [
  'default',
  'plan',
]

/** Permission choices derived only from authenticated Host advertisement. */
export function selectablePermissionProfiles(
  availableProfiles: ReadonlyArray<HostPermissionOption>,
): PermissionProfile[] {
  return availableProfiles.flatMap((profile) => {
    switch (profile.id) {
      case ':read-only':
      case ':workspace':
      case ':danger-full-access':
        return [profile.id]
      default:
        return []
    }
  })
}

/** Product choices are already normalized by React from authenticated Host state. */
export function selectableExecutionProfiles(
  availableProfiles: ReadonlyArray<HostPermissionOption>,
): ExecutionProfile[] {
  return availableProfiles.flatMap((profile) => {
    switch (profile.profile) {
      case 'safe':
      case 'default':
      case 'full_access':
        return [profile.profile]
      default:
        return []
    }
  })
}

/** A lost acknowledgement requires an authoritative reconnect, not a blind retry. */
export function permissionProfileRecoveryAction(error: unknown): PermissionProfileRecoveryAction {
  const message = error instanceof Error ? error.message : String(error)
  return /timed?\s*out|connection|socket|closed|disconnect/i.test(message)
    ? 'reconnect'
    : 'retry'
}
