'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatLayout } from '@/components/chat-layout'
import { useIdentity } from '@/hooks/use-identity'

/** Matches automation `briefing_sections_from_markdown` for JSON without `briefingSections`. */
interface BriefingSection {
  title: string
  body: string
}

const BRIEFING_HEADING = /^##\s+(.+)$/gm

function parseBriefingSections(briefing: string): BriefingSection[] {
  const text = briefing.trim()
  if (!text) return []

  const matches = Array.from(text.matchAll(BRIEFING_HEADING)) as RegExpMatchArray[]
  if (matches.length === 0) return [{ title: '', body: text }]

  const sections: BriefingSection[] = []
  const firstIdx = matches[0].index ?? 0
  if (firstIdx > 0) {
    const pre = text.slice(0, firstIdx).trim()
    if (pre) sections.push({ title: '', body: pre })
  }

  for (let i = 0; i < matches.length; i++) {
    const title = (matches[i][1] ?? '').trim()
    const start = (matches[i].index ?? 0) + matches[i][0].length
    const end =
      i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length
    sections.push({ title, body: text.slice(start, end).trim() })
  }

  return sections
}

interface ReplyDraft {
  draftId: string
  messageId: string
  subject: string
  from: string
  draftBody: string
  originalEmail?: string
}

interface BriefingData {
  scanSince?: number
  scanUntil?: number
  provider?: string
  messagesSeen?: number
  briefingSections: BriefingSection[]
  summary: string
  drafts?: ReplyDraft[]
}

/** Older automation_briefing.json may still have a flat `briefing` string. */
function legacyBriefingPlainText(o: object): string {
  if ('briefing' in o && typeof (o as { briefing: unknown }).briefing === 'string') {
    return (o as { briefing: string }).briefing
  }
  return ''
}

function briefingSectionsForDisplay(d: BriefingData): BriefingSection[] {
  if (d.briefingSections.length > 0) {
    return d.briefingSections
  }
  return parseBriefingSections(legacyBriefingPlainText(d))
}

function BriefingSectionBody({ markdown }: { markdown: string }) {
  return (
    <div
      className="prose prose-sm prose-neutral max-w-none text-neutral-700 leading-relaxed sm:border-l-2 sm:border-neutral-100 sm:pl-4
        prose-p:my-1.5 prose-p:text-sm
        prose-ol:my-2 prose-ol:text-sm prose-ul:my-2
        prose-li:my-0.5 prose-li:text-sm
        prose-strong:font-semibold prose-strong:text-neutral-900"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  )
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
  const [assistantPanelDraftId, setAssistantPanelDraftId] = useState<string | null>(null)
  const [assistantInstruction, setAssistantInstruction] = useState<Record<string, string>>({})
  const [refineBusyId, setRefineBusyId] = useState<string | null>(null)
  const [refineError, setRefineError] = useState<Record<string, string>>({})
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
        setData({ ...d, drafts })
        setDraftRows(drafts.map((x) => ({ kind: 'draft', draft: x })))
        const initial: Record<string, string> = {}
        for (const x of drafts) {
          initial[x.draftId] = x.draftBody
        }
        setDraftText(initial)
        setSendState({})
        setAssistantPanelDraftId(null)
        setAssistantInstruction({})
        setRefineBusyId(null)
        setRefineError({})
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

  const briefingSections = useMemo(
    () => (data ? briefingSectionsForDisplay(data) : []),
    [data]
  )

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

  const refineDraftWithAssistant = useCallback(
    async (draft: ReplyDraft) => {
      const instruction = (assistantInstruction[draft.draftId] ?? '').trim()
      if (!instruction) {
        setRefineError((e) => ({
          ...e,
          [draft.draftId]: 'Describe how you want the reply changed.',
        }))
        return
      }
      const currentDraft = draftText[draft.draftId] ?? draft.draftBody
      setRefineBusyId(draft.draftId)
      setRefineError((e) => {
        const next = { ...e }
        delete next[draft.draftId]
        return next
      })
      try {
        const res = await fetch('/api/automation/refine-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction,
            currentDraft,
            subject: draft.subject,
            from: draft.from,
            originalEmail: draft.originalEmail,
            draftId: draft.draftId,
            messageId: draft.messageId,
          }),
        })
        const json = (await res.json()) as {
          ok?: boolean
          draftBody?: string
          error?: string
        }
        if (!res.ok || !json.ok || !json.draftBody) {
          setRefineError((e) => ({
            ...e,
            [draft.draftId]: json.error || res.statusText || 'Could not update draft',
          }))
          return
        }
        setDraftText((prev) => ({ ...prev, [draft.draftId]: json.draftBody! }))
        setData((prev) =>
          prev
            ? {
                ...prev,
                drafts: (prev.drafts ?? []).map((x) =>
                  x.draftId === draft.draftId ? { ...x, draftBody: json.draftBody! } : x
                ),
              }
            : null
        )
        setDraftRows((rs) =>
          rs.map((r) =>
            r.kind === 'draft' && r.draft.draftId === draft.draftId
              ? { ...r, draft: { ...r.draft, draftBody: json.draftBody! } }
              : r
          )
        )
        setAssistantInstruction((prev) => ({ ...prev, [draft.draftId]: '' }))
        setAssistantPanelDraftId(null)
      } catch (e) {
        setRefineError((err) => ({
          ...err,
          [draft.draftId]: e instanceof Error ? e.message : 'Network error',
        }))
      } finally {
        setRefineBusyId(null)
      }
    },
    [assistantInstruction, draftText]
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

              {draftRows.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-lg font-semibold text-neutral-900 mb-3">Reply drafts</h2>
                  <ul className="flex flex-col gap-4">
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
                              Body
                            </p>
                            <div className="max-h-64 overflow-y-auto rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
                              <pre className="whitespace-pre-wrap font-sans text-xs text-neutral-800 leading-relaxed m-0">
                                {d.originalEmail?.trim() ||
                                  '(Message body was not stored — re-run automation for this draft.)'}
                              </pre>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-medium text-neutral-600 m-0">Your reply</p>
                              <HiOutlinePencil
                                className="w-3.5 h-3.5 text-neutral-400 shrink-0"
                                aria-hidden
                              />
                            </div>
                            <button
                              type="button"
                              className="text-xs font-medium text-neutral-700 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none"
                              disabled={st === 'sending' || refineBusyId === d.draftId}
                              onClick={() =>
                                setAssistantPanelDraftId((id) =>
                                  id === d.draftId ? null : d.draftId
                                )
                              }
                            >
                              {assistantPanelDraftId === d.draftId
                                ? 'Hide assistant'
                                : 'Edit with assistant'}
                            </button>
                          </div>
                          {assistantPanelDraftId === d.draftId && (
                            <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 space-y-2">
                              <label
                                htmlFor={`assist-${d.draftId}`}
                                className="text-xs font-medium text-neutral-600 block"
                              >
                                Tell the assistant how to change this reply
                              </label>
                              <textarea
                                id={`assist-${d.draftId}`}
                                rows={2}
                                className="w-full resize-y rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                                placeholder="e.g. Shorter, more formal, mention Friday deadline"
                                value={assistantInstruction[d.draftId] ?? ''}
                                onChange={(e) =>
                                  setAssistantInstruction((prev) => ({
                                    ...prev,
                                    [d.draftId]: e.target.value,
                                  }))
                                }
                                disabled={refineBusyId === d.draftId}
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  className="rounded-lg bg-neutral-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-neutral-800 disabled:opacity-50 disabled:pointer-events-none"
                                  disabled={refineBusyId === d.draftId}
                                  onClick={() => void refineDraftWithAssistant(d)}
                                >
                                  {refineBusyId === d.draftId ? 'Updating…' : 'Apply to draft'}
                                </button>
                                {refineError[d.draftId] && (
                                  <span className="text-xs text-red-600">
                                    {refineError[d.draftId]}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
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

              {briefingSections.some((s) => s.title || s.body) ? (
                <section>
                  <h2 className="text-lg font-semibold text-neutral-900 mb-3">Briefing</h2>
                  <div className="rounded-2xl border border-neutral-100 bg-white p-6 space-y-0 divide-y divide-neutral-100">
                    {briefingSections.map((sec, i) => (
                      <div
                        key={i}
                        className="pt-5 first:pt-0 pb-5 last:pb-0"
                      >
                        {sec.title ? (
                          <h3 className="text-base font-semibold text-neutral-900 mb-2.5 tracking-tight">
                            {sec.title}
                          </h3>
                        ) : null}
                        {sec.body ? (
                          <BriefingSectionBody markdown={sec.body} />
                        ) : null}
                      </div>
                    ))}
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
