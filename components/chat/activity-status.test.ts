import { describe, expect, it } from 'vitest'
import { deriveActivityPhase } from './activity-status'

describe('deriveActivityPhase', () => {
  it('lets an approval outrank a still-active task', () => {
    expect(deriveActivityPhase({
      sessionState: 'active',
      isLoading: true,
      pendingApproval: { id: 'approval-1' },
    })).toBe('awaiting_approval')
  })

  it('settles a terminal task back to connected instead of stale live', () => {
    expect(deriveActivityPhase({
      sessionState: 'active',
      isLoading: false,
    })).toBe('connected')
  })

  it('lets transport failure outrank stale task state', () => {
    expect(deriveActivityPhase({
      sessionState: 'disconnected',
      isLoading: true,
      pendingApproval: { id: 'stale-approval' },
    })).toBe('disconnected')
  })
})
