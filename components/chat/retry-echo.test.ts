import { describe, expect, it } from 'vitest'

import type { UI } from './types'
import { suppressRetryEcho } from './retry-echo'

const user = (id: string, content: string): UI => ({ id, type: 'user', content })

describe('suppressRetryEcho', () => {
  it('hides only the new user item created by an explicit retry', () => {
    const items: UI[] = [
      user('original', 'inspect the Humanitix tab'),
      { id: 'thinking', type: 'thinking', content: 'trying', status: 'error' },
      user('retry', 'inspect the Humanitix tab'),
    ]

    expect(suppressRetryEcho(items, {
      sourceId: 'original',
      content: 'inspect the Humanitix tab',
      knownUserCount: 1,
    }).map(item => item.id)).toEqual(['original', 'thinking'])
  })

  it('does not collapse a repeated message unless retry is explicitly armed', () => {
    const items = [user('first', 'try again'), user('second', 'try again')]
    expect(suppressRetryEcho(items, null)).toEqual(items)
  })

  it('preserves earlier identical turns and removes only the post-click echo', () => {
    const items = [
      user('first', 'try again'),
      { id: 'reply', type: 'agent', content: 'failed' } as UI,
      user('source', 'try again'),
      user('echo', 'try again'),
    ]

    expect(suppressRetryEcho(items, {
      sourceId: 'source',
      content: 'try again',
      knownUserCount: 2,
    }).filter(item => item.type === 'user').map(item => item.id)).toEqual(['first', 'source'])
  })

  it('keeps every echo hidden across successive retries of the same turn', () => {
    const retry = {
      sourceId: 'original',
      content: 'inspect the tab',
      knownUserCount: 1,
    }
    const items = [
      user('original', 'inspect the tab'),
      user('first-echo', 'inspect the tab'),
      { id: 'first-error', type: 'thinking', content: 'failed', status: 'error' } as UI,
      user('second-echo', 'inspect the tab'),
    ]

    expect(suppressRetryEcho(items, retry).map(item => item.id)).toEqual([
      'original',
      'first-error',
    ])
  })
})
