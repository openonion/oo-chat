import type { BriefingData, BriefingSection, MeetingProposal, PriorityEmailCounts } from './types'

const BRIEFING_HEADING = /^##\s+(.+)$/gm

export function parseBriefingSections(briefing: string): BriefingSection[] {
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

/** Older automation_briefing.json may still have a flat `briefing` string. */
export function legacyBriefingPlainText(o: object): string {
  if ('briefing' in o && typeof (o as { briefing: unknown }).briefing === 'string') {
    return (o as { briefing: string }).briefing
  }
  return ''
}

export function briefingSectionsForDisplay(d: BriefingData): BriefingSection[] {
  if (d.briefingSections && d.briefingSections.length > 0) {
    return d.briefingSections
  }
  return parseBriefingSections(legacyBriefingPlainText(d))
}

export type BriefingSectionTitlePriority = 'high' | 'medium' | 'low'

/**
 * When a section title mentions high / medium / low,
 * returns the priority to choose the matching icon. Checks high, then medium, then low.
 */
export function briefingSectionTitlePriority(title: string): BriefingSectionTitlePriority | null {
  const t = title.trim()
  if (!t) return null
  if (/\bhigh\b/i.test(t)) return 'high'
  if (/\bmedium\b/i.test(t)) return 'medium'
  if (/\blow\b/i.test(t)) return 'low'
  return null
}

/** True when the section title is the Summary band 
 * Separates the summary from the briefing content
*/
export function isSummaryBriefingSectionTitle(title: string): boolean {
  const t = title.replace(/\*\*/g, '').trim()
  return /^summary$/i.test(t)
}

/** Counts the number of priority list items in the body */
export function countPriorityListItems(body: string): number {
  let n = 0
  for (const line of body.split('\n')) {
    if (/^\s*\d+\.\s+\*\*/.test(line)) n += 1
  }
  return n
}

/** Get high, medium and low email counts from briefing section */
export function priorityEmailCountsFromSections(sections: BriefingSection[]): PriorityEmailCounts {
  const out: PriorityEmailCounts = { high: 0, medium: 0, low: 0 }
  for (const sec of sections) {
    const title = sec.title.toLowerCase()
    const n = countPriorityListItems(sec.body)
    if (title.includes('high priority') || title.includes('🔴')) {
      out.high = n
    } else if (title.includes('medium priority') || title.includes('🟡')) {
      out.medium = n
    } else if (title.includes('low priority') || title.includes('🟢')) {
      out.low = n
    }
  }
  return out
}

/** Format timestamp to readable date and time */
export function formatTs(ts: number | undefined) {
  if (!ts) return null
  return new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Shortens the preview text to a maximum length */
export function truncatePreview(s: string, maxLen: number): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen - 1)}…`
}

/** Normalize meeting data to type MeetingProposal[] */
export function normalizeMeetings(raw: unknown): MeetingProposal[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is MeetingProposal => x !== null && typeof x === 'object')
}

/** Border for the meetings list, same as in the subscriptions page **/
export const MEETINGS_LIST_BORDER = 'border-indigo-100'

/** Green outline for add to calendar and send reply buttons*/
export const BRIEFING_GREEN_OUTLINE_BTN =
  'font-bold text-green-600 hover:text-green-700 border border-green-200 hover:border-green-300 bg-green-50 hover:bg-green-100 transition-all disabled:opacity-50 disabled:pointer-events-none'

/** 15-minute slots from 00:00 through 23:45 */
export const CALENDAR_TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (const mm of [0, 15, 30, 45]) {
      const value = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
      const d = new Date(2000, 0, 1, h, mm)
      const label = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      out.push({ value, label })
    }
  }
  return out
})()

const LAST_CALENDAR_SLOT_MINUTES = 23 * 60 + 45

/** Convert time to minutes */
export function timeToMinutes(hhmm: string): number {
  const [hs, ms] = hhmm.split(':')
  const h = parseInt(hs, 10)
  const m = parseInt(ms || '0', 10)
  if (Number.isNaN(h)) return 0
  return h * 60 + (Number.isNaN(m) ? 0 : m)
}

/** Converts inputted time to the nearest 15-minute slot.
 * For when a sent email includes a time that's not compatible.
 * Follows google calendar's standards.
*/
export function snapTimeToNearestSlot(hhmm: string): string {
  const opts = CALENDAR_TIME_OPTIONS.map((o) => o.value)
  if (opts.includes(hhmm)) return hhmm
  const t = timeToMinutes(hhmm)
  let best = opts[0]!
  let bestD = Infinity
  for (const o of opts) {
    const d = Math.abs(timeToMinutes(o) - t)
    if (d < bestD) {
      bestD = d
      best = o
    }
  }
  return best
}

export function addOneHourToTime(hhmm: string): string {
  const total = timeToMinutes(hhmm) + 60
  const capped = Math.min(total, LAST_CALENDAR_SLOT_MINUTES)
  const h = Math.floor(capped / 60)
  const mm = capped % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function subtractOneHourFromTime(hhmm: string): string {
  const total = Math.max(timeToMinutes(hhmm) - 60, 0)
  const h = Math.floor(total / 60)
  const mm = total % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function meetingTimesIncomplete(m: MeetingProposal): boolean {
  return !m.start_time?.trim() || !m.end_time?.trim()
}

export function meetingBothTimesMissing(m: MeetingProposal): boolean {
  return !m.start_time?.trim() && !m.end_time?.trim()
}

/** Default times for the modal when no times are provided */
export function defaultModalTimes(m: MeetingProposal): { start: string; end: string } {
  const hasStart = Boolean(m.start_time?.trim())
  const hasEnd = Boolean(m.end_time?.trim())
  if (hasStart && hasEnd) {
    return {
      start: snapTimeToNearestSlot(m.start_time!.trim()),
      end: snapTimeToNearestSlot(m.end_time!.trim()),
    }
  }
  if (hasStart && !hasEnd) {
    const start = snapTimeToNearestSlot(m.start_time!.trim())
    return { start, end: snapTimeToNearestSlot(addOneHourToTime(start)) }
  }
  if (!hasStart && hasEnd) {
    const end = snapTimeToNearestSlot(m.end_time!.trim())
    const start = snapTimeToNearestSlot(subtractOneHourFromTime(end))
    return { start, end }
  }
  return { start: '09:00', end: '10:00' }
}
