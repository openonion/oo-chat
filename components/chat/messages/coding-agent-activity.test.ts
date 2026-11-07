import { describe, expect, it } from 'vitest'
import type { ProviderInvocationUI } from '../types'
import { providerOutcomeLine, providerStatusTitle } from './coding-agent-activity'

const base = {
  id: 'inv', type: 'provider_invocation', parentToolCallId: 'p', provider: 'codex',
  providerDisplayName: 'Codex', status: 'completed', messages: [],
  activities: [
    { id: 'a', sequence: 1, kind: 'file_change', status: 'completed', title: 'Update workspace files',
      summary: 'Workspace files updated', legacy: false, files: ['src/a.ts', 'src/b.ts'] },
    { id: 'b', sequence: 2, kind: 'file_change', status: 'completed', title: 'Update workspace files',
      summary: 'Workspace files updated', legacy: false, files: ['src/b.ts', 'docs/c.md', 'docs/d.md'] },
  ],
} as unknown as ProviderInvocationUI

describe('Codex card copy', () => {
  it('titles a run by its status, never its task', () => {
    expect(providerStatusTitle('completed', 'Codex')).toBe('Codex finished')
    expect(providerStatusTitle('running', 'Codex')).toBe('Codex is working')
    expect(providerStatusTitle('awaiting_approval', 'Codex')).toBe('Codex needs approval')
    expect(providerStatusTitle('cancelled', 'Codex')).toBe('Codex stopped')
  })

  it('sums an ended run from its reported files and recorded checks', () => {
    expect(providerOutcomeLine(base)).toBe('4 files changed')
    expect(providerOutcomeLine({ ...base, resultSummary: 'Completed the provider run after the recorded test checks' }))
      .toBe('4 files changed, tests passed')
    expect(providerOutcomeLine({ ...base, activities: [] })).toBe('No file changes reported')
  })
})
