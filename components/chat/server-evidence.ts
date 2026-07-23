import type { ChatItem } from 'connectonion/react'

interface ServerEvidenceImage {
  id: string
  groupId: string
  content: string
  url: string
  ordinal: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isEvidenceUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const parsed = new URL(value)
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && parsed.pathname.startsWith('/evidence/v1/')
      && Boolean(parsed.searchParams.get('token'))
    )
  } catch {
    return false
  }
}

function collectImages(value: unknown, images: ServerEvidenceImage[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectImages(item, images)
    return
  }
  if (!isRecord(value)) return

  const serverImages = value.server_images
  if (Array.isArray(serverImages)) {
    for (const raw of serverImages) {
      if (!isRecord(raw) || !isEvidenceUrl(raw.url)) continue
      const id = typeof raw.id === 'string' ? raw.id : ''
      const groupId = typeof raw.group_id === 'string' ? raw.group_id : ''
      if (!id || !groupId) continue
      images.push({
        id,
        groupId,
        content: typeof raw.content === 'string' ? raw.content : 'Verification evidence.',
        url: raw.url,
        ordinal: typeof raw.ordinal === 'number' ? raw.ordinal : 0,
      })
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (key !== 'server_images') collectImages(child, images)
  }
}

function resultImages(result: unknown): ServerEvidenceImage[] {
  if (typeof result !== 'string' || !result.trim()) return []
  try {
    const parsed: unknown = JSON.parse(result)
    const images: ServerEvidenceImage[] = []
    collectImages(parsed, images)
    return images
  } catch {
    return []
  }
}

/** Rebuild server-backed evidence bubbles from replayed tool results. */
export function mergeServerEvidence(ui: ChatItem[]): ChatItem[] {
  const existingUrls = new Set(
    ui.flatMap(item => item.type === 'agent' ? (item.images || []) : []),
  )
  const seenGroups = new Set<string>()
  const merged: ChatItem[] = []

  for (const item of ui) {
    merged.push(item)
    if (item.type !== 'tool_call') continue

    const groups = new Map<string, ServerEvidenceImage[]>()
    for (const image of resultImages(item.result)) {
      if (existingUrls.has(image.url)) continue
      const group = groups.get(image.groupId) || []
      group.push(image)
      groups.set(image.groupId, group)
    }

    for (const [groupId, images] of groups) {
      if (seenGroups.has(groupId)) continue
      seenGroups.add(groupId)
      images.sort((left, right) => left.ordinal - right.ordinal)
      merged.push({
        id: `server-evidence-${groupId}`,
        type: 'agent',
        content: images[0]?.content || 'Verification evidence.',
        images: images.map(image => image.url),
      })
    }
  }

  return merged
}
