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
