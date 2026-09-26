'use client'

import { HiOutlineChevronDown, HiOutlineCheckCircle } from 'react-icons/hi2'
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
    content: 'text-neutral-600',
  },
} as const

const PRIORITY = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
} as const

interface CurrentTodoListPanelProps {
  entries: ReadonlyArray<PlanEntry>
}

/** Read-only Todo List progress; it never grants authority. */
export function CurrentTodoListPanel({ entries }: CurrentTodoListPanelProps) {
  if (entries.length === 0) return null

  const completed = entries.filter((entry) => entry.status === 'completed').length

  const current = entries.find(entry => entry.status === 'in_progress')
    ?? entries.find(entry => entry.status === 'pending')
  const done = completed === entries.length

  return (
    <aside aria-label="Current Todo List" className="shrink-0 border-b border-neutral-100 bg-white px-4 sm:px-6">
      <details className="group mx-auto max-w-3xl">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-sm text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 [&::-webkit-details-marker]:hidden">
          {done
            ? <HiOutlineCheckCircle aria-hidden className="h-4 w-4 shrink-0 text-emerald-700" />
            : <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-identity-700" />}
          <span className="min-w-0 flex-1 truncate" aria-live="polite">
            {done ? 'Plan complete' : current?.content ?? 'Task plan'}
          </span>
          <span className="shrink-0 text-xs tabular-nums">{completed}/{entries.length}</span>
          <span className="sr-only"> completed. View task plan</span>
          <HiOutlineChevronDown aria-hidden className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <ol className="mb-3 max-h-48 divide-y divide-neutral-100 overflow-y-auto" aria-label="Todo List items">
          {entries.map((entry, index) => {
            const status = STATUS[entry.status]
            return (
              <li key={`${index}:${entry.content}`} className="flex items-start gap-3 py-3 text-sm">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={`break-words leading-5 ${status.content}`}>{entry.content}</p>
                  <p className="mt-1 text-xs text-neutral-500">{status.label} · {PRIORITY[entry.priority]}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </details>
    </aside>
  )
}
