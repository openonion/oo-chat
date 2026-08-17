import { describe, expect, it, vi } from 'vitest'
import type { ChatItem } from '@connectonion/react'

import {
  connectionErrorUpdate,
  decodeProviderStopBarriers,
  deriveSessionState,
  encodeProviderStopBarriers,
  extractPendingStates,
  awaitProviderStopAcknowledgement,
  submitSignedOnboard,
} from './use-agent-sdk'

const runningTool: ChatItem = {
  id: 'tool-1',
  type: 'tool_call',
  name: 'write',
  args: { path: 'release.txt' },
  status: 'running',
}

function approval(answered?: boolean): ChatItem {
  return {
    id: 'permission-1',
    type: 'approval_needed',
    tool: 'write',
    arguments: { path: 'release.txt' },
    ...(answered === undefined ? {} : { answered }),
  }
}

describe('extractPendingStates', () => {
  it('keeps an unanswered approval attached to its running tool', () => {
    expect(extractPendingStates([runningTool, approval()]).pendingApproval).toEqual({
      id: 'permission-1',
      tool: 'write',
      arguments: { path: 'release.txt' },
    })
  })

  it('clears an answered approval even before the tool receives a terminal update', () => {
    expect(extractPendingStates([runningTool, approval(true)]).pendingApproval).toBeNull()
  })

  it('attaches a native approval only while its exact provider invocation is live', () => {
    const provider: Extract<ChatItem, { type: 'provider_invocation' }> = {
      id: 'codex:outer',
      type: 'provider_invocation',
      parentToolCallId: 'outer',
      provider: 'codex',
      providerDisplayName: 'Codex',
      status: 'awaiting_approval',
      activities: [],
    }
    const nativeApproval = {
      id: 'permission-codex',
      type: 'approval_needed',
      tool: 'codex',
      arguments: { action: 'Run pytest' },
      provider: 'codex',
      providerInvocationId: 'codex:outer',
      parentToolCallId: 'outer',
    } as ChatItem

    expect(extractPendingStates([provider, nativeApproval]).pendingApproval).toMatchObject({
      id: 'permission-codex',
      provider: 'codex',
      providerInvocationId: 'codex:outer',
      parentToolCallId: 'outer',
    })

    // An approval envelope is not itself evidence that the provider stopped
    // for the reader. Until the authoritative lifecycle says so, leave the
    // composer in its ordinary working state.
    expect(extractPendingStates([
      { ...provider, status: 'running' },
      nativeApproval,
    ]).pendingApproval).toBeNull()

    expect(extractPendingStates(
      [provider, nativeApproval],
      new Map<string, 'acknowledged'>([['codex:outer', 'acknowledged']]),
    ).pendingApproval).toBeNull()

    expect(extractPendingStates([
      { ...provider, status: 'completed' },
      nativeApproval,
    ]).pendingApproval).toBeNull()

    expect(extractPendingStates([
      provider,
      nativeApproval,
      { ...provider, status: 'cancelled' },
    ]).pendingApproval).toBeNull()

    expect(extractPendingStates(
      [provider, nativeApproval],
      new Map(),
      false,
    ).pendingApproval).toBeNull()
  })

  it('treats incomplete native correlation as a legacy approval instead of hiding it', () => {
    const genericCodex: ChatItem = {
      id: 'generic-codex', type: 'tool_call', name: 'codex', status: 'running',
    }
    const incomplete = {
      id: 'permission-incomplete',
      type: 'approval_needed',
      tool: 'codex',
      arguments: { action: 'Run pytest' },
      provider: 'codex',
      providerInvocationId: 'codex:outer',
    } as ChatItem

    expect(extractPendingStates([genericCodex, incomplete]).pendingApproval).toEqual({
      id: 'permission-incomplete',
      tool: 'codex',
      arguments: { action: 'Run pytest' },
    })
  })
})

describe('provider Stop recovery barrier', () => {
  it('round-trips only the typed current-tab acknowledgement fields', () => {
    const encoded = encodeProviderStopBarriers([{
      invocationId: 'codex:call-7',
      stateRevision: 7,
      phase: 'acknowledged',
      expiresAt: 20_000,
    }])

    expect(decodeProviderStopBarriers(encoded, 10_000)).toEqual(new Map([[
      'codex:call-7',
      {
        invocationId: 'codex:call-7',
        stateRevision: 7,
        phase: 'acknowledged',
        expiresAt: 20_000,
      },
    ]]))
  })

  it('fails closed for expired, malformed, or non-authoritative barriers', () => {
    const expired = JSON.stringify([{
      invocationId: 'codex:call-7', stateRevision: 7, phase: 'acknowledged', expiresAt: 10,
    }])
    expect(decodeProviderStopBarriers(expired, 10)).toEqual(new Map([[
      'codex:call-7', {
        invocationId: 'codex:call-7', stateRevision: 7, phase: 'unconfirmed',
      },
    ]]))

    const malformed = JSON.stringify([
      { invocationId: '', stateRevision: 7, phase: 'acknowledged', expiresAt: 20 },
      { invocationId: 'codex:bad-revision', stateRevision: 0, phase: 'acknowledged', expiresAt: 20 },
      { invocationId: 'codex:bad-phase', stateRevision: 3, phase: 'requesting' },
    ])
    expect(decodeProviderStopBarriers(malformed, 10)).toEqual(new Map())
    expect(decodeProviderStopBarriers('{not json', 10)).toEqual(new Map())
  })
})

describe('deriveSessionState', () => {
  it('keeps an authoritative transport loss visible over stale running UI', () => {
    expect(deriveSessionState('disconnected', true, false, true)).toBe('disconnected')
  })

  it('does not call a cold agent disconnected before a conversation exists', () => {
    expect(deriveSessionState('disconnected', false, false, false)).toBe('idle')
  })
})

describe('connectionErrorUpdate', () => {
  it('clears a previous banner when the SDK error is cleared after retry', () => {
    expect(connectionErrorUpdate(null, false)).toBeNull()
  })

  it('reports ordinary agent failures', () => {
    expect(connectionErrorUpdate(new Error('Agent error: misconfigured'), false))
      .toBe('Agent error: misconfigured')
  })

  it('leaves the general banner alone for permission-profile errors', () => {
    expect(connectionErrorUpdate(new Error('profile rejected'), true)).toBeUndefined()
  })
})

describe('awaitProviderStopAcknowledgement', () => {
  it('waits for the exact native-provider Host acknowledgement', async () => {
    const interruptProvider = vi.fn(async () => ({
      invocationId: 'codex:call-7',
      stateRevision: 7,
    }))

    await expect(awaitProviderStopAcknowledgement(interruptProvider, 'codex:call-7'))
      .resolves.toEqual({ invocationId: 'codex:call-7', stateRevision: 7 })

    expect(interruptProvider).toHaveBeenCalledWith('codex:call-7')
  })

  it('fails closed when an older client dispatches Stop without an acknowledgement', async () => {
    const interruptProvider = vi.fn(() => undefined)

    await expect(awaitProviderStopAcknowledgement(interruptProvider, 'codex:call-7'))
      .rejects.toThrow('cannot confirm the provider stop request')
  })

  it('fails closed when an acknowledgement omits its state revision', async () => {
    const interruptProvider = vi.fn(async () => ({ invocationId: 'codex:call-7' }))

    await expect(awaitProviderStopAcknowledgement(interruptProvider, 'codex:call-7'))
      .rejects.toThrow('did not prove the provider stop applies')
  })
})

describe('submitSignedOnboard', () => {
  it('sends the synchronous frame returned by Alpha.2', async () => {
    const signed = { type: 'ONBOARD_SUBMIT', signature: 'signed' }
    const signOnboard = vi.fn(() => signed)
    const sendMessage = vi.fn()

    await submitSignedOnboard(signOnboard, sendMessage, { inviteCode: 'invite' })

    expect(sendMessage).toHaveBeenCalledWith(signed)
  })

  it('waits for the asynchronous frame returned by Alpha.3', async () => {
    const signed = { type: 'ONBOARD_SUBMIT', signature: 'signed' }
    const signOnboard = vi.fn(async () => signed)
    const sendMessage = vi.fn()

    await submitSignedOnboard(signOnboard, sendMessage, { inviteCode: 'invite' })

    expect(signOnboard).toHaveBeenCalledWith({ inviteCode: 'invite' })
    expect(sendMessage).toHaveBeenCalledWith(signed)
  })
})
