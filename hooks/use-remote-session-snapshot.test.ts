import { describe, expect, it, vi } from 'vitest'
import type { BrowserIdentity, ChatItem } from '@connectonion/react'
import { fetchRemoteSessionSnapshot } from './use-remote-session-snapshot'

const identity = { address: '0xreader', sign: vi.fn() } as unknown as BrowserIdentity
const records: ChatItem[] = [
  { id: 'user-1', type: 'user', content: 'hello' },
  { id: 'agent-1', type: 'agent', content: 'world' },
]

describe('fetchRemoteSessionSnapshot', () => {
  it('reads a retained transcript through an index-only client without claiming the live session', async () => {
    const getSession = vi.fn().mockResolvedValue({
      notModified: false,
      summary: { session_id: 'session-1' },
      snapshotRevision: 7,
      records: records.map((data, index) => ({
        sequence: index + 1,
        record_id: `record-${index + 1}`,
        kind: index === 0 ? 'input' : 'output',
        occurred_at: '2026-09-01T00:00:00.000Z',
        data,
      })),
    })
    const reset = vi.fn()
    const reconnect = vi.fn()
    const createClient = vi.fn(() => ({ getSession, reset, reconnect, ui: [], onMessage: null }))

    const result = await fetchRemoteSessionSnapshot({
      agentAddress: '0xagent',
      sessionId: 'session-1',
      identity,
      createClient,
    })

    expect(createClient).toHaveBeenCalledWith('0xagent', {
      signer: identity,
      sessionSyncOnly: true,
    })
    expect(getSession).toHaveBeenCalledWith('session-1')
    expect(reconnect).not.toHaveBeenCalled()
    expect(reset).toHaveBeenCalledOnce()
    expect(result).toEqual({ snapshotRevision: 7, ui: records })
  })

  it('always closes the capability socket when snapshot retrieval fails', async () => {
    const failure = new Error('snapshot unavailable')
    const reset = vi.fn()
    const createClient = vi.fn(() => ({
      ui: [], onMessage: null,
      getSession: vi.fn().mockRejectedValue(failure),
      reset,
    }))

    await expect(fetchRemoteSessionSnapshot({
      agentAddress: '0xagent',
      sessionId: 'session-1',
      identity,
      createClient,
    })).rejects.toBe(failure)
    expect(reset).toHaveBeenCalledOnce()
  })

  it('releases a snapshot blocked on verification instead of loading forever', async () => {
    const client = {
      ui: [{ id: 'gate', type: 'onboard_required' }] as ChatItem[],
      onMessage: null as (() => void) | null,
      reset: vi.fn(),
      getSession: vi.fn(async () => {
        client.onMessage?.()
        throw new Error('Connection closed during authentication')
      }),
    }
    await expect(fetchRemoteSessionSnapshot({
      agentAddress: '0xagent', sessionId: 'session-1', identity,
      createClient: () => client,
    })).rejects.toThrow('Open the Agent homepage to complete verification')
    expect(client.reset).toHaveBeenCalled()
    expect(client.onMessage).toBeNull()
  })
})
