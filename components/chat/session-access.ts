interface ChatSessionAccessInput {
  hasHydrated: boolean
  hasConversation: boolean
  hasLocalTranscript: boolean
  hasRemoteRevision: boolean
  sessionSyncReady: boolean
}

/** A cold render must not mistake an unrestored remote chat for a local draft. */
export function resolveChatSessionAccess({
  hasHydrated,
  hasConversation,
  hasLocalTranscript,
  hasRemoteRevision,
  sessionSyncReady,
}: ChatSessionAccessInput): 'restoring' | 'snapshot' | 'live' | 'missing' {
  if (!hasHydrated) return 'restoring'
  if (!hasConversation && !hasLocalTranscript) {
    return sessionSyncReady ? 'missing' : 'restoring'
  }
  if (hasRemoteRevision && !hasLocalTranscript) return 'snapshot'
  return 'live'
}
