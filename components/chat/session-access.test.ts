import { describe, expect, it } from 'vitest'
import { resolveChatSessionAccess } from './session-access'

const restored = {
  hasHydrated: true,
  hasConversation: true,
  hasLocalTranscript: false,
  hasRemoteRevision: false,
  sessionSyncReady: false,
}

describe('resolveChatSessionAccess', () => {
  it('does not claim a live session before persisted state hydrates', () => {
    expect(resolveChatSessionAccess({ ...restored, hasHydrated: false })).toBe('restoring')
  })

  it('keeps a hydrated remote-only transcript read-only after reload', () => {
    expect(resolveChatSessionAccess({ ...restored, hasRemoteRevision: true })).toBe('snapshot')
  })

  it('waits for the remote index before claiming an unknown deep link', () => {
    expect(resolveChatSessionAccess({ ...restored, hasConversation: false })).toBe('restoring')
  })

  it('does not connect a missing session after index discovery finishes', () => {
    expect(resolveChatSessionAccess({
      ...restored, hasConversation: false, sessionSyncReady: true,
    })).toBe('missing')
  })

  it('allows a new local draft to connect without waiting for the index', () => {
    expect(resolveChatSessionAccess(restored)).toBe('live')
  })

  it('preserves the live path for a locally cached transcript', () => {
    expect(resolveChatSessionAccess({
      ...restored, hasLocalTranscript: true, hasRemoteRevision: true,
    })).toBe('live')
  })
})
