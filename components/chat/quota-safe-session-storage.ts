'use client'

const CONNECTONION_SESSION_PREFIX = 'co:agent:'
const PATCH_MARKER = Symbol.for('oo-chat.quota-safe-connectonion-storage')

// Keep the fallback comfortably below Chromium's per-origin localStorage quota.
// This path is only used after the original, full SDK payload has already failed.
const MAX_FALLBACK_CHARS = 1_500_000
const MAX_STRING_CHARS = 24_000
const MAX_MESSAGES = 20
const MAX_UI_ITEMS = 60

type PersistedEnvelope = {
  state?: Record<string, unknown>
  version?: unknown
}

function isQuotaExceeded(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false
  return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
}

function compactNested(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    if (value.length <= MAX_STRING_CHARS) return value
    return `${value.slice(0, MAX_STRING_CHARS)}\n[truncated in local cache; full value is on the server]`
  }
  if (typeof value !== 'object' || value === null) return value
  if (depth >= 8) return '[nested value omitted from local cache]'
  if (Array.isArray(value)) return value.map(item => compactNested(item, depth + 1))

  const compacted: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (key === 'messages' || key === 'ui' || key === 'trace') continue
    compacted[key] = compactNested(item, depth + 1)
  }
  return compacted
}

function takeTail(value: unknown, count: number): unknown[] {
  if (!Array.isArray(value)) return []
  return value.slice(-count).map(item => compactNested(item))
}

/**
 * Build a bounded local fallback for a ConnectOnion session. The server is the
 * source of truth and sends the canonical transcript immediately on reconnect;
 * this cache only needs enough session identity and recent UI for hydration.
 */
export function compactConnectOnionSessionValue(rawValue: string): string {
  let envelope: PersistedEnvelope
  try {
    envelope = JSON.parse(rawValue) as PersistedEnvelope
  } catch {
    return rawValue
  }

  const state = envelope.state
  if (!state || typeof state !== 'object') return rawValue

  const fallback: PersistedEnvelope = {
    ...envelope,
    state: {
      messages: takeTail(state.messages, MAX_MESSAGES),
      ui: takeTail(state.ui, MAX_UI_ITEMS),
      session: compactNested(state.session),
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    },
  }

  let serialized = JSON.stringify(fallback)
  if (serialized.length <= MAX_FALLBACK_CHARS) return serialized

  // A single unusually large item can still exceed the bound. Session identity
  // is sufficient for the SDK to reconnect and restore the canonical history.
  fallback.state = {
    messages: [],
    ui: [],
    session: compactNested(state.session),
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  }
  serialized = JSON.stringify(fallback)
  return serialized
}

/**
 * Zustand persistence writes synchronously. If localStorage throws, the SDK's
 * message callback aborts before it can publish the new connection state. Patch
 * only ConnectOnion session writes so a quota failure is compacted and retried.
 */
export function installQuotaSafeConnectOnionStorage(): void {
  if (typeof window === 'undefined' || typeof Storage === 'undefined') return

  const storagePrototype = Storage.prototype as Storage & Record<PropertyKey, unknown>
  if (storagePrototype[PATCH_MARKER]) return

  const originalSetItem = Storage.prototype.setItem
  const originalRemoveItem = Storage.prototype.removeItem
  Object.defineProperty(Storage.prototype, 'setItem', {
    configurable: true,
    writable: true,
    value(this: Storage, key: string, value: string) {
      try {
        originalSetItem.call(this, key, value)
      } catch (error) {
        if (!isQuotaExceeded(error) || !key.startsWith(CONNECTONION_SESSION_PREFIX)) {
          throw error
        }
        const compacted = compactConnectOnionSessionValue(value)
        try {
          // Chromium can reject a replacement before accounting for the bytes
          // that the old value would release. Remove only this same session key
          // first, then write its bounded replacement.
          originalRemoveItem.call(this, key)
          originalSetItem.call(this, key, compacted)
        } catch (retryError) {
          if (!isQuotaExceeded(retryError)) throw retryError
          // Persistence is a cache. Never let an exhausted origin-wide quota
          // abort the live SDK callback and strand connectionState at reconnecting.
          console.warn('[oo-chat] Session cache is full; continuing with server-backed history.')
        }
      }
    },
  })
  Object.defineProperty(storagePrototype, PATCH_MARKER, {
    configurable: false,
    value: true,
  })
}
