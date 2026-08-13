import type {
  CollaborationMode,
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

/** A lost acknowledgement requires an authoritative reconnect, not a blind retry. */
export function permissionProfileRecoveryAction(error: unknown): PermissionProfileRecoveryAction {
  const message = error instanceof Error ? error.message : String(error)
  return /timed?\s*out|connection|socket|closed|disconnect/i.test(message)
    ? 'reconnect'
    : 'retry'
}
