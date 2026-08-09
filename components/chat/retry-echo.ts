import type { UI } from './types'

export interface RetryEcho {
  sourceId: string
  content: string
  knownUserCount: number
}

/**
 * Retry resends an existing turn, but the SDK also appends an optimistic user
 * item. Hide exactly that retry-created echo. Ordinary repeated messages are
 * untouched because this filter is only armed by the Retry action.
 */
export function suppressRetryEcho(items: UI[], retry: RetryEcho | null): UI[] {
  if (!retry) return items

  let userIndex = 0
  const sourceIsKnown = items.some(item => {
    if (item.type !== 'user') return false
    const isKnownSource = userIndex < retry.knownUserCount && item.id === retry.sourceId
    userIndex += 1
    return isKnownSource
  })
  if (!sourceIsKnown) return items

  userIndex = 0

  return items.filter(item => {
    if (item.type !== 'user') return true

    const isRetryEcho = userIndex >= retry.knownUserCount
      && item.content === retry.content

    userIndex += 1
    if (!isRetryEcho) return true
    return false
  })
}
