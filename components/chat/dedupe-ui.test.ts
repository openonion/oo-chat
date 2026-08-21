import { describe, expect, test } from 'vitest'
import type { UI } from './types'
import { dedupeUI } from './dedupe-ui'

describe('SDK presentation de-duplication', () => {
  test('merges updates with the same stable id', () => {
    const items: UI[] = [
      { id: 'call-1', type: 'tool_call', name: 'search', status: 'running' },
      { id: 'call-1', type: 'tool_call', name: 'search', status: 'done', result: 'ok' },
    ]

    expect(dedupeUI(items)).toEqual([items[1]])
  })

})
