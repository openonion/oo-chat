import { describe, expect, it } from 'vitest'
import type { ChatItem } from '@connectonion/react'

import type { UI } from './types'
import { isOnboardGateCompleted } from './onboard-state'
import { extractPendingStates } from './use-agent-sdk'

describe('isOnboardGateCompleted', () => {
  it('pairs a success with the preceding gate', () => {
    const items = [
      { id: 'gate', type: 'onboard_required', methods: ['invite_code'] },
      { id: 'success', type: 'onboard_success', level: 'contact', message: 'Verified' },
    ] as UI[]
    expect(isOnboardGateCompleted(items, 0)).toBe(true)
  })

  it('keeps a later fresh gate visible', () => {
    const items = [
      { id: 'old-gate', type: 'onboard_required', methods: ['invite_code'] },
      { id: 'success', type: 'onboard_success', level: 'contact', message: 'Verified' },
      { id: 'fresh-gate', type: 'onboard_required', methods: ['invite_code'] },
    ] as UI[]
    expect(isOnboardGateCompleted(items, 0)).toBe(true)
    expect(isOnboardGateCompleted(items, 2)).toBe(false)
    expect(extractPendingStates(items as ChatItem[]).pendingOnboard).toEqual({
      methods: ['invite_code'],
      paymentAmount: undefined,
      paymentAddress: undefined,
    })
  })
})
