/**
 * GET /api/automation/briefing - Latest daily automation result for the frontend.
 *
 * Reads automation_briefing.json via getBriefingFileCandidates() (BRIEFING_FILE_PATH, or CAPSTONE_ROOT + relative path, or sibling cwd guesses).
 */

import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { getBriefingFileCandidates } from '@/lib/automation-briefing-file'

export interface BriefingSection {
  title: string
  body: string
}

export interface ReplyDraft {
  draftId: string
  messageId: string
  subject: string
  from: string
  draftBody: string
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
  briefingSections: BriefingSection[]
  summary: string
  drafts?: ReplyDraft[]
  meetings?: MeetingProposal[]
}

function isBriefingSectionList(v: unknown): v is BriefingSection[] {
  return (
    Array.isArray(v) &&
    v.every(
      (s) =>
        s &&
        typeof s === 'object' &&
        typeof (s as BriefingSection).title === 'string' &&
        typeof (s as BriefingSection).body === 'string'
    )
  )
}

export async function GET() {
  const paths = getBriefingFileCandidates()
  for (const filePath of paths) {
    try {
      const raw = await readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw) as BriefingPayload & Record<string, unknown>
      const sections = parsed.briefingSections
      const briefingSections = isBriefingSectionList(sections) ? sections : []
      const data: BriefingPayload = { ...parsed, briefingSections }
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
      briefingSections: [],
      summary: 'No automation run yet.',
      drafts: [],
      meetings: [],
    } satisfies BriefingPayload,
    { status: 200 }
  )
}
