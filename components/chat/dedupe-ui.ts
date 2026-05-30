import type { AgentUI, AskUserField, UI, UIType } from './types'

const VALID_TYPES = new Set<UIType>([
  'user',
  'agent',
  'thinking',
  'tool_call',
  'ask_user',
  'approval_needed',
  'onboard_required',
  'onboard_success',
  'intent',
  'eval',
  'compact',
  'tool_blocked',
  'ulw_turns_reached',
  'plan_review',
  'files_received',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.filter((item): item is string => typeof item === 'string')
  return items.length ? items : undefined
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function sanitizeFields(value: unknown): AskUserField[] | undefined {
  if (!Array.isArray(value)) return undefined
  const fields = value
    .filter(isRecord)
    .map((field): AskUserField => ({
      name: stringValue(field.name),
      label: stringValue(field.label || field.name),
      type: field.type === 'password' ? 'password' : 'text',
      placeholder: stringValue(field.placeholder),
      required: field.required === true,
      autocomplete: stringValue(field.autocomplete),
    }))
    .filter(field => field.name && field.label)
  return fields.length ? fields : undefined
}

function statusValue(value: unknown): 'running' | 'done' | 'error' {
  return value === 'running' || value === 'error' ? value : 'done'
}

function normalizeItem(rawItem: unknown, index: number): UI | null {
  if (!isRecord(rawItem) || typeof rawItem.type !== 'string' || !VALID_TYPES.has(rawItem.type as UIType)) {
    return null
  }

  const type = rawItem.type as UIType
  const id = stringValue(rawItem.id, `recovered-${type}-${index}`)
  const item = { ...rawItem, id, type } as Record<string, unknown>

  switch (type) {
    case 'user':
      return {
        ...item,
        content: stringValue(item.content),
        images: stringArray(item.images),
      } as UI
    case 'agent':
      return {
        ...item,
        content: stringValue(item.content),
        images: uniqueImages(stringArray(item.images)),
      } as UI
    case 'thinking':
      return { ...item, status: statusValue(item.status), content: stringValue(item.content) } as UI
    case 'tool_call':
      return {
        ...item,
        name: stringValue(item.name, 'tool'),
        args: recordValue(item.args),
        status: statusValue(item.status),
        result: stringValue(item.result),
      } as UI
    case 'ask_user':
      return {
        ...item,
        text: stringValue(item.text || item.question),
        options: stringArray(item.options) || [],
        multi_select: item.multi_select === true,
        input_type: stringValue(item.input_type),
        fields: sanitizeFields(item.fields),
      } as UI
    case 'approval_needed':
      return {
        ...item,
        tool: stringValue(item.tool, 'tool'),
        arguments: recordValue(item.arguments),
      } as UI
    case 'onboard_required':
      return { ...item, methods: stringArray(item.methods) || [] } as UI
    case 'onboard_success':
      return { ...item, level: stringValue(item.level), message: stringValue(item.message) } as UI
    case 'intent':
      return { ...item, status: item.status === 'understood' ? 'understood' : 'analyzing' } as UI
    case 'eval':
      return { ...item, status: item.status === 'done' ? 'done' : 'evaluating' } as UI
    case 'compact':
      return { ...item, status: statusValue(item.status) } as UI
    case 'tool_blocked':
      return {
        ...item,
        tool: stringValue(item.tool, 'tool'),
        reason: stringValue(item.reason),
        message: stringValue(item.message),
      } as UI
    case 'ulw_turns_reached':
      return {
        ...item,
        turns_used: typeof item.turns_used === 'number' ? item.turns_used : 0,
        max_turns: typeof item.max_turns === 'number' ? item.max_turns : 0,
      } as UI
    case 'plan_review':
      return { ...item, plan_content: stringValue(item.plan_content) } as UI
    case 'files_received':
      return { ...item, files: Array.isArray(item.files) ? item.files.filter(isRecord) : [] } as UI
  }
}

function uniqueImages(images?: string[]): string[] | undefined {
  if (!images?.length) return images
  const seen = new Set<string>()
  const result: string[] = []

  for (const image of images) {
    if (seen.has(image)) continue
    seen.add(image)
    result.push(image)
  }

  return result
}

function dedupeKey(item: UI): string | null {
  if (item.type === 'agent' && item.images?.length) {
    return `agent-image:${item.images.join('|')}`
  }

  if (item.id && item.id !== '__optimistic__') {
    return `id:${item.id}`
  }

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

export function dedupeUI(items: unknown): UI[] {
  if (!Array.isArray(items)) return []

  const result: UI[] = []
  const seen = new Map<string, number>()

  for (let index = 0; index < items.length; index++) {
    const item = normalizeItem(items[index], index)
    if (!item) continue

    const key = dedupeKey(item)

    if (key && seen.has(key)) {
      const index = seen.get(key)!
      result[index] = mergeItems(result[index], item)
      continue
    }

    if (key) seen.set(key, result.length)
    result.push(item)
  }

  return result
}
