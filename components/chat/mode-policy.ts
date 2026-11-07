import type { HostSessionModeState, Mode } from '@connectonion/react'

export type HostModeOption = HostSessionModeState['availableModes'][number]
export type ModeRecoveryAction = 'retry' | 'reconnect'

export function selectableModes(availableModes: ReadonlyArray<HostModeOption>): Mode[] {
  return availableModes.flatMap(({ id }) => (
    id === 'read-only' || id === 'auto' || id === 'full-access' ? [id] : []
  ))
}

export function modeRecoveryAction(error: unknown): ModeRecoveryAction {
  const message = error instanceof Error ? error.message : String(error)
  return /timed?\s*out|connection|socket|closed|disconnect/i.test(message)
    ? 'reconnect'
    : 'retry'
}


export const modeLabels: Record<Mode, string> = {
  'read-only': 'Read only', auto: 'Auto', 'full-access': 'Full access',
}

/** Normalize known Host labels while preserving provider-specific choices. */
export function modeLabel(label: string): string {
  const normalized = label.toLowerCase().replace(/[-_]/g, ' ').trim()
  if (normalized === 'read only') return modeLabels['read-only']
  if (normalized === 'full access') return modeLabels['full-access']
  if (normalized === 'auto' || normalized === 'auto approve') return modeLabels.auto
  return label
}
