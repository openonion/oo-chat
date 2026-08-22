import { describe, expect, test } from 'vitest'
import fixture from '../../tests/fixtures/oip/mode-contract-v1.json'
import type { HostModeOption } from './mode-policy'
import { modeRecoveryAction, selectableModes } from './mode-policy'

const modes = fixture.modes.map(({ id, name }) => ({ id, name })) as HostModeOption[]

describe('O Chat 1.7 mode policy', () => {
  test('renders only the shared Host-advertised vocabulary', () => {
    expect(selectableModes([])).toEqual([])
    expect(selectableModes(modes)).toEqual(['read-only', 'auto', 'full-access'])
  })

  test.each([
    new Error('Mode change timed out'),
    new Error('Connection closed before mode acknowledgement'),
    new Error('socket disconnected'),
  ])('treats a lost acknowledgement as outcome unknown', (error) => {
    expect(modeRecoveryAction(error)).toBe('reconnect')
  })

  test.each([
    new Error('Session is busy'),
    new Error('Mode is not available'),
  ])('allows an acknowledged policy failure to be retried', (error) => {
    expect(modeRecoveryAction(error)).toBe('retry')
  })
})
