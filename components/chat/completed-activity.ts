import type { UI } from './types'

/** Finished tool runs remain inspectable without preceding the result with a log wall. */
export function completedActivityGroups(items: UI[]) {
  const groups = new Map<string, UI[]>()
  const hidden = new Set<string>()
  const resultIds = new Set<string>()
  const complete = (item: UI) => (item.type === 'tool_call' && item.status === 'done')
    || (item.type === 'thinking' && item.status === 'done' && !item.content)
  for (let index = 0; index < items.length; index++) {
    if (!complete(items[index])) continue
    const start = index
    while (index < items.length && complete(items[index])) index++
    const group = items.slice(start, index)
    // Keep running, failed, blocked and approval activity visible. Collapse only
    // after a real assistant result has arrived for this contiguous work.
    if (items[index]?.type === 'agent' && group.filter(item => item.type === 'tool_call').length >= 3) {
      groups.set(group[0].id, group)
      resultIds.add(items[index].id)
      group.slice(1).forEach(item => hidden.add(item.id))
    }
    index--
  }
  return { groups, hidden, resultIds }
}
