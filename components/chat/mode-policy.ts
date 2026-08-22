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
