import { describe, expect, it } from 'vitest'
import { completedProviderFiles } from './coding-agent-activity'
import type { ProviderInvocationUI } from '../types'

const change = { id: 'file-1', name: 'Edit', kind: 'file_change', status: 'done', files: ['src/main.ts'], legacy: false } as const
const invocation: ProviderInvocationUI = {
  id: 'codex:turn-2', type: 'provider_invocation', parentToolCallId: 'turn-2',
  provider: 'codex', providerDisplayName: 'Codex', status: 'completed',
  activities: [{ ...change, files: [...change.files] }],
}

describe('completedProviderFiles', () => {
  it('shows only typed, completed changes, deduplicated in report order', () => {
    expect(completedProviderFiles({ ...invocation, activities: [
      ...invocation.activities,
      { ...change, id: 'repeat', files: ['src/main.ts', 'test/main.ts'] },
      { ...change, id: 'failed', status: 'error', files: ['failed.ts'] },
      { ...change, id: 'pending', status: 'running', files: ['pending.ts'] },
      { ...change, id: 'read-only', kind: 'inspect', files: ['readme.md'] },
      { ...change, id: 'legacy', legacy: true, files: ['legacy.ts'] },
    ] })).toEqual(['src/main.ts', 'test/main.ts'])
  })

  it('does not promote an unfinished run or infer files from a response', () => {
    expect(completedProviderFiles({ ...invocation, status: 'running' })).toEqual([])
    expect(completedProviderFiles({ ...invocation, activities: [], resultSummary: 'Created imaginary.ts' })).toEqual([])
  })

  it('does not inherit the previous turn’s files into a continuation result', () => {
    expect(completedProviderFiles({
      ...invocation, id: 'codex:turn-3', continuationOf: invocation.id,
      activities: [{ ...change, id: 'next', files: ['next.ts'] }],
    })).toEqual(['next.ts'])
  })
})
