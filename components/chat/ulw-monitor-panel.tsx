'use client'

import { useState, useCallback } from 'react'
import { HiOutlinePencil, HiCheck } from 'react-icons/hi'
import { HiOutlineArrowsExpand } from 'react-icons/hi'
import type { UI, ToolCallUI, ThinkingUI } from './types'
import { cn } from './utils'

interface UlwMonitorPanelProps {
  turnsRemaining: number | null
  ui: UI[]
  goal: string
  direction: string
  onGoalSave: (goal: string) => void
  onDirectionSave: (direction: string) => void
  onStop: () => void
  onExpand?: () => void
}

function getCurrentAction(ui: UI[]): string {
  for (let i = ui.length - 1; i >= 0; i--) {
    const item = ui[i]
    if (item.type === 'tool_call' && (item as ToolCallUI).status === 'running') {
      return (item as ToolCallUI).name.replace(/_/g, ' ')
    }
    if (item.type === 'thinking' && (item as ThinkingUI).status === 'running') {
      const kind = (item as ThinkingUI).kind
      return kind === 'intent' ? 'understanding goal' : kind === 'plan' ? 'planning' : 'thinking'
    }
  }
  for (let i = ui.length - 1; i >= 0; i--) {
    const item = ui[i]
    if (item.type === 'tool_call') {
      return (item as ToolCallUI).name.replace(/_/g, ' ')
    }
  }
  return 'working'
}

interface EditableFieldProps {
  label: string
  value: string
  onSave: (value: string) => void
  placeholder?: string
}

function EditableField({ label, value, onSave, placeholder }: EditableFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const startEdit = useCallback(() => {
    setDraft(value)
    setEditing(true)
  }, [value])

  const save = useCallback(() => {
    setEditing(false)
    if (draft.trim() !== value) {
      onSave(draft.trim())
    }
  }, [draft, value, onSave])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      save()
    }
    if (e.key === 'Escape') {
      setEditing(false)
      setDraft(value)
    }
  }

  if (editing) {
    return (
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">{label}</span>
        <div className="flex items-start gap-2 mt-0.5">
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={save}
            rows={2}
            className="flex-1 resize-none bg-neutral-100 dark:bg-neutral-800 rounded-lg px-2 py-1 text-[13px] text-neutral-800 dark:text-neutral-200 focus:outline-none focus:bg-neutral-200 dark:focus:bg-neutral-700 transition-colors leading-snug"
          />
          <button
            onMouseDown={e => { e.preventDefault(); save() }}
            className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shrink-0"
            aria-label="Save"
          >
            <HiCheck className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0">
      <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">{label}</span>
      {/* Always-visible edit button — no hover-only affordance */}
      <button
        onClick={startEdit}
        aria-label={`Edit ${label.toLowerCase()}`}
        className="group flex items-start gap-2 w-full text-left mt-0.5 px-2 py-1.5 -mx-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        {/* line-clamp-2: show up to 2 lines, never truncate to 1 */}
        <span className={cn(
          'text-[13px] leading-snug flex-1 min-w-0 line-clamp-2',
          value ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-500 italic'
        )}>
          {value || placeholder}
        </span>
        {/* Pencil always visible, not hover-only */}
        <HiOutlinePencil className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0 mt-0.5" aria-hidden="true" />
      </button>
    </div>
  )
}

export function UlwMonitorPanel({
  turnsRemaining,
  ui,
  goal,
  direction,
  onGoalSave,
  onDirectionSave,
  onStop,
  onExpand,
}: UlwMonitorPanelProps) {
  const currentAction = getCurrentAction(ui)

  return (
    <div className="px-4 pb-6 pt-2">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 overflow-hidden">
          {/* Live action row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
            {/* Pulsing dot */}
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 dark:bg-blue-500 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500 dark:bg-blue-400" />
            </span>

            <span className="flex-1 text-[14px] font-medium text-neutral-700 dark:text-neutral-200 truncate capitalize">
              {currentAction}...
            </span>

            {/* Turns counter with label + expand + Stop */}
            <div className="flex items-center gap-2 shrink-0">
              <div
                className="flex items-center gap-1 text-[12px]"
                title="Turns remaining until auto-stop"
              >
                <span className="text-neutral-400 dark:text-neutral-500">turns:</span>
                <span className="font-medium tabular-nums text-neutral-600 dark:text-neutral-300">
                  {turnsRemaining ?? '—'}
                </span>
              </div>
              {onExpand && (
                <button
                  onClick={onExpand}
                  title="Full screen"
                  aria-label="Expand to fullscreen"
                  className="p-1 rounded-lg text-neutral-400 dark:text-neutral-500
                    hover:text-neutral-600 dark:hover:text-neutral-300
                    hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  <HiOutlineArrowsExpand className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={onStop}
                className="px-3 py-1 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-[12px] font-medium
                  hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
              >
                Stop
              </button>
            </div>
          </div>

          {/* Goal + Direction editable fields */}
          <div className="flex gap-4 px-4 py-3">
            <EditableField
              label="Goal"
              value={goal}
              onSave={onGoalSave}
              placeholder="No goal set"
            />
            <div className="w-px bg-neutral-200 dark:bg-neutral-700 shrink-0" />
            <EditableField
              label="Direction"
              value={direction}
              onSave={onDirectionSave}
              placeholder="Add direction..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}
