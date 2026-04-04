/**
 * GET /api/automation/briefing - Latest daily automation result for the frontend.
 *
 * Reads automation_briefing.json via getBriefingFileCandidates() (capstone sibling paths or BRIEFING_FILE_PATH).
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
  originalEmail?: string
}

export interface BriefingPayload {
  scanSince?: number
  scanUntil?: number
  provider?: string
  messagesSeen?: number
  briefing: string
  summary: string
  drafts?: ReplyDraft[]
}

export async function GET() {
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
    } satisfies BriefingPayload,
    { status: 200 }
  )
}
