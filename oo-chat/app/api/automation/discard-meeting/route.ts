/**
 * POST /api/automation/discard-meeting — remove a meeting from automation_briefing.json.
 */

import { NextRequest, NextResponse } from 'next/server'
import { removeMeetingFromBriefingFile } from '@/lib/automation-briefing-file'

export async function POST(request: NextRequest) {
  let meetingId: string
  try {
    const json = (await request.json()) as { meetingId?: string }
    meetingId = json.meetingId ?? ''
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }
  if (!meetingId) {
    return NextResponse.json({ ok: false, error: 'meetingId required' }, { status: 400 })
  }

  const ok = await removeMeetingFromBriefingFile(meetingId)
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'Meeting request not found or briefing file missing' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
