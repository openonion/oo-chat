const migratedKeys = new Set<string>()
const OMITTED_DATA_URL = '[legacy image removed; use server evidence reference]'

function shouldKeepImage(value: unknown): value is string {
  return (
    typeof value === 'string'
    && !value.startsWith('data:')
    && value.length <= 8192
  )
}

function sanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(
      /data:[^;,\s]+;base64,[A-Za-z0-9+/=]+/g,
      OMITTED_DATA_URL,
    )
  }
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value

  const next: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (key === 'images' && Array.isArray(item)) {
      const images = item.filter(shouldKeepImage)
      if (images.length) next[key] = images
      continue
    }
    if (key === 'dataUrl' && typeof item === 'string' && item.startsWith('data:')) {
      continue
    }
    next[key] = sanitize(item)
  }
  return next
}

function sanitizeStoredSession(key: string): void {
  const original = window.localStorage.getItem(key)
  if (!original || !original.includes('data:')) return
  try {
    const sanitized = JSON.stringify(sanitize(JSON.parse(original)))
    if (sanitized.length >= original.length) return
    window.localStorage.removeItem(key)
    try {
      window.localStorage.setItem(key, sanitized)
    } catch (error) {
      window.localStorage.setItem(key, original)
      throw error
    }
  } catch {
    // A malformed SDK cache is left untouched; server replay remains authoritative.
  }
}

/**
 * Remove legacy base64 payloads before SDK hydration.
 *
 * The transcript remains owned by the SDK's bounded local cache; screenshots do
 * not. New screenshots are server assets referenced from replayable tool results.
 * We intentionally do not move sessions into IndexedDB: doing so creates a second
 * client-side transcript owner and makes delete/restore semantics inconsistent.
 */
export function prepareAgentSessionStorage(
  agentAddress: string,
  sessionId: string,
): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  const currentKey = `co:agent:${agentAddress}:session:${sessionId}`
  if (migratedKeys.has(currentKey)) return Promise.resolve()
  migratedKeys.add(currentKey)

  const sessionKeys: string[] = []
  for (let index = 0; index < window.localStorage.length; index++) {
    const storedKey = window.localStorage.key(index)
    if (storedKey?.startsWith('co:agent:')) sessionKeys.push(storedKey)
  }
  for (const storedKey of sessionKeys) sanitizeStoredSession(storedKey)
  return Promise.resolve()
}
