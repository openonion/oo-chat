'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HiOutlineCalendar, HiOutlineMinusCircle, HiOutlineExclamationCircle, HiOutlineChevronDown, HiCog, HiOutlineClock, HiOutlineQuestionMarkCircle, HiOutlineLightningBolt, HiOutlineLocationMarker, HiOutlinePencil, HiOutlineRefresh, HiOutlineReply, HiOutlineTrash, HiOutlineUsers, HiOutlineVideoCamera } from 'react-icons/hi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatLayout } from '@/components/chat-layout'
import { useIdentity } from '@/hooks/use-identity'
import type { BriefingData, DraftListRow, MeetingListRow, MeetingProposal, ReplyDraft } from './types'
import { addOneHourToTime, BRIEFING_GREEN_OUTLINE_BTN, briefingSectionsForDisplay, CALENDAR_TIME_OPTIONS, defaultModalTimes, formatTs, isSummaryBriefingSectionTitle, MEETINGS_LIST_BORDER, meetingBothTimesMissing, meetingTimesIncomplete, normalizeMeetings, priorityEmailCountsFromSections, snapTimeToNearestSlot, subtractOneHourFromTime, timeToMinutes, truncatePreview } from './briefing-helpers'
import { briefingSectionTitlePriority } from './briefing-helpers'

/** Displays the briefing section (a markdown string) as a styled block of text. */
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

function parseTimeInput(raw: string): string | null {
  const s = raw.trim().toLowerCase()
  const hhmm = s.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmm) {
    const h = parseInt(hhmm[1], 10), m = parseInt(hhmm[2], 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59)
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0
    if (ampm[3] === 'pm' && h !== 12) h += 12
    if (ampm[3] === 'am' && h === 12) h = 0
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59)
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const hourOnly = s.match(/^(\d{1,2})$/)
  if (hourOnly) {
    const h = parseInt(hourOnly[1], 10)
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:00`
  }
  return null
}

/** Time picker with text input and dropdown menu for start and end time selection */
function CompactTimeSelect({ id, labelId, value, options, onChange, open, onToggle, onClose }: {
  id: string
  labelId: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  open: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const [inputText, setInputText] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const selected = options.find((o) => o.value === value)
  const displayLabel = selected?.label ?? value

  const commitInput = () => {
    if (inputText === null) return
    const parsed = parseTimeInput(inputText)
    if (parsed) onChange(snapTimeToNearestSlot(parsed))
    setInputText(null)
  }

  return (
    <div className="relative flex items-center rounded-md border border-neutral-200 bg-white focus-within:ring-1 focus-within:ring-neutral-300">
      <input
        id={id}
        type="text"
        aria-labelledby={labelId}
        value={inputText ?? displayLabel}
        onChange={(e) => setInputText(e.target.value)}
        onBlur={commitInput}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitInput() } }}
        className="flex-1 min-w-0 pl-2 py-1.5 text-xs text-neutral-900 bg-transparent focus:outline-none"
      />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        tabIndex={-1}
        onClick={onToggle}
        className="px-1.5 py-1.5 text-neutral-400 hover:text-neutral-600 focus:outline-none"
      >
        <HiOutlineChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <ul role="listbox" className="absolute z-[70] top-full left-0 mt-0.5 max-h-28 w-full overflow-y-auto rounded-md border border-neutral-200 bg-white py-0.5 shadow-lg">
          {options.map((opt) => (
            <li key={opt.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={`w-full px-2 py-1 text-left text-xs hover:bg-neutral-100 ${opt.value === value ? 'bg-neutral-50 font-medium text-neutral-900' : 'text-neutral-800'}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(opt.value); setInputText(null); onClose() }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Main component of the briefing page */
export default function BriefingPage() {
  useIdentity()
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draftText, setDraftText] = useState<Record<string, string>>({})
  const [sendState, setSendState] = useState<
    Record<string, { status: 'idle' | 'sending' | 'sent' | 'error'; message?: string }>
  >({})
  const [meetingState, setMeetingState] = useState<
    Record<string, { status: 'idle' | 'adding' | 'added' | 'error'; message?: string }>
  >({})
  const [discardBusyId, setDiscardBusyId] = useState<string | null>(null)
  const [draftRows, setDraftRows] = useState<DraftListRow[]>([])
  const [meetingRows, setMeetingRows] = useState<MeetingListRow[]>([])
  const [assistantPanelDraftId, setAssistantPanelDraftId] = useState<string | null>(null)
  const [assistantInstruction, setAssistantInstruction] = useState<Record<string, string>>({})
  const [refineBusyId, setRefineBusyId] = useState<string | null>(null)
  const [refineError, setRefineError] = useState<Record<string, string>>({})
  const [confirmAddMeeting, setConfirmAddMeeting] = useState<MeetingProposal | null>(null)
  const [confirmDiscardMeeting, setConfirmDiscardMeeting] = useState<MeetingProposal | null>(null)
  const [discardMeetingBusy, setDiscardMeetingBusy] = useState(false)
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState<ReplyDraft | null>(null)
  const [confirmSendDraft, setConfirmSendDraft] = useState<ReplyDraft | null>(null)
  const [modalStartTime, setModalStartTime] = useState('09:00')
  const [modalEndTime, setModalEndTime] = useState('10:00')
  const [modalDate, setModalDate] = useState('')
  const [modalLocation, setModalLocation] = useState('')
  const [modalAttendees, setModalAttendees] = useState('')
  const [openModalTimePicker, setOpenModalTimePicker] = useState<'start' | 'end' | null>(null)
  const modalTimePickersRef = useRef<HTMLDivElement>(null)
  const draftTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({ briefing: true, meetings: true, drafts: true })
  // Per-meeting options (video call, send invite) editable in the More section
  const [meetingOptions, setMeetingOptions] = useState<Record<string, { is_video_call: boolean; send_invite: boolean }>>({})
  const [meetingMoreOpen, setMeetingMoreOpen] = useState<Record<string, boolean>>({})
  const [meetingEmailOpen, setMeetingEmailOpen] = useState<Record<string, boolean>>({})
  const [meetingReplyOpen, setMeetingReplyOpen] = useState<Record<string, boolean>>({})
  const [meetingEdits, setMeetingEdits] = useState<Record<string, MeetingProposal>>({})
  const [openCardTimePicker, setOpenCardTimePicker] = useState<string | null>(null)
  const [runningAutomation, setRunningAutomation] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const cardTimePickerRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const autoResizeDraftTextarea = useCallback((draftId: string) => {
    const el = draftTextareaRefs.current[draftId]
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  const loadBriefing = useCallback((cancelled: { v: boolean }) => {
    fetch('/api/automation/briefing')
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((d: BriefingData) => {
        if (cancelled.v) return
        const drafts = Array.isArray(d.drafts) ? d.drafts : []
        const meetings = normalizeMeetings(d.meetings)
        setData({ ...d, drafts, meetings })
        setDraftRows(drafts.map((x) => ({ kind: 'draft', draft: x })))
        setMeetingRows(meetings.map((m) => ({ kind: 'meeting', meeting: m })))
        const opts: Record<string, { is_video_call: boolean; send_invite: boolean }> = {}
        for (const m of meetings) {
          const id = m.meeting_id?.trim()
          if (id) opts[id] = { is_video_call: m.is_video_call ?? false, send_invite: m.send_invite ?? true }
        }
        setMeetingOptions(opts)
        const editMap: Record<string, MeetingProposal> = {}
        for (const m of meetings) {
          const id = m.meeting_id?.trim()
          if (id) editMap[id] = {
            ...m,
            start_time: m.start_time ? snapTimeToNearestSlot(m.start_time) : m.start_time,
            end_time: m.end_time ? snapTimeToNearestSlot(m.end_time) : m.end_time,
            send_invite: m.send_invite ?? true,
          }
        }
        setMeetingEdits(editMap)
        const initial: Record<string, string> = {}
        for (const x of drafts) {
          initial[x.draftId] = x.draftBody
        }
        setDraftText(initial)
        setSendState({})
        setMeetingState({})
        setAssistantPanelDraftId(null)
        setAssistantInstruction({})
        setRefineBusyId(null)
        setRefineError({})
      })
      .catch((e) => {
        if (!cancelled.v) setError(e.message || 'Failed to load briefing')
      })
      .finally(() => {
        if (!cancelled.v) setLoading(false)
      })
  }, [])

  useEffect(() => {
    const cancelled = { v: false }
    loadBriefing(cancelled)
    return () => { cancelled.v = true }
  }, [loadBriefing])

  const runAutomation = useCallback(async () => {
    setRunningAutomation(true)
    setRefreshError(null)
    try {
      const res = await fetch('/api/automation/run', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Automation failed')
      setLoading(true)
      const cancelled = { v: false }
      loadBriefing(cancelled)
    } catch (e) {
      setRefreshError((e as Error).message || 'Refresh failed')
    } finally {
      setRunningAutomation(false)
    }
  }, [loadBriefing])

  const briefingSections = useMemo(
    () => (data ? briefingSectionsForDisplay(data) : []),
    [data]
  )

  const priorityCounts = useMemo(
    () => priorityEmailCountsFromSections(briefingSections),
    [briefingSections]
  )

  const draftEntities = useMemo(
    () =>
      draftRows
        .filter((r): r is { kind: 'draft'; draft: ReplyDraft } => r.kind === 'draft')
        .map((r) => r.draft),
    [draftRows]
  )

  // messageIds claimed by meeting proposals — excluded from the reply drafts section
  const meetingLinkedMessageIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of meetingRows) {
      if (row.kind === 'meeting' && row.meeting.messageId) ids.add(row.meeting.messageId)
    }
    return ids
  }, [meetingRows])

  useEffect(() => {
    for (const d of draftEntities) {
      autoResizeDraftTextarea(d.draftId)
    }
  }, [draftEntities, draftText, autoResizeDraftTextarea])

  const sendReply = useCallback(
    async (draft: ReplyDraft) => {
      const body = draftText[draft.draftId] ?? draft.draftBody
      setSendState((s) => ({ ...s, [draft.draftId]: { status: 'sending' } }))
      try {
        const res = await fetch('/api/automation/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: draft.messageId, body, draftId: draft.draftId }),
        })
        const json = (await res.json()) as { ok?: boolean; error?: string; message?: string }
        if (!res.ok || json.ok !== true) {
          setSendState((s) => ({ ...s, [draft.draftId]: { status: 'error', message: json.error || res.statusText || 'Send failed' } }))
          return
        }
        setSendState((s) => ({ ...s, [draft.draftId]: { status: 'sent', message: json.message } }))
      } catch (e) {
        setSendState((s) => ({ ...s, [draft.draftId]: { status: 'error', message: e instanceof Error ? e.message : 'Network error' } }))
      }
    },
    [draftText]
  )

  const addMeetingToCalendar = useCallback(async (m: MeetingProposal) => {
    const id = m.meeting_id ?? ''
    if (!id) {
      window.alert('This meeting has no id; refresh the briefing and try again.')
      return
    }
    if (!m.date || !m.start_time) {
      window.alert('Add a date and start time before adding to the calendar.')
      return
    }
    setMeetingState((s) => ({ ...s, [id]: { status: 'adding' } }))
    try {
      const res = await fetch('/api/automation/schedule-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: id, meeting: m }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: string }
      if (!res.ok || !json.ok) {
        setMeetingState((s) => ({ ...s, [id]: { status: 'error', message: json.error || res.statusText || 'Could not add to calendar' } }))
        return
      }
      setMeetingState((s) => ({ ...s, [id]: { status: 'added', message: 'Added to calendar.' } }))
    } catch (e) {
      setMeetingState((s) => ({ ...s, [id]: { status: 'error', message: e instanceof Error ? e.message : 'Network error' } }))
    }
  }, [])

  useEffect(() => {
    if (!confirmAddMeeting) return
    const { start, end } = defaultModalTimes(confirmAddMeeting)
    setModalStartTime(start)
    setModalEndTime(end)
    setModalDate(confirmAddMeeting.date ?? '')
    setModalLocation(confirmAddMeeting.location ?? '')
    setModalAttendees(confirmAddMeeting.attendees ?? '')
  }, [confirmAddMeeting])

  useEffect(() => {
    if (!confirmAddMeeting) setOpenModalTimePicker(null)
  }, [confirmAddMeeting])

  const closeModalTimePicker = useCallback(() => setOpenModalTimePicker(null), [])
  const closeCardTimePicker = useCallback(() => setOpenCardTimePicker(null), [])

  useEffect(() => {
    if (!openCardTimePicker) return
    const mid = openCardTimePicker.split('-')[0]
    const onDocMouseDown = (e: MouseEvent) => {
      const el = cardTimePickerRefs.current[mid]
      if (!el?.contains(e.target as Node)) closeCardTimePicker()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [openCardTimePicker, closeCardTimePicker])

  const updateMeetingEdit = useCallback((mid: string, field: keyof MeetingProposal, value: string | boolean | undefined) => {
    setMeetingEdits((prev) => ({ ...prev, [mid]: { ...(prev[mid] ?? {}), [field]: value } }))
  }, [])

  useEffect(() => {
    if (!openModalTimePicker) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (!modalTimePickersRef.current?.contains(e.target as Node)) closeModalTimePicker()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [openModalTimePicker, closeModalTimePicker])

  const modalTimesInvalid =
    Boolean(confirmAddMeeting) && timeToMinutes(modalEndTime) <= timeToMinutes(modalStartTime)

  const handleConfirmAddMeeting = useCallback(() => {
    if (!confirmAddMeeting) return
    if (modalTimesInvalid) return
    const mid = confirmAddMeeting.meeting_id?.trim() ?? ''
    const opts = meetingOptions[mid] ?? {}
    const incomplete = meetingTimesIncomplete(confirmAddMeeting)
    const m: MeetingProposal = {
      ...confirmAddMeeting,
      is_video_call: opts.is_video_call ?? confirmAddMeeting.is_video_call ?? false,
      send_invite: opts.send_invite ?? confirmAddMeeting.send_invite ?? true,
      date: modalDate.trim() || confirmAddMeeting.date,
      start_time: modalStartTime,
      end_time: modalEndTime,
      location: modalLocation.trim() || undefined,
      attendees: modalAttendees.trim() || undefined,
    }
    setConfirmAddMeeting(null)
    void addMeetingToCalendar(m)
  }, [confirmAddMeeting, modalStartTime, modalEndTime, modalDate, modalTimesInvalid, meetingOptions, modalLocation, modalAttendees, addMeetingToCalendar])

  const refineDraftWithAssistant = useCallback(
    async (draft: ReplyDraft) => {
      const instruction = (assistantInstruction[draft.draftId] ?? '').trim()
      if (!instruction) {
        setRefineError((e) => ({ ...e, [draft.draftId]: 'Describe how you want the reply changed.' }))
        return
      }
      const currentDraft = draftText[draft.draftId] ?? draft.draftBody
      setRefineBusyId(draft.draftId)
      setRefineError((e) => { const next = { ...e }; delete next[draft.draftId]; return next })
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
        const json = (await res.json()) as { ok?: boolean; draftBody?: string; error?: string }
        if (!res.ok || !json.ok || !json.draftBody) {
          setRefineError((e) => ({ ...e, [draft.draftId]: json.error || res.statusText || 'Could not update draft' }))
          return
        }
        setDraftText((prev) => ({ ...prev, [draft.draftId]: json.draftBody! }))
        setData((prev) =>
          prev ? { ...prev, drafts: (prev.drafts ?? []).map((x) => x.draftId === draft.draftId ? { ...x, draftBody: json.draftBody! } : x) } : null
        )
        setDraftRows((rs) =>
          rs.map((r) => r.kind === 'draft' && r.draft.draftId === draft.draftId ? { ...r, draft: { ...r.draft, draftBody: json.draftBody! } } : r)
        )
        setAssistantInstruction((prev) => ({ ...prev, [draft.draftId]: '' }))
        setAssistantPanelDraftId(null)
      } catch (e) {
        setRefineError((err) => ({ ...err, [draft.draftId]: e instanceof Error ? e.message : 'Network error' }))
      } finally {
        setRefineBusyId(null)
      }
    },
    [assistantInstruction, draftText]
  )

  const performDiscardDraft = useCallback(async () => {
    const draft = confirmDiscardDraft
    if (!draft) return
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
        rs.map((r) => r.kind === 'draft' && r.draft.draftId === draft.draftId ? { kind: 'deleted', draftId: draft.draftId, subject: draft.subject } : r)
      )
      setData((prev) => prev ? { ...prev, drafts: (prev.drafts ?? []).filter((x) => x.draftId !== draft.draftId) } : null)
      setDraftText((prev) => { const next = { ...prev }; delete next[draft.draftId]; return next })
      setSendState((prev) => { const next = { ...prev }; delete next[draft.draftId]; return next })
      setConfirmDiscardDraft(null)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Network error')
    } finally {
      setDiscardBusyId(null)
    }
  }, [confirmDiscardDraft])

  const handleConfirmSendDraft = useCallback(() => {
    if (!confirmSendDraft) return
    const d = confirmSendDraft
    setConfirmSendDraft(null)
    void sendReply(d)
  }, [confirmSendDraft, sendReply])

  const performDiscardMeeting = useCallback(async () => {
    const id = confirmDiscardMeeting?.meeting_id?.trim() ?? ''
    if (!id) return
    setDiscardMeetingBusy(true)
    try {
      const res = await fetch('/api/automation/discard-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: id }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        window.alert(json.error || 'Could not remove meeting from list. The meeting will still not be added to calendar.')
        return
      }
      setData((prev) =>
        prev ? { ...prev, meetings: (prev.meetings ?? []).filter((m) => m.meeting_id !== id) } : null
      )
      setMeetingRows((rs) =>
        rs.map((r) =>
          r.kind === 'meeting' && r.meeting.meeting_id === id
            ? { kind: 'removed', meetingId: id, title: r.meeting.title ?? 'Event' }
            : r
        )
      )
      setConfirmDiscardMeeting(null)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Network error')
    } finally {
      setDiscardMeetingBusy(false)
    }
  }, [confirmDiscardMeeting])

  const scanFrom = formatTs(data?.scanSince)
  const scanTo = formatTs(data?.scanUntil)

  return (
    <ChatLayout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Your Assistant</h1>
          <p className="text-sm text-neutral-500 mb-6">
            Scanning your inbox daily to find proposed meetings, generate reply drafts and prioritise emails.
          </p>
          {refreshError && (
            <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {refreshError}
            </div>
          )}
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
                  <p className="flex items-center gap-1.5">
                    <span>Last inbox scan: {scanFrom} → {scanTo}</span>
                    <button
                      type="button"
                      onClick={runAutomation}
                      disabled={runningAutomation}
                      className="p-0.5 rounded text-neutral-400 hover:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title={runningAutomation ? 'Running automation…' : 'Run automation and refresh'}
                      aria-label={runningAutomation ? 'Running automation' : 'Run automation and refresh'}
                    >
                      <HiOutlineRefresh className={`w-3.5 h-3.5 ${runningAutomation ? 'animate-spin' : ''}`} />
                    </button>
                  </p>
                )}
              </div>

              {/* Summary stats */}
              <div className="flex gap-3 mb-6">
                <div className={`flex-1 p-3 rounded-xl border ${priorityCounts.high === 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                  <p className={`text-xs mb-0.5 ${priorityCounts.high === 0 ? 'text-green-600' : 'text-red-600'}`}>High priority emails</p>
                  <p className={`text-lg font-bold ${priorityCounts.high === 0 ? 'text-green-800' : 'text-red-800'}`}>{priorityCounts.high}</p>
                </div>
                <div className="flex-1 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <p className="text-xs text-neutral-400 mb-0.5">Proposed meetings found</p>
                  <p className="text-lg font-bold text-neutral-900">{(data.meetings ?? []).length}</p>
                </div>
                <div className="flex-1 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <p className="text-xs text-neutral-400 mb-0.5">Reply drafts generated</p>
                  <p className="text-lg font-bold text-neutral-900">{draftRows.length}</p>
                </div>
              </div>

              {/* Briefing section */}
              {briefingSections.some((s) => s.title || s.body) ? (
                <section className="mb-8">
                  <button
                    type="button"
                    onClick={() => setSectionsOpen((p) => ({ ...p, briefing: !p.briefing }))}
                    className="flex items-center gap-2 mb-3 w-full text-left group"
                  >
                    <span className="text-lg" aria-hidden>📋</span>
                    <h2 className="text-lg font-semibold text-neutral-900 flex-1">Briefing</h2>
                    <HiOutlineChevronDown className={`w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-transform ${sectionsOpen.briefing ? '' : '-rotate-90'}`} aria-hidden />
                  </button>
                  {sectionsOpen.briefing && (
                    <>
                      {(() => {
                        const summarySec = briefingSections.find((s) => isSummaryBriefingSectionTitle(s.title ?? ''))
                        const summaryBody = summarySec?.body?.trim()
                        if (!summaryBody) return null
                        return (
                          <div className="text-xs text-neutral-400 mb-4 space-y-0.5">
                            <p className="m-0 leading-relaxed whitespace-pre-line">{summaryBody}</p>
                          </div>
                        )
                      })()}
                      <div className={`rounded-2xl border bg-white p-6 space-y-0 divide-y divide-neutral-100 shadow-sm ${MEETINGS_LIST_BORDER}`}>
                        {briefingSections
                          .filter((sec) => !isSummaryBriefingSectionTitle(sec.title ?? ''))
                          .map((sec, i) => (
                            <div key={i} className="pt-5 first:pt-0 pb-5 last:pb-0">
                              {sec.title ? (
                                <h3 className="flex items-start gap-2 text-base font-semibold text-neutral-900 mb-2.5 tracking-tight">
                                  {(() => {
                                    const p = briefingSectionTitlePriority(sec.title)
                                    if (p === 'high') return <HiOutlineExclamationCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" aria-hidden />
                                    if (p === 'medium') return <HiOutlineQuestionMarkCircle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" aria-hidden />
                                    if (p === 'low') return <HiOutlineMinusCircle className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" aria-hidden />
                                    return null
                                  })()}
                                  <span className="min-w-0">{sec.title}</span>
                                </h3>
                              ) : null}
                              {sec.body ? <BriefingSectionBody markdown={sec.body} /> : null}
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </section>
              ) : (
                !draftRows.length && (
                  <p className="text-neutral-500 mb-8">
                    No briefing content yet. Run automation once (with a linked inbox) to populate.
                  </p>
                )
              )}

              {/* Proposed meetings section */}
              <section className="mb-8">
                <button
                  type="button"
                  onClick={() => setSectionsOpen((p) => ({ ...p, meetings: !p.meetings }))}
                  className="flex items-center gap-2 mb-3 w-full text-left group"
                >
                  <span className="text-lg" aria-hidden>📅</span>
                  <h2 className="text-lg font-semibold text-neutral-900 flex-1">Proposed Meetings</h2>
                  <HiOutlineChevronDown className={`w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-transform ${sectionsOpen.meetings ? '' : '-rotate-90'}`} aria-hidden />
                </button>
                {sectionsOpen.meetings && meetingRows.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {meetingRows.map((row, i) => {
                      if (row.kind === 'removed') {
                        return (
                          <div key={row.meetingId} className="rounded-2xl border p-4 shadow-sm border-red-200 bg-red-50">
                            <p className="text-xs text-red-700 mb-1">Proposal deleted</p>
                            <p className="text-sm font-medium text-red-900">{row.title}</p>
                          </div>
                        )
                      }
                      const m = row.meeting
                      const mid = m.meeting_id?.trim() ?? ''
                      const meetSt = meetingState[mid]?.status ?? 'idle'
                      const meetMsg = meetingState[mid]?.message
                      const rowKey = mid || `meeting-${i}`

                      if (meetSt === 'added') {
                        return (
                          <div key={rowKey} className="rounded-2xl border p-4 shadow-sm border-green-200 bg-green-50">
                            <p className="text-xs text-green-700 mb-1">Added to calendar</p>
                            <p className="text-sm font-medium text-green-900">{m.title ?? 'Event'}</p>
                          </div>
                        )
                      }

                      const editedMeeting = meetingEdits[mid] ?? m
                      const emailOpen = meetingEmailOpen[mid] ?? false
                      const replyOpen = meetingReplyOpen[mid] ?? false
                      const linkedDraft = draftEntities.find((d) => d.messageId === m.messageId) ?? null
                      const replySt = linkedDraft ? (sendState[linkedDraft.draftId]?.status ?? 'idle') : 'idle'
                      const replyErrMsg = linkedDraft ? sendState[linkedDraft.draftId]?.message : undefined
                      const canAdd = Boolean(editedMeeting.date && mid)

                      return (
                        <div
                          key={rowKey}
                          className={`group relative rounded-2xl border ${MEETINGS_LIST_BORDER} bg-white px-4 py-3 hover:bg-neutral-50 transition-all`}
                        >
                          {/* Delete meeting button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (!mid) { window.alert('This meeting has no id; refresh the briefing and try again.'); return }
                              setConfirmDiscardMeeting(m)
                            }}
                            className="absolute top-3 right-3 p-1 text-neutral-400 hover:text-neutral-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Delete meeting"
                            title="Delete meeting"
                          >
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>

                          <div className="flex items-start gap-4 pr-6">
                            {/* Left: editable meeting details */}
                            <div className="flex-1 min-w-0 space-y-2">
                              {/* Editable title */}
                              <input
                                type="text"
                                value={editedMeeting.title ?? ''}
                                onChange={(e) => updateMeetingEdit(mid, 'title', e.target.value)}
                                placeholder="Event name"
                                className="text-sm font-semibold text-neutral-900 w-full bg-transparent border-0 border-b border-transparent hover:border-neutral-200 focus:border-neutral-400 focus:outline-none px-0 py-0.5 placeholder:text-neutral-300"
                              />

                              <div className="space-y-1.5">
                                {/* Editable date */}
                                <div className="flex items-center gap-1.5">
                                  <HiOutlineCalendar className="w-3.5 h-3.5 shrink-0 text-neutral-400" aria-hidden />
                                  <input
                                    type="text"
                                    value={editedMeeting.date ?? ''}
                                    onChange={(e) => updateMeetingEdit(mid, 'date', e.target.value)}
                                    placeholder="Add date"
                                    className="text-xs text-neutral-600 bg-transparent border-0 border-b border-transparent hover:border-neutral-200 focus:border-neutral-400 focus:outline-none px-0 py-0 w-40 placeholder:text-neutral-300"
                                  />
                                </div>

                                {/* Editable start/end time */}
                                <div
                                  className="flex items-center gap-1.5"
                                  ref={(el) => { cardTimePickerRefs.current[mid] = el }}
                                >
                                  <HiOutlineClock className="w-3.5 h-3.5 shrink-0 text-neutral-400" aria-hidden />
                                  <div className="flex items-center gap-1">
                                    <div className="w-24">
                                      <CompactTimeSelect
                                        id={`card-start-${mid}`}
                                        labelId={`card-start-label-${mid}`}
                                        value={editedMeeting.start_time ?? '09:00'}
                                        options={CALENDAR_TIME_OPTIONS}
                                        open={openCardTimePicker === `${mid}-start`}
                                        onToggle={() => setOpenCardTimePicker((p) => p === `${mid}-start` ? null : `${mid}-start`)}
                                        onClose={closeCardTimePicker}
                                        onChange={(v) => {
                                          updateMeetingEdit(mid, 'start_time', v)
                                          const et = editedMeeting.end_time ?? ''
                                          if (!et || timeToMinutes(et) <= timeToMinutes(v)) {
                                            updateMeetingEdit(mid, 'end_time', snapTimeToNearestSlot(addOneHourToTime(v)))
                                          }
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-neutral-400">–</span>
                                    <div className="w-24">
                                      <CompactTimeSelect
                                        id={`card-end-${mid}`}
                                        labelId={`card-end-label-${mid}`}
                                        value={editedMeeting.end_time ?? snapTimeToNearestSlot(addOneHourToTime(editedMeeting.start_time ?? '09:00'))}
                                        options={CALENDAR_TIME_OPTIONS}
                                        open={openCardTimePicker === `${mid}-end`}
                                        onToggle={() => setOpenCardTimePicker((p) => p === `${mid}-end` ? null : `${mid}-end`)}
                                        onClose={closeCardTimePicker}
                                        onChange={(v) => updateMeetingEdit(mid, 'end_time', v)}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Attendees (read-only) */}
                                {editedMeeting.attendees && (
                                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 min-w-0">
                                    <HiOutlineUsers className="w-3.5 h-3.5 shrink-0 opacity-90" aria-hidden />
                                    <span className="truncate">{editedMeeting.attendees}</span>
                                  </div>
                                )}
                              </div>

                              {/* View email / draft reply */}
                              <div className="pt-0.5 space-y-2">
                                <div className="flex flex-wrap gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setMeetingEmailOpen((p) => ({ ...p, [mid]: !p[mid] }))}
                                    className="text-xs text-neutral-500 hover:text-neutral-700 underline underline-offset-2"
                                  >
                                    {emailOpen ? 'Hide original email' : 'View original email'}
                                  </button>
                                  {linkedDraft && replySt !== 'sent' && (
                                    <button
                                      type="button"
                                      onClick={() => setMeetingReplyOpen((p) => ({ ...p, [mid]: !p[mid] }))}
                                      className="text-xs text-neutral-500 hover:text-neutral-700 underline underline-offset-2"
                                    >
                                      {replyOpen ? 'Hide reply draft' : 'Draft a reply'}
                                    </button>
                                  )}
                                </div>

                                {emailOpen && (
                                  <div className="max-h-48 overflow-y-auto rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
                                    <pre className="whitespace-pre-wrap font-sans text-xs text-neutral-800 leading-relaxed m-0">
                                      {(linkedDraft?.originalEmail ?? editedMeeting.originalEmail)?.trim() || '(No email body available)'}
                                    </pre>
                                  </div>
                                )}

                                {linkedDraft && replyOpen && (
                                  <div className="space-y-2">
                                    {replySt === 'sent' ? (
                                      <p className="text-sm text-green-800">Reply sent successfully.</p>
                                    ) : (
                                      <>
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="flex items-center gap-2">
                                            <p className="text-xs font-medium text-neutral-600 m-0">Your reply</p>
                                            <HiOutlinePencil className="w-3.5 h-3.5 text-neutral-400 shrink-0" aria-hidden />
                                          </div>
                                          <button
                                            type="button"
                                            className="text-xs font-medium text-neutral-700 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none"
                                            disabled={replySt === 'sending' || refineBusyId === linkedDraft.draftId}
                                            onClick={() => setAssistantPanelDraftId((id) => id === linkedDraft.draftId ? null : linkedDraft.draftId)}
                                          >
                                            {assistantPanelDraftId === linkedDraft.draftId ? 'Hide assistant' : 'Edit with assistant'}
                                          </button>
                                        </div>
                                        {assistantPanelDraftId === linkedDraft.draftId && (
                                          <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 space-y-2">
                                            <label htmlFor={`assist-meeting-${mid}`} className="text-xs font-medium text-neutral-600 block">
                                              Tell the assistant how to change this reply
                                            </label>
                                            <textarea
                                              id={`assist-meeting-${mid}`}
                                              rows={2}
                                              className="w-full resize-y rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                                              placeholder="e.g. Shorter, more formal, mention Friday deadline"
                                              value={assistantInstruction[linkedDraft.draftId] ?? ''}
                                              onChange={(e) => setAssistantInstruction((prev) => ({ ...prev, [linkedDraft.draftId]: e.target.value }))}
                                              disabled={refineBusyId === linkedDraft.draftId}
                                            />
                                            <div className="flex flex-wrap items-center gap-2">
                                              <button
                                                type="button"
                                                className="text-xs font-medium text-neutral-800 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-100 hover:border-neutral-400 transition-all disabled:opacity-50 disabled:pointer-events-none"
                                                disabled={refineBusyId === linkedDraft.draftId}
                                                onClick={() => void refineDraftWithAssistant(linkedDraft)}
                                              >
                                                {refineBusyId === linkedDraft.draftId ? 'Updating…' : 'Apply to draft'}
                                              </button>
                                              {refineError[linkedDraft.draftId] && (
                                                <span className="text-xs text-red-600">{refineError[linkedDraft.draftId]}</span>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                        <textarea
                                          ref={(el) => {
                                            draftTextareaRefs.current[linkedDraft.draftId] = el
                                            if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
                                          }}
                                          className="w-full resize-none overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5 font-sans text-xs text-neutral-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-60"
                                          value={draftText[linkedDraft.draftId] ?? linkedDraft.draftBody}
                                          onChange={(e) => {
                                            setDraftText((prev) => ({ ...prev, [linkedDraft.draftId]: e.target.value }))
                                            autoResizeDraftTextarea(linkedDraft.draftId)
                                          }}
                                          disabled={replySt === 'sending'}
                                        />
                                        <div className="flex flex-wrap items-center gap-2">
                                          <button
                                            type="button"
                                            className={`inline-flex items-center justify-center gap-1.5 rounded-xl text-sm px-4 py-2 ${BRIEFING_GREEN_OUTLINE_BTN}`}
                                            disabled={replySt === 'sending'}
                                            onClick={() => void sendReply(linkedDraft)}
                                          >
                                            {replySt === 'sending' ? 'Sending…' : 'Send reply'}
                                            <HiOutlineReply className="w-4 h-4 shrink-0 opacity-90" aria-hidden />
                                          </button>
                                          {replySt === 'error' && (
                                            <span className="text-sm text-red-600">{replyErrMsg}</span>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right: Add to calendar button */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <button
                                type="button"
                                aria-label={meetSt === 'adding' ? 'Adding to calendar' : `Add to calendar: ${editedMeeting.title ?? 'Event'}`}
                                className={`text-xs px-2.5 py-1.5 rounded-lg ${BRIEFING_GREEN_OUTLINE_BTN}`}
                                disabled={!canAdd || meetSt === 'adding'}
                                onClick={() => {
                                  const { start, end } = defaultModalTimes(editedMeeting)
                                  setConfirmAddMeeting({ ...editedMeeting, start_time: start, end_time: end })
                                }}
                              >
                                {meetSt === 'adding' ? 'Adding…' : 'Add to calendar'}
                              </button>
                              {meetSt === 'error' && (
                                <span className="text-xs text-red-600 text-right max-w-[12rem]">{meetMsg}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : sectionsOpen.meetings ? (
                  <p className="text-neutral-500">No meetings to schedule.</p>
                ) : null}
              </section>

              {/* Reply drafts section */}
              <section className="mb-8">
                <button
                  type="button"
                  onClick={() => setSectionsOpen((p) => ({ ...p, drafts: !p.drafts }))}
                  className="flex items-center gap-2 mb-3 w-full text-left group"
                >
                  <span className="text-lg" aria-hidden>✉️</span>
                  <h2 className="text-lg font-semibold text-neutral-900 flex-1">Reply drafts</h2>
                  <HiOutlineChevronDown className={`w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-transform ${sectionsOpen.drafts ? '' : '-rotate-90'}`} aria-hidden />
                </button>
                {sectionsOpen.drafts && draftRows.filter((row) => row.kind !== 'draft' || !meetingLinkedMessageIds.has(row.draft.messageId)).length > 0 ? (
                  <ul className="flex flex-col gap-4">
                    {draftRows.filter((row) => row.kind !== 'draft' || !meetingLinkedMessageIds.has(row.draft.messageId)).map((row) => {
                      if (row.kind === 'deleted') {
                        return (
                          <li key={row.draftId} className="rounded-2xl border p-4 shadow-sm border-red-200 bg-red-50">
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
                          className={`group relative rounded-2xl border p-4 shadow-sm ${st === 'sent' ? 'border-green-200 bg-green-50' : 'border-neutral-200 bg-white'}`}
                        >
                          {st === 'sent' ? (
                            <>
                              <p className="text-sm font-medium text-green-900">{d.subject}</p>
                              <p className="text-sm text-green-800 mt-1">Reply sent successfully.</p>
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
                                  onClick={() => setConfirmDiscardDraft(d)}
                                  disabled={st === 'sending' || discardBusyId === d.draftId}
                                  className="shrink-0 p-1 text-neutral-400 hover:text-neutral-600 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:pointer-events-none"
                                  aria-label="Discard draft"
                                  title="Discard draft"
                                >
                                  <HiOutlineTrash className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="mb-4">
                                <p className="text-xs font-medium text-neutral-600 mb-1">Body</p>
                                <div className="max-h-64 overflow-y-auto rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
                                  <pre className="whitespace-pre-wrap font-sans text-xs text-neutral-800 leading-relaxed m-0">
                                    {d.originalEmail?.trim() || '(Message body was not stored — re-run automation for this draft.)'}
                                  </pre>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-medium text-neutral-600 m-0">Your reply</p>
                                  <HiOutlinePencil className="w-3.5 h-3.5 text-neutral-400 shrink-0" aria-hidden />
                                </div>
                                <button
                                  type="button"
                                  className="text-xs font-medium text-neutral-700 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none"
                                  disabled={st === 'sending' || refineBusyId === d.draftId}
                                  onClick={() => setAssistantPanelDraftId((id) => id === d.draftId ? null : d.draftId)}
                                >
                                  {assistantPanelDraftId === d.draftId ? 'Hide assistant' : 'Edit with assistant'}
                                </button>
                              </div>
                              {assistantPanelDraftId === d.draftId && (
                                <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 space-y-2">
                                  <label htmlFor={`assist-${d.draftId}`} className="text-xs font-medium text-neutral-600 block">
                                    Tell the assistant how to change this reply
                                  </label>
                                  <textarea
                                    id={`assist-${d.draftId}`}
                                    rows={2}
                                    className="w-full resize-y rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                                    placeholder="e.g. Shorter, more formal, mention Friday deadline"
                                    value={assistantInstruction[d.draftId] ?? ''}
                                    onChange={(e) => setAssistantInstruction((prev) => ({ ...prev, [d.draftId]: e.target.value }))}
                                    disabled={refineBusyId === d.draftId}
                                  />
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      className="text-xs font-medium text-neutral-800 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-100 hover:border-neutral-400 transition-all disabled:opacity-50 disabled:pointer-events-none"
                                      disabled={refineBusyId === d.draftId}
                                      onClick={() => void refineDraftWithAssistant(d)}
                                    >
                                      {refineBusyId === d.draftId ? 'Updating…' : 'Apply to draft'}
                                    </button>
                                    {refineError[d.draftId] && (
                                      <span className="text-xs text-red-600">{refineError[d.draftId]}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                              <label htmlFor={`draft-${d.draftId}`} className="sr-only">Reply body</label>
                              <textarea
                                id={`draft-${d.draftId}`}
                                ref={(el) => {
                                  draftTextareaRefs.current[d.draftId] = el
                                  if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
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
                                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl text-sm px-4 py-2 ${BRIEFING_GREEN_OUTLINE_BTN}`}
                                  disabled={st === 'sending'}
                                  onClick={() => setConfirmSendDraft(d)}
                                >
                                  {st === 'sending' ? 'Sending…' : 'Send reply'}
                                  <HiOutlineReply className="w-4 h-4 shrink-0 opacity-90" aria-hidden />
                                </button>
                                {st === 'error' && <span className="text-sm text-red-600">{errMsg}</span>}
                              </div>
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : sectionsOpen.drafts ? (
                  <p className="text-neutral-500">No reply drafts yet.</p>
                ) : null}
              </section>
            </>
          )}
        </div>
      </div>

      {/* Add meeting modal */}
      {confirmAddMeeting && (
        <div
          className="fixed inset-0 bg-neutral-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmAddMeeting(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-add-meeting-title"
            className="bg-white rounded-2xl border border-neutral-100 shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-add-meeting-title" className="text-lg font-bold text-neutral-900 mb-1">
              Add &quot;{confirmAddMeeting.title ?? 'Event'}&quot; to your calendar?
            </h3>
            <p className="text-sm text-neutral-500 mb-2">
              This will create a calendar event with the following details:
            </p>
            <div className="mb-4 space-y-2.5">
              <div>
                <label className="block text-xs text-neutral-500 mb-0.5">Date</label>
                <input
                  type="text"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  placeholder="Add date"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300 placeholder:text-neutral-300"
                />
              </div>
              <div ref={modalTimePickersRef} className="grid grid-cols-2 gap-2">
                <div>
                  <label id="modal-meeting-start-label" htmlFor="modal-meeting-start" className="block text-xs text-neutral-500 mb-0.5">
                    Start time
                  </label>
                  <CompactTimeSelect
                    id="modal-meeting-start"
                    labelId="modal-meeting-start-label"
                    value={modalStartTime}
                    options={CALENDAR_TIME_OPTIONS}
                    open={openModalTimePicker === 'start'}
                    onToggle={() => setOpenModalTimePicker((p) => (p === 'start' ? null : 'start'))}
                    onClose={closeModalTimePicker}
                    onChange={(next) => {
                      setModalStartTime(next)
                      if (timeToMinutes(modalEndTime) <= timeToMinutes(next)) {
                        setModalEndTime(snapTimeToNearestSlot(addOneHourToTime(next)))
                      }
                    }}
                  />
                </div>
                <div>
                  <label id="modal-meeting-end-label" htmlFor="modal-meeting-end" className="block text-xs text-neutral-500 mb-0.5">
                    End time
                  </label>
                  <CompactTimeSelect
                    id="modal-meeting-end"
                    labelId="modal-meeting-end-label"
                    value={modalEndTime}
                    options={CALENDAR_TIME_OPTIONS}
                    open={openModalTimePicker === 'end'}
                    onToggle={() => setOpenModalTimePicker((p) => (p === 'end' ? null : 'end'))}
                    onClose={closeModalTimePicker}
                    onChange={(v) => setModalEndTime(v)}
                  />
                </div>
              </div>
              {modalTimesInvalid && (
                <p className="text-xs text-red-600">End time must be after start time.</p>
              )}
              <div>
                <label className="block text-xs text-neutral-500 mb-0.5">Location</label>
                <input
                  type="text"
                  value={modalLocation}
                  onChange={(e) => setModalLocation(e.target.value)}
                  placeholder="Add location (optional)"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300 placeholder:text-neutral-300"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-0.5">Attendees</label>
                <input
                  type="text"
                  value={modalAttendees}
                  onChange={(e) => setModalAttendees(e.target.value)}
                  placeholder="Add attendees (optional)"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300 placeholder:text-neutral-300"
                />
              </div>
              {(() => {
                const mid = confirmAddMeeting.meeting_id?.trim() ?? ''
                const opts = meetingOptions[mid] ?? { is_video_call: confirmAddMeeting.is_video_call ?? false, send_invite: confirmAddMeeting.send_invite ?? true }
                return (
                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={opts.is_video_call}
                        onChange={(e) => setMeetingOptions((p) => ({ ...p, [mid]: { ...opts, is_video_call: e.target.checked } }))}
                        className="rounded border-neutral-300 text-neutral-600 focus:ring-neutral-300 w-3.5 h-3.5"
                      />
                      <HiOutlineVideoCamera className="w-4 h-4 shrink-0 text-neutral-500" aria-hidden />
                      Video call
                    </label>
                    <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={opts.send_invite}
                        onChange={(e) => setMeetingOptions((p) => ({ ...p, [mid]: { ...opts, send_invite: e.target.checked } }))}
                        className="rounded border-neutral-300 text-neutral-600 focus:ring-neutral-300 w-3.5 h-3.5"
                      />
                      <HiOutlineReply className="w-4 h-4 shrink-0 text-neutral-500" aria-hidden />
                      Send calendar invite to attendees
                    </label>
                  </div>
                )
              })()}
            </div>
            <p className="text-xs text-neutral-400 mb-4">
              You can edit or remove the event later in your calendar app.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmAddMeeting(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 border border-neutral-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                aria-label="Confirm add to calendar"
                disabled={modalTimesInvalid}
                onClick={handleConfirmAddMeeting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                Add to calendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove meeting modal */}
      {confirmDiscardMeeting && (
        <div
          className="fixed inset-0 bg-neutral-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { if (!discardMeetingBusy) setConfirmDiscardMeeting(null) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-discard-meeting-title"
            className="bg-white rounded-2xl border border-neutral-100 shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-discard-meeting-title" className="text-lg font-bold text-neutral-900 mb-1">
              Remove &quot;{confirmDiscardMeeting.title ?? 'Event'}&quot; from proposed meetings?
            </h3>
            <p className="text-sm text-neutral-500 mb-2">
              This removes the proposal from your briefing. It does not change your calendar.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDiscardMeeting(null)}
                disabled={discardMeetingBusy}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 border border-neutral-200 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancel
              </button>
              <button
                type="button"
                aria-label="Confirm remove proposed meeting"
                disabled={discardMeetingBusy}
                onClick={() => void performDiscardMeeting()}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {discardMeetingBusy ? 'Removing…' : 'Remove proposal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard draft modal */}
      {confirmDiscardDraft && (
        <div
          className="fixed inset-0 bg-neutral-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { if (discardBusyId !== confirmDiscardDraft.draftId) setConfirmDiscardDraft(null) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-discard-draft-title"
            className="bg-white rounded-2xl border border-neutral-100 shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-discard-draft-title" className="text-lg font-bold text-neutral-900 mb-1">
              Discard this reply draft?
            </h3>
            <p className="text-sm text-neutral-500 mb-2">
              This removes the draft from your briefing. It will not be sent.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDiscardDraft(null)}
                disabled={discardBusyId === confirmDiscardDraft.draftId}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 border border-neutral-200 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancel
              </button>
              <button
                type="button"
                aria-label="Confirm discard draft"
                disabled={discardBusyId === confirmDiscardDraft.draftId}
                onClick={() => void performDiscardDraft()}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {discardBusyId === confirmDiscardDraft.draftId ? 'Discarding…' : 'Discard draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send reply modal */}
      {confirmSendDraft && (
        <div
          className="fixed inset-0 bg-neutral-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmSendDraft(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-send-draft-title"
            className="bg-white rounded-2xl border border-neutral-100 shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-send-draft-title" className="text-lg font-bold text-neutral-900 mb-1">
              Send this reply?
            </h3>
            <p className="text-sm text-neutral-500 mb-2">
              This sends your draft as a reply from your linked inbox.
            </p>
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 mb-4 space-y-1.5 text-sm text-neutral-800">
              <p>
                <span className="text-neutral-500">To / thread:</span>{' '}
                <span className="font-bold">{confirmSendDraft.from}</span>
              </p>
              <p>
                <span className="text-neutral-500">Subject:</span>{' '}
                <span className="font-bold">{confirmSendDraft.subject}</span>
              </p>
              <p className="text-xs text-neutral-600 leading-relaxed">
                <span className="text-neutral-500">Reply preview:</span>{' '}
                {truncatePreview(draftText[confirmSendDraft.draftId] ?? confirmSendDraft.draftBody, 320)}
              </p>
            </div>
            <p className="text-xs text-neutral-400 mb-4">
              Double-check the wording before sending; this email will be sent from your real email address.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmSendDraft(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-100 border border-neutral-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                aria-label="Confirm send reply"
                onClick={handleConfirmSendDraft}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-all"
              >
                Send reply
              </button>
            </div>
          </div>
        </div>
      )}
    </ChatLayout>
  )
}
