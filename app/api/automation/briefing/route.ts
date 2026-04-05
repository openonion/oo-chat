/**
 * GET /api/automation/briefing - Latest daily automation result for the frontend.
 *
 * If BACKEND_BRIEFING_URL is set (e.g. http://localhost:8001), fetches from that origin's /briefing.
 * Otherwise reads from BRIEFING_FILE_PATH or backend/automation/data/automation_briefing.json.
 * Tries two locations: cwd/../backend/automation/data/... (when run from oo-chat) and
 * cwd/backend/automation/data/... (when run from repo root).
 */

import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { getBriefingFileCandidates } from '@/lib/automation-briefing-file'

export interface ReplyDraft {
  draftId: string
  messageId: string
  subject: string
  from: string
  draftBody: string
  /** Original message body only (no From/Subject headers; those are separate fields) */
  originalEmail?: string
}

export interface MeetingProposal {
  title?: string
  date?: string
  start_time?: string
  end_time?: string
  location?: string
  attendees?: string
  is_video_call?: boolean
  meeting_id?: string
}

export interface BriefingPayload {
  scanSince?: number
  scanUntil?: number
  provider?: string
  messagesSeen?: number
  briefing: string
  summary: string
  drafts?: ReplyDraft[]
  meetings?: MeetingProposal[]
}

export async function GET() {
  const backendUrl = process.env.BACKEND_BRIEFING_URL?.trim()
  if (backendUrl) {
    try {
      const base = backendUrl.replace(/\/$/, '')
      const res = await fetch(`${base}/briefing`, { next: { revalidate: 60 } })
      if (!res.ok) {
        return NextResponse.json({ error: 'Briefing not available' }, { status: res.status })
      }
      const data = (await res.json()) as BriefingPayload
      return NextResponse.json(data)
    } catch (e) {
      console.error('[automation/briefing] fetch failed:', e)
      return NextResponse.json({ error: 'Failed to fetch briefing' }, { status: 502 })
    }
  }

  const paths = getBriefingFileCandidates()
  for (const filePath of paths) {
    try {
      const raw = await readFile(filePath, 'utf-8')
      const data = JSON.parse(raw) as BriefingPayload
      return NextResponse.json(data)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code
      if (code === 'ENOENT') continue
      console.error('[automation/briefing] read failed:', filePath, e)
      return NextResponse.json({ error: 'Failed to read briefing' }, { status: 500 })
    }
  }

  return NextResponse.json(
    {
      scanSince: 0,
      scanUntil: 0,
      provider: 'none',
      messagesSeen: 0,
      briefing: '',
      summary: 'No automation run yet.',
      drafts: [],
      meetings: [],
    } satisfies BriefingPayload,
    { status: 200 }
  )
}
