'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'
import { ChatLayout } from '@/components/chat-layout'
import { useIdentity } from '@/hooks/use-identity'

interface ReplyDraft {
  draftId: string
  messageId: string
  subject: string
  from: string
  draftBody: string
  originalEmail?: string
}

interface MeetingProposal {
  title?: string
  date?: string
  start_time?: string
  end_time?: string
  location?: string
  attendees?: string
  is_video_call?: boolean
  meeting_id?: string
}

interface BriefingData {
  scanSince?: number
  scanUntil?: number
  provider?: string
  messagesSeen?: number
  briefing: string
  summary: string
  drafts?: ReplyDraft[]
  meetings?: MeetingProposal[]
}


type DraftListRow =
  | { kind: 'draft'; draft: ReplyDraft }
  | { kind: 'deleted'; draftId: string; subject: string }

function formatTs(ts: number | undefined) {
  if (!ts) return null
  return new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * Normalize meeting data to type MeetingProposal[]
 * @param raw - The raw data to normalize
 * @returns The normalized meeting data
 */
function normalizeMeetings(raw: unknown): MeetingProposal[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is MeetingProposal => x !== null && typeof x === 'object')
}

export default function BriefingPage() {
  useIdentity()
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draftText, setDraftText] = useState<Record<string, string>>({})
  const [sendState, setSendState] = useState<
    Record<string, { status: 'idle' | 'sending' | 'sent' | 'error'; message?: string }>
  >({})
  const [discardBusyId, setDiscardBusyId] = useState<string | null>(null)
  const [draftRows, setDraftRows] = useState<DraftListRow[]>([])
  const draftTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})

  const autoResizeDraftTextarea = useCallback((draftId: string) => {
    const el = draftTextareaRefs.current[draftId]
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/automation/briefing')
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((d: BriefingData) => {
        if (cancelled) return
        const drafts = Array.isArray(d.drafts) ? d.drafts : []
        const meetings = normalizeMeetings(d.meetings)
        setData({ ...d, drafts, meetings })
        setDraftRows(drafts.map((x) => ({ kind: 'draft', draft: x })))
        const initial: Record<string, string> = {}
        for (const x of drafts) {
          initial[x.draftId] = x.draftBody
        }
        setDraftText(initial)
        setSendState({})
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Failed to load briefing')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const draftEntities = useMemo(
    () =>
      draftRows
        .filter((r): r is { kind: 'draft'; draft: ReplyDraft } => r.kind === 'draft')
        .map((r) => r.draft),
    [draftRows]
  )

  useEffect(() => {
    for (const d of draftEntities) {
      autoResizeDraftTextarea(d.draftId)
    }
  }, [draftEntities, draftText, autoResizeDraftTextarea])

  const sendReply = useCallback(
    async (draft: ReplyDraft) => {
      const body = draftText[draft.draftId] ?? draft.draftBody
      setSendState((s) => ({
        ...s,
        [draft.draftId]: { status: 'sending' },
      }))
      try {
        const res = await fetch('/api/automation/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: draft.messageId,
            body,
            draftId: draft.draftId,
          }),
        })
        const json = (await res.json()) as { ok?: boolean; error?: string; message?: string }
        if (!res.ok || json.ok !== true) {
          setSendState((s) => ({
            ...s,
            [draft.draftId]: {
              status: 'error',
              message: json.error || res.statusText || 'Send failed',
            },
          }))
          return
        }
        setSendState((s) => ({
          ...s,
          [draft.draftId]: { status: 'sent', message: json.message },
        }))
      } catch (e) {
        setSendState((s) => ({
          ...s,
          [draft.draftId]: {
            status: 'error',
            message: e instanceof Error ? e.message : 'Network error',
          },
        }))
      }
    },
    [draftText]
  )

  const discardDraft = useCallback(async (draft: ReplyDraft) => {
    if (!window.confirm('Discard this draft? It will not be sent.')) return
    setDiscardBusyId(draft.draftId)
    try {
      const res = await fetch('/api/automation/discard-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: draft.draftId, messageId: draft.messageId }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        window.alert(json.error || 'Could not discard draft')
        return
      }
      setDraftRows((rs) =>
        rs.map((r) =>
          r.kind === 'draft' && r.draft.draftId === draft.draftId
            ? { kind: 'deleted', draftId: draft.draftId, subject: draft.subject }
            : r
        )
      )
      setData((prev) =>
        prev
          ? { ...prev, drafts: (prev.drafts ?? []).filter((x) => x.draftId !== draft.draftId) }
          : null
      )
      setDraftText((prev) => {
        const next = { ...prev }
        delete next[draft.draftId]
        return next
      })
      setSendState((prev) => {
        const next = { ...prev }
        delete next[draft.draftId]
        return next
      })
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Network error')
    } finally {
      setDiscardBusyId(null)
    }
  }, [])

  const scanFrom = formatTs(data?.scanSince)
  const scanTo = formatTs(data?.scanUntil)

  return (
    <ChatLayout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Your Assistant</h1>
          {loading && <div className="py-12 text-center text-neutral-500">Loading…</div>}
          {error && (
            <div className="py-8 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-center">
              {error}
            </div>
          )}
          {!loading && !error && data && (
            <>
              <div className="text-xs text-neutral-400 mb-4 space-y-0.5">
                {scanFrom && scanTo && (
                  <p>
                    Last inbox scan: {scanFrom} → {scanTo}
                  </p>
                )}
                {data.summary && (
                  <p>{data.summary}</p>
                )}
              </div>

              <section className="mb-8">
                <h2 className="text-lg font-semibold text-neutral-900 mb-3">Proposed Meetings</h2>
                  {Array.isArray(data.meetings) && data.meetings.length > 0 ? (
                    <ul className="space-y-4">
                      {data.meetings.map((m, i) => (
                        <li
                          key={i}
                          className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-neutral-800"
                        >
                          <p className="font-semibold">{m.title ?? 'Event'}</p>
                          {m.date && <p>Date: {m.date}</p>}
                          {m.start_time && m.end_time&& <p>Time: {m.start_time} - {m.end_time}</p>}
                          {m.start_time && !m.end_time&& <p>Starting Time: {m.start_time}</p>}
                          {m.end_time && !m.start_time&& <p>Ending Time: {m.end_time}</p>}
                          {m.location && <p>Location: {m.location}</p>}
                          {m.attendees && <p>Attendees: {m.attendees}</p>}
                          {m.is_video_call && <p>Video call</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-neutral-500">No meetings to schedule.</p>
                  )}
              </section>

              {draftRows.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-lg font-semibold text-neutral-900 mb-3">Reply drafts</h2>
                  <ul className="space-y-4">
                    {draftRows.map((row) => {
                      if (row.kind === 'deleted') {
                        return (
                          <li
                            key={row.draftId}
                            className="rounded-2xl border p-4 shadow-sm border-red-200 bg-red-50"
                          >
                            <p className="text-xs text-red-700 mb-1">Message deleted</p>
                            <p className="text-sm font-medium text-red-900">{row.subject}</p>
                          </li>
                        )
                      }
                      const d = row.draft
                      const st = sendState[d.draftId]?.status ?? 'idle'
                      const errMsg = sendState[d.draftId]?.message
                      return (
                        <li
                          key={d.draftId}
                          className={`group relative rounded-2xl border p-4 shadow-sm ${
                            st === 'sent'
                              ? 'border-green-200 bg-green-50'
                              : 'border-neutral-200 bg-white'
                          }`}
                        >
                          {st === 'sent' ? (
                            <>
                              <p className="text-xs text-green-700 mb-1">Reply sent</p>
                              <p className="text-sm font-medium text-green-900">{d.subject}</p>
                              <p className="text-sm text-green-800 mt-1">
                                {errMsg || 'Reply sent successfully.'}
                              </p>
                            </>
                          ) : (
                            <>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-neutral-600 mb-1">From</p>
                              <p className="text-sm font-medium text-neutral-900 mb-2">{d.from}</p>
                              <p className="text-xs font-medium text-neutral-600 mb-1">Subject</p>
                              <p className="text-sm font-medium text-neutral-900">{d.subject}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void discardDraft(d)}
                              disabled={
                                st === 'sending' || discardBusyId === d.draftId
                              }
                              className="shrink-0 p-1 text-neutral-400 hover:text-neutral-600 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:pointer-events-none"
                              aria-label="Discard draft"
                              title="Discard draft"
                            >
                              <HiOutlineTrash className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="mb-4">
                            <p className="text-xs font-medium text-neutral-600 mb-1">
                              Original message
                            </p>
                            <div className="max-h-64 overflow-y-auto rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
                              <pre className="whitespace-pre-wrap font-sans text-xs text-neutral-800 leading-relaxed m-0">
                                {d.originalEmail?.trim() ||
                                  '(Message body was not stored — re-run automation for this draft.)'}
                              </pre>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mb-1">  
                            <p className="text-xs font-medium text-neutral-600 m-0">Your reply</p>
                            <HiOutlinePencil
                              className="w-3.5 h-3.5 text-neutral-400 shrink-0"
                              aria-hidden
                            />
                          </div>
                          <label htmlFor={`draft-${d.draftId}`} className="sr-only">
                            Reply body
                          </label>
                          <textarea
                            id={`draft-${d.draftId}`}
                            ref={(el) => {
                              draftTextareaRefs.current[d.draftId] = el
                              if (el) {
                                el.style.height = 'auto'
                                el.style.height = `${el.scrollHeight}px`
                              }
                            }}
                            className="w-full resize-none overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5 font-sans text-xs text-neutral-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-60"
                            value={draftText[d.draftId] ?? d.draftBody}
                            onChange={(e) => {
                              setDraftText((prev) => ({ ...prev, [d.draftId]: e.target.value }))
                              autoResizeDraftTextarea(d.draftId)
                            }}
                            disabled={st === 'sending'}
                          />
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="rounded-xl bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-800 disabled:opacity-50 disabled:pointer-events-none"
                              disabled={st === 'sending'}
                              onClick={() => void sendReply(d)}
                            >
                              {st === 'sending' ? 'Sending…' : 'Send reply'}
                            </button>
                            {st === 'error' && (
                              <span className="text-sm text-red-600">{errMsg}</span>
                            )}
                          </div>
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {data.briefing ? (
                <section>
                  <h2 className="text-lg font-semibold text-neutral-900 mb-3">Briefing</h2>
                  <div className="rounded-2xl border border-neutral-100 bg-white p-6">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-800 leading-relaxed">
                      {data.briefing}
                    </pre>
                  </div>
                </section>
              ) : (
                !draftRows.length && (
                  <p className="text-neutral-500">
                    No briefing content yet. Run automation once (with a linked inbox) to populate.
                  </p>
                )
              )}
            </>
          )}
        </div>
      </div>
    </ChatLayout>
  )
}
