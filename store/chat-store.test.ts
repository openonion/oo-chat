/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'oo-chat-storage'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => Array.from(values.keys())[index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

async function freshStore() {
  vi.resetModules()
  const { useChatStore } = await import('./chat-store')
  await useChatStore.persist.rehydrate()
  return useChatStore
}

function persistedState() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').state ?? {}
}

describe('chat store credential boundary', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: memoryStorage(),
    })
  })

  it('scrubs JWT and profile fields left by an older persisted store', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      state: {
        conversations: [],
        activeSessionId: null,
        agents: ['0xagent'],
        openonionApiKey: 'legacy-jwt',
        userProfile: { public_key: '0xuser', balance_usd: 1 },
      },
      version: 0,
    }))

    const store = await freshStore()

    expect(persistedState()).not.toHaveProperty('openonionApiKey')
    expect(persistedState()).not.toHaveProperty('userProfile')
    expect(store.getState().openonionApiKey).toBe('')
    expect(store.getState().userProfile).toBeNull()
  })

  it('keeps fresh auth state in memory without writing it to localStorage', async () => {
    const store = await freshStore()
    const profile = {
      public_key: '0xuser',
      credits_usd: 2,
      total_cost_usd: 1,
      balance_usd: 1,
    }

    store.getState().setApiKey('session-jwt')
    store.getState().setUserProfile(profile)

    expect(store.getState().openonionApiKey).toBe('session-jwt')
    expect(store.getState().userProfile).toEqual(profile)
    expect(persistedState()).not.toHaveProperty('openonionApiKey')
    expect(persistedState()).not.toHaveProperty('userProfile')
  })
})

describe('Host-retained Recent Chat cache', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: memoryStorage(),
    })
  })

  it('merges remote summaries by revision while keeping local-only drafts', async () => {
    const store = await freshStore()
    store.getState().createConversation('local-draft', '0xagent')
    store.getState().createConversation('shared', '0xagent')
    store.getState().mergeRemoteConversations('0xagent', [{
      session_id: 'shared',
      revision: 3,
      title: 'Remote title',
      activity: 'idle',
      created_at: '2030-08-30T00:00:00Z',
      updated_at: '2030-09-01T00:00:00Z',
      last_sequence: 4,
    }, {
      session_id: 'other-device',
      revision: 1,
      title: 'From my phone',
      activity: 'idle',
      created_at: '2030-08-31T00:00:00Z',
      updated_at: '2030-08-31T12:00:00Z',
      last_sequence: 2,
    }], [])

    const conversations = store.getState().conversations
    expect(conversations.map(item => item.sessionId)).toEqual([
      'shared',
      'other-device',
      'local-draft',
    ])
    expect(conversations.find(item => item.sessionId === 'shared')).toMatchObject({
      title: 'Remote title',
      remoteRevision: 3,
    })

    store.getState().mergeRemoteConversations('0xagent', [{
      session_id: 'shared',
      revision: 2,
      title: 'Stale title',
      activity: 'idle',
      created_at: '2026-08-30T00:00:00Z',
      updated_at: '2026-09-02T00:00:00Z',
      last_sequence: 4,
    }], [])
    expect(store.getState().conversations.find(
      item => item.sessionId === 'shared',
    )?.title).toBe('Remote title')
  })

  it('applies remote removals without deleting an unsynced local draft', async () => {
    const store = await freshStore()
    store.getState().createConversation('draft', '0xagent')
    store.getState().mergeRemoteConversations('0xagent', [{
      session_id: 'remote',
      revision: 1,
      title: 'Remote',
      activity: 'idle',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
      last_sequence: 2,
    }], [])

    store.getState().mergeRemoteConversations(
      '0xagent',
      [],
      ['remote', 'draft'],
    )

    expect(store.getState().conversations.map(item => item.sessionId)).toEqual(['draft'])
  })

  it('migrates old rows so activity sorting always has updatedAt', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      state: {
        conversations: [{
          sessionId: 'legacy',
          title: 'Legacy',
          agentAddress: '0xagent',
          createdAt: '2026-08-01T00:00:00Z',
        }],
        activeSessionId: null,
        agents: ['0xagent'],
      },
      version: 0,
    }))

    const store = await freshStore()
    expect(store.getState().conversations[0].updatedAt).toEqual(
      new Date('2026-08-01T00:00:00Z'),
    )
  })

  it('does not make an unchanged title look like new activity', async () => {
    const store = await freshStore()
    store.getState().createConversation('session', '0xagent')
    store.getState().updateTitle('session', 'Stable title')
    const firstUpdate = store.getState().conversations[0].updatedAt

    store.getState().updateTitle('session', 'Stable title')

    expect(store.getState().conversations[0].updatedAt).toBe(firstUpdate)
  })
})
