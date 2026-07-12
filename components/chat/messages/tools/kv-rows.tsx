'use client'

/** Structured card view for tool args/results: one row per leaf value,
 *  dot-path labels for nesting — instead of a raw JSON dump. */

type Row = { path: string; value: string; muted: boolean }

export function maybeParse(text: string): unknown {
  const t = text.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return text
  try {
    return JSON.parse(t)
  } catch {
    return text
  }
}

function display(v: unknown): { value: string; muted: boolean } {
  if (v === null || v === undefined) return { value: 'null', muted: true }
  if (v === '') return { value: 'empty', muted: true }
  return { value: String(v), muted: false }
}

function flatten(value: unknown, path: string, rows: Row[]) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      rows.push({ path, value: 'empty', muted: true })
    } else if (value.every(v => v === null || typeof v !== 'object')) {
      rows.push({ path, value: value.map(v => display(v).value).join(', '), muted: false })
    } else {
      value.forEach((v, i) => flatten(v, `${path}[${i}]`, rows))
    }
    return
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      rows.push({ path, value: 'empty', muted: true })
    } else {
      for (const [k, v] of entries) flatten(v, path ? `${path}.${k}` : k, rows)
    }
    return
  }
  rows.push({ path, ...display(value) })
}

export function KVRows({ data }: { data: unknown }) {
  const rows: Row[] = []
  flatten(data, '', rows)
  return (
    <div className="max-h-72 space-y-1 overflow-y-auto">
      {rows.map(({ path, value, muted }, i) => (
        <div key={`${path}-${i}`} className="flex items-baseline gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-neutral-400">{path}</span>
          <span className={`min-w-0 break-all font-mono text-xs leading-relaxed ${muted ? 'italic text-neutral-400' : 'text-neutral-700'}`}>
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}
