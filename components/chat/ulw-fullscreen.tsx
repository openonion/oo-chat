'use client'

import { useEffect, useState, useCallback } from 'react'
import { HiOutlineArrowsExpand } from 'react-icons/hi'
import type { UI, ToolCallUI, ThinkingUI } from './types'
import { cn } from './utils'

interface ActivityItem {
  id: string
  icon: string
  label: string
  status: 'running' | 'done' | 'error'
}

function getRecentActivity(ui: UI[]): ActivityItem[] {
  const items: ActivityItem[] = []
  for (let i = ui.length - 1; i >= 0 && items.length < 6; i--) {
    const item = ui[i]
    if (item.type === 'tool_call') {
      const tc = item as ToolCallUI
      items.push({ id: item.id, icon: toolIcon(tc.name), label: tc.name.replace(/_/g, ' '), status: tc.status })
    } else if (item.type === 'thinking' && (item as ThinkingUI).status === 'running') {
      const th = item as ThinkingUI
      items.push({ id: item.id, icon: '◌', label: th.kind === 'plan' ? 'planning' : 'thinking', status: 'running' })
    }
  }
  return items.reverse()
}

function toolIcon(name: string): string {
  if (name.includes('bash') || name.includes('shell')) return '>'
  if (name.includes('write') || name.includes('create')) return '+'
  if (name.includes('read') || name.includes('view')) return '~'
  if (name.includes('edit') || name.includes('patch')) return '±'
  if (name.includes('grep') || name.includes('search')) return '?'
  return '·'
}

interface UlwFullscreenProps {
  turnsRemaining: number | null
  ui: UI[]
  goal: string
  direction: string
  onGoalSave: (goal: string) => void
  onDirectionSave: (direction: string) => void
  onStop: () => void
  onCollapse: () => void
}

export function UlwFullscreen({
  turnsRemaining,
  ui,
  goal,
  direction,
  onGoalSave,
  onDirectionSave,
  onStop,
  onCollapse,
}: UlwFullscreenProps) {
  const activity = getRecentActivity(ui)
  const currentAction = activity.find(a => a.status === 'running')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCollapse() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCollapse])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-neutral-950 animate-in fade-in duration-150">
      {/* Header — compact status bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500 dark:bg-blue-400" />
          </span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400 capitalize">
            {currentAction ? `${currentAction.label}...` : 'Ultra work mode'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
            turns: <span className="font-medium text-neutral-600 dark:text-neutral-300">{turnsRemaining ?? '—'}</span>
          </span>
          <button
            onClick={onCollapse}
            title="Collapse (Esc)"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <HiOutlineArrowsExpand className="w-4 h-4 rotate-180" />
          </button>
          <button
            onClick={onStop}
            className="px-4 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            Stop
          </button>
        </div>
      </div>

      {/* Main — prompt editors take all the space */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">
          <PromptEditor
            label="Goal"
            value={goal}
            onSave={onGoalSave}
            placeholder="What should the agent work on?"
            rows={5}
          />
          <PromptEditor
            label="Direction"
            value={direction}
            onSave={onDirectionSave}
            placeholder="Any constraints, style, or notes for the agent..."
            rows={4}
          />
        </div>
      </div>

      {/* Footer — activity as secondary info */}
      {activity.length > 0 && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 px-6 py-2">
          <div className="max-w-2xl mx-auto flex items-center gap-4 overflow-x-auto">
            <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide shrink-0">
              Activity
            </span>
            <div className="flex items-center gap-2 flex-1 overflow-x-auto">
              {activity.map(item => (
                <span
                  key={item.id}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] shrink-0',
                    item.status === 'running'
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                      : item.status === 'error'
                        ? 'bg-red-50 dark:bg-red-950/20 text-red-500'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                  )}
                >
                  <span className={cn('font-mono', item.status === 'running' && 'animate-pulse')}>
                    {item.status === 'done' ? '✓' : item.status === 'error' ? '✕' : item.icon}
                  </span>
                  <span className="capitalize">{item.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface PromptEditorProps {
  label: string
  value: string
  onSave: (v: string) => void
  placeholder: string
  rows: number
}

function PromptEditor({ label, value, onSave, placeholder, rows }: PromptEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  // Sync draft when value changes externally
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const save = useCallback(() => {
    setEditing(false)
    if (draft.trim() !== value) onSave(draft.trim())
  }, [draft, value, onSave])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
    if (e.key === 'Escape') { setEditing(false); setDraft(value) }
  }

  return (
    <div>
      <label className="block text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
        {label}
      </label>
      {editing ? (
        <div>
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={rows}
            className="w-full resize-none rounded-xl border border-neutral-200 dark:border-neutral-700
              bg-white dark:bg-neutral-900 px-4 py-3
              text-[15px] text-neutral-900 dark:text-neutral-100 leading-relaxed
              focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
          />
          <div className="flex items-center justify-end gap-3 mt-2">
            <span className="text-[11px] text-neutral-400">⌘↵ to save · Esc to cancel</span>
            <button
              onMouseDown={e => { e.preventDefault(); save() }}
              className="px-3 py-1 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setDraft(value); setEditing(true) }}
          className={cn(
            'w-full text-left rounded-xl border px-4 py-3 transition-colors group',
            'border-neutral-200 dark:border-neutral-700',
            'hover:border-blue-300 dark:hover:border-blue-600',
            'hover:bg-neutral-50 dark:hover:bg-neutral-900',
          )}
          aria-label={`Edit ${label.toLowerCase()}`}
        >
          <span className={cn(
            'text-[15px] leading-relaxed block whitespace-pre-wrap',
            value ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-400 dark:text-neutral-600 italic'
          )}>
            {value || placeholder}
          </span>
        </button>
      )}
    </div>
  )
}

/** Small expand button to attach to the monitor panel */
export function UlwExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Full screen (expand)"
      className="p-1 rounded-lg text-neutral-400 dark:text-neutral-500
        hover:text-neutral-600 dark:hover:text-neutral-300
        hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
      aria-label="Expand to fullscreen"
    >
      <HiOutlineArrowsExpand className="w-3.5 h-3.5" />
    </button>
  )
}
