import type { PlanEntry } from '@connectonion/react'

const STATUS = {
  pending: {
    label: 'Pending',
    dot: 'bg-neutral-300',
    content: 'text-neutral-700',
  },
  in_progress: {
    label: 'In progress',
    dot: 'bg-brand-500',
    content: 'font-medium text-neutral-950',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-emerald-500',
    content: 'text-neutral-500 line-through decoration-neutral-300',
  },
} as const

const PRIORITY = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
} as const

interface CurrentPlanPanelProps {
  entries: ReadonlyArray<PlanEntry>
}

/** Read-only progress state. Plan approval remains in the plan-review tool card. */
export function CurrentPlanPanel({ entries }: CurrentPlanPanelProps) {
  if (entries.length === 0) return null

  const completed = entries.filter((entry) => entry.status === 'completed').length

  return (
    <aside
      aria-label="Current plan"
      aria-live="polite"
      className="shrink-0 border-b border-neutral-200 bg-neutral-50/90 px-4 py-3"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
            Current plan
          </h2>
          <p className="text-xs tabular-nums text-neutral-500">
            {completed} / {entries.length} completed
          </p>
        </div>
        <ol className="max-h-52 space-y-1.5 overflow-y-auto md:max-h-36" aria-label="Plan steps">
          {entries.map((entry, index) => {
            const status = STATUS[entry.status]
            return (
              <li
                key={`${index}:${entry.content}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-white px-2.5 py-2 text-sm ring-1 ring-neutral-200"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} aria-hidden="true" />
                <span className={`min-w-0 flex-1 break-words ${status.content}`}>{entry.content}</span>
                <span className="text-xs font-medium text-neutral-600">{status.label}</span>
                <span className="text-xs text-neutral-500">{PRIORITY[entry.priority]}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </aside>
  )
}
