const MAX_PERSISTED_IMAGE_LENGTH = 8192

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function shouldPersistImage(image: unknown): image is string {
  return (
    typeof image === 'string' &&
    !image.startsWith('data:') &&
    image.length <= MAX_PERSISTED_IMAGE_LENGTH
  )
}

function sanitizeFiles(value: unknown): unknown {
  if (!Array.isArray(value)) return value

  return value
    .filter(isRecord)
    .map(file => {
      const next = { ...file }
      if (typeof next.dataUrl === 'string' && next.dataUrl.startsWith('data:')) {
        delete next.dataUrl
      }
      return next
    })
}

function sanitizeUIItemForPersistence(item: unknown): unknown {
  if (!isRecord(item)) return item

  const next = { ...item }

  if (Array.isArray(next.images)) {
    const images = next.images.filter(shouldPersistImage)
    if (images.length > 0) {
      next.images = images
    } else {
      delete next.images
    }
  }

  if (Array.isArray(next.files)) {
    next.files = sanitizeFiles(next.files)
  }

  return next
}

function sanitizeConversationForPersistence(conversation: unknown, dropUI: boolean): unknown {
  if (!isRecord(conversation)) return conversation

  return {
    ...conversation,
    ui: dropUI
      ? []
      : Array.isArray(conversation.ui)
        ? conversation.ui.map(sanitizeUIItemForPersistence)
        : [],
  }
}

function sanitizeStateForPersistence(state: unknown, dropUI = false): unknown {
  if (!isRecord(state)) return state

  return {
    ...state,
    conversations: Array.isArray(state.conversations)
      ? state.conversations.map(conversation => sanitizeConversationForPersistence(conversation, dropUI))
      : state.conversations,
  }
}

export function preparePersistedChatState<T>(value: T): T {
  if (!isRecord(value)) return value

  if (isRecord(value.state)) {
    return {
      ...value,
      state: sanitizeStateForPersistence(value.state),
    } as T
  }

  return sanitizeStateForPersistence(value) as T
}

export function prepareMinimalPersistedChatState<T>(value: T): T {
  if (!isRecord(value)) return value

  if (isRecord(value.state)) {
    return {
      ...value,
      state: sanitizeStateForPersistence(value.state, true),
    } as T
  }

  return sanitizeStateForPersistence(value, true) as T
}

export function isStorageQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}
