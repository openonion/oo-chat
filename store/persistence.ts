// localStorage guards for the chat store. Image stripping itself lives in the
// SDK's sanitizeForPersistence — the one implementation shared with the
// per-session agent store; this file only adapts it to zustand's {state}
// envelope and adds the quota fallback.
import { sanitizeForPersistence } from 'connectonion/react'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function dropConversationUI(state: unknown): unknown {
  if (!isRecord(state)) return state
  return {
    ...state,
    conversations: Array.isArray(state.conversations)
      ? state.conversations.map(c => (isRecord(c) ? { ...c, ui: [] } : c))
      : state.conversations,
  }
}

export function preparePersistedChatState<T>(value: T): T {
  if (!isRecord(value)) return value
  if (isRecord(value.state)) {
    return { ...value, state: sanitizeForPersistence(value.state) } as T
  }
  return sanitizeForPersistence(value) as T
}

// Quota fallback: conversation UI is the bulk — drop it, keep the index.
export function prepareMinimalPersistedChatState<T>(value: T): T {
  if (!isRecord(value)) return value
  if (isRecord(value.state)) {
    return { ...value, state: dropConversationUI(value.state) } as T
  }
  return dropConversationUI(value) as T
}

export function isStorageQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}
