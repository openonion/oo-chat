'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  HiOutlineArrowLeft,
  HiOutlineChatBubbleLeftRight,
  HiOutlineDocument,
  HiOutlineListBullet,
  HiOutlinePaperAirplane,
  HiOutlineStop,
} from 'react-icons/hi2'
import type { ProviderInvocationUI } from '../types'
import { ToolStatus } from './tools/tool-status'

type WorkroomTab = 'chat' | 'activity' | 'files'

interface CodingAgentWorkroomProps {
  invocation: ProviderInvocationUI
  continuations?: ProviderInvocationUI[]
  onClose: () => void
  onStop?: () => void
  onMessage?: (message: string) => void
}

interface QueuedMessage {
  id: string
  content: string
}

function activityPath(activity: ProviderInvocationUI['activities'][number]): string | null {
  const value = activity.args?.file_path ?? activity.args?.path
  return typeof value === 'string' && value ? value : null
}

export function CodingAgentWorkroom({ invocation, continuations = [], onClose, onStop, onMessage }: CodingAgentWorkroomProps) {
  const [tab, setTab] = useState<WorkroomTab>('chat')
  const [draft, setDraft] = useState('')
  const [queued, setQueued] = useState<QueuedMessage[]>([])
  const running = !['completed', 'failed', 'cancelled'].includes(invocation.status)
  const files = useMemo(
    () => invocation.activities.map(activity => ({ activity, path: activityPath(activity) })).filter(item => item.path),
    [invocation.activities],
  )

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  const submit = () => {
    const message = draft.trim()
    if (!message || !onMessage) return
    setQueued(items => [...items, { id: crypto.randomUUID(), content: message }])
    setDraft('')
    onMessage(message)
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex min-h-0 flex-col bg-neutral-50" role="dialog" aria-modal="true" aria-label={`${invocation.providerDisplayName} Work Room`}>
      <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-3 sm:gap-3 sm:px-5">
        <button type="button" onClick={onClose} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
          <HiOutlineArrowLeft className="h-5 w-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ToolStatus status={invocation.status === 'failed' ? 'error' : invocation.status === 'completed' ? 'done' : 'running'} />
            <h1 className="whitespace-nowrap text-sm font-semibold text-neutral-950">{invocation.providerDisplayName} Work Room</h1>
          </div>
          <p className="truncate text-xs text-neutral-500">{invocation.taskSummary || 'Coding task'}</p>
        </div>
        <span className="hidden rounded-full bg-neutral-100 px-2.5 py-1 text-xs capitalize text-neutral-600 sm:inline">{invocation.status.replace('_', ' ')}</span>
        {running && onStop && (
          <button type="button" onClick={onStop} className="flex min-h-11 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50">
            <HiOutlineStop className="h-4 w-4" /> Stop
          </button>
        )}
        {!running && (
          <button type="button" onClick={onClose} aria-label="Return to conversation" className="min-h-11 shrink-0 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800">
            <span className="sm:hidden">Return</span>
            <span className="hidden sm:inline">Return to conversation</span>
          </button>
        )}
      </header>

      <nav className="grid shrink-0 grid-cols-3 border-b border-neutral-200 bg-white" aria-label="Work Room sections">
        {([
          ['chat', 'Chat', HiOutlineChatBubbleLeftRight],
          ['activity', 'Activity', HiOutlineListBullet],
          ['files', 'Files', HiOutlineDocument],
        ] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`flex min-h-12 items-center justify-center gap-2 border-b-2 text-sm font-medium ${tab === value ? 'border-neutral-900 text-neutral-950' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
          >
            <Icon className="h-4 w-4" /> {label}
            {value === 'files' && files.length > 0 && <span className="rounded-full bg-neutral-100 px-1.5 text-[11px]">{files.length}</span>}
          </button>
        ))}
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-4xl">
          {tab === 'chat' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Target</p>
                <p className="mt-1 text-sm font-medium text-neutral-900">{invocation.providerDisplayName}{invocation.sessionId ? ` · ${invocation.sessionId.slice(0, 12)}…` : ''}</p>
                <p className="mt-2 text-sm text-neutral-600">{invocation.taskSummary || 'Coding task'}</p>
              </div>
              {Array.from({ length: Math.max(queued.length, continuations.length) }, (_, index) => {
                const message = queued[index]
                const continuation = continuations[index]
                const status = continuation?.status === 'completed'
                  ? 'Completed'
                  : continuation?.status === 'failed'
                    ? 'Failed'
                    : continuation
                      ? 'Working'
                      : 'Queued'
                return (
                  <div key={message?.id || continuation.id} className="space-y-3">
                    <div className="ml-auto max-w-[85%] rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white">
                      <p>{message?.content || continuation.taskSummary || 'Continuation'}</p>
                      <p className="mt-1 text-[11px] text-neutral-400">{status} #{index + 1} {status === 'Queued' ? 'to' : 'by'} {invocation.providerDisplayName}</p>
                    </div>
                    {(continuation?.result || continuation?.error) && (
                      <div className={`max-w-[90%] rounded-xl px-4 py-3 text-sm ${continuation.error ? 'bg-red-50 text-red-700' : 'border border-neutral-200 bg-white text-neutral-700'}`}>
                        {continuation.error || continuation.result}
                      </div>
                    )}
                  </div>
                )
              })}
              {invocation.result && (
                <div className="max-w-[90%] rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
                  {invocation.result}
                </div>
              )}
              {invocation.error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{invocation.error}</div>}
            </div>
          )}

          {tab === 'activity' && (
            <ol className="space-y-2" aria-label={`${invocation.providerDisplayName} Work Room activity`}>
              {invocation.activities.map(activity => (
                <li key={activity.id} className="flex min-w-0 gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                  <ToolStatus status={activity.status} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">{activity.name}</p>
                    <p className="mt-1 break-words font-mono text-xs text-neutral-500">{String(activity.args?.command || activity.args?.file_path || activity.args?.path || activity.result || '')}</p>
                    {activity.result && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-neutral-600">{activity.result}</p>}
                  </div>
                </li>
              ))}
              {invocation.activities.length === 0 && <li className="py-12 text-center text-sm text-neutral-500">Waiting for provider activity…</li>}
            </ol>
          )}

          {tab === 'files' && (
            <div className="space-y-2">
              {files.map(({ activity, path }) => (
                <div key={activity.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="break-all font-mono text-sm text-neutral-800">{path}</p>
                  <p className="mt-1 text-xs capitalize text-neutral-500">{activity.status}</p>
                </div>
              ))}
              {files.length === 0 && <p className="py-12 text-center text-sm text-neutral-500">No file changes reported yet.</p>}
            </div>
          )}
        </div>
      </main>

      {tab === 'chat' && (
        <footer className="shrink-0 border-t border-neutral-200 bg-white p-3 sm:p-4">
          <div className="mx-auto flex max-w-4xl items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Message {invocation.providerDisplayName}</span>
              <textarea
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    submit()
                  }
                }}
                disabled={!onMessage}
                rows={2}
                placeholder={`Message ${invocation.providerDisplayName}…`}
                className="max-h-32 min-h-12 w-full resize-none rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-500 disabled:bg-neutral-100"
              />
            </label>
            <button type="button" onClick={submit} disabled={!draft.trim() || !onMessage} aria-label={`Send to ${invocation.providerDisplayName}`} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300">
              <HiOutlinePaperAirplane className="h-5 w-5" />
            </button>
          </div>
        </footer>
      )}
    </div>,
    document.body,
  )
}
