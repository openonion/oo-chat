import { describe, expect, test } from 'vitest'
import type { HostPermissionOption } from './mode-policy'
import {
  COLLABORATION_MODES,
  permissionProfileRecoveryAction,
  selectableExecutionProfiles,
  selectablePermissionProfiles,
} from './mode-policy'

const profile = (id: HostPermissionOption['id']): HostPermissionOption => ({
  id,
  wireId: id,
  profile: id === ':read-only' ? 'safe' : id === ':workspace' ? 'default' : 'full_access',
  name: id,
})

describe('O Chat Codex-style mode policy', () => {
  test('keeps collaboration independent from permission authority', () => {
    expect(COLLABORATION_MODES).toEqual(['default', 'plan'])
  })

  test('derives permission choices only from Host-advertised profiles', () => {
    expect(selectablePermissionProfiles([])).toEqual([])
    expect(selectablePermissionProfiles([profile(':read-only')])).toEqual([':read-only'])
    expect(selectablePermissionProfiles([
      profile(':read-only'),
      profile(':workspace'),
      profile(':danger-full-access'),
    ])).toEqual([':read-only', ':workspace', ':danger-full-access'])
  })

  test('exposes the product vocabulary without reparsing Host wire aliases', () => {
    expect(selectableExecutionProfiles([
      profile(':read-only'),
      profile(':workspace'),
      profile(':danger-full-access'),
    ])).toEqual(['safe', 'default', 'full_access'])
  })

  test.each([
    new Error('Permission profile change timed out'),
    new Error('Connection closed before permission acknowledgement'),
    new Error('socket disconnected'),
  ])('treats a lost acknowledgement as outcome unknown', (error) => {
    expect(permissionProfileRecoveryAction(error)).toBe('reconnect')
  })

  test.each([
    new Error('Session is busy'),
    new Error('Permission profile is not available'),
  ])('allows an acknowledged policy failure to be retried', (error) => {
    expect(permissionProfileRecoveryAction(error)).toBe('retry')
  })
})
