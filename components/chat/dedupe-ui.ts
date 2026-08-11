// De-duplicates SDK-normalized presentation items. Wire validation and field
// defaults belong to @connectonion/react; this layer only applies UI merge rules.
import type { AgentUI, UI } from './types'

function uniqueImages(images?: string[]): string[] | undefined {
  if (!images?.length) return images
  return [...new Set(images)]
}

function dedupeKey(item: UI): string | null {
  if (item.type === 'agent' && item.images?.length) {
    return `agent-image:${item.images.join('|')}`
  }
  if (item.id && item.id !== '__optimistic__') return `id:${item.id}`
  return null
}

function mergeItems(previous: UI, next: UI): UI {
  if (previous.type === 'agent' && next.type === 'agent') {
    return {
      ...previous,
      ...next,
      content: next.content || previous.content,
      images: uniqueImages([...(previous.images || []), ...(next.images || [])]),
    } as AgentUI
  }
  return { ...previous, ...next } as UI
}

export function dedupeUI(items?: readonly UI[] | null): UI[] {
  if (!items) return []

  const result: (UI | null)[] = []
  const seen = new Map<string, number>()

  for (const item of items) {
    const key = dedupeKey(item)
    if (key && seen.has(key)) {
      const previousIndex = seen.get(key)!
      const merged = mergeItems(result[previousIndex]!, item)
      if (key.startsWith('agent-image:')) {
        result[previousIndex] = null
        seen.set(key, result.length)
        result.push(merged)
      } else {
        result[previousIndex] = merged
      }
      continue
    }

    if (key) seen.set(key, result.length)
    result.push(item)
  }

  return result.filter((item): item is UI => item !== null)
}
