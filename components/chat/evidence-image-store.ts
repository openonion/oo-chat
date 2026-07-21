import type { ChatItem } from 'connectonion/react'

const DB_NAME = 'oo-chat-evidence'
const DB_VERSION = 1
const STORE_NAME = 'session-images'

interface StoredImageItem {
  key: string
  sessionKey: string
  itemId: string
  images: string[]
  updatedAt: number
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

function openEvidenceDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('sessionKey', 'sessionKey', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function dataImages(item: ChatItem): string[] {
  if (item.type !== 'agent' || !Array.isArray(item.images)) return []
  return [...new Set(item.images.filter(image => image.startsWith('data:image/')))]
}

export async function loadEvidenceImages(
  sessionKey: string,
): Promise<Map<string, string[]>> {
  if (typeof indexedDB === 'undefined') return new Map()
  const db = await openEvidenceDB()
  try {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const records = await requestResult(
      transaction.objectStore(STORE_NAME).index('sessionKey').getAll(sessionKey),
    ) as StoredImageItem[]
    return new Map(records.map(record => [record.itemId, record.images]))
  } finally {
    db.close()
  }
}

export async function persistEvidenceImages(
  sessionKey: string,
  ui: ChatItem[],
): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const desired = new Map<string, string[]>()
  for (const item of ui) {
    const images = dataImages(item)
    if (images.length) desired.set(item.id, images)
  }

  // The SDK intentionally strips base64 images from its localStorage replay.
  // An empty set therefore usually means "hydrated replay", not "delete all".
  if (!desired.size) return

  const db = await openEvidenceDB()
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    for (const [itemId, images] of desired) {
      const key = `${sessionKey}:${itemId}`
      const existing = await requestResult(store.get(key)) as StoredImageItem | undefined
      // Streaming image events can trigger several overlapping persistence effects.
      // Never let an older partial render (for example 3/5 images) overwrite a
      // newer complete render. Session clearing is handled explicitly by
      // clearEvidenceImages(), so normal persistence only grows each evidence set.
      const mergedImages = [...new Set([...(existing?.images || []), ...images])]
      store.put({
        key,
        sessionKey,
        itemId,
        images: mergedImages,
        updatedAt: Date.now(),
      } satisfies StoredImageItem)
    }
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function clearEvidenceImages(sessionKey: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openEvidenceDB()
  try {
    const readTransaction = db.transaction(STORE_NAME, 'readonly')
    const keys = await requestResult(
      readTransaction.objectStore(STORE_NAME).index('sessionKey').getAllKeys(sessionKey),
    )
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    for (const key of keys) store.delete(key)
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export function mergeEvidenceImages(
  ui: ChatItem[],
  persisted: Map<string, string[]>,
): ChatItem[] {
  if (!persisted.size) return ui
  const restoredIds = new Set<string>()
  const merged = ui.map(item => {
    if (item.type !== 'agent') return item
    const restored = persisted.get(item.id)
    if (!restored?.length) return item
    restoredIds.add(item.id)
    return {
      ...item,
      images: [...new Set([...(item.images || []), ...restored])],
    }
  })

  // ConnectOnion deliberately strips base64 image events from its transcript
  // replay, so the corresponding agent item may be absent altogether after a
  // refresh. Restoring only onto matching IDs therefore loses exactly the
  // evidence we persisted. Recreate image-only evidence bubbles for those
  // missing items; stable IDs prevent duplication when the live item returns.
  for (const [itemId, images] of persisted) {
    if (restoredIds.has(itemId) || ui.some(item => item.id === itemId)) continue
    merged.push({
      id: itemId,
      type: 'agent',
      content: 'Restored verification evidence.',
      images,
    } as ChatItem)
  }
  return merged
}
