/**
 * POST /api/automation/discard-draft — remove a reply draft from automation_briefing.json
 * (same effect as after a successful send, but without sending mail).
 */

import { NextRequest, NextResponse } from 'next/server'
import { removeDraftFromBriefingFile } from '@/lib/automation-briefing-file'

export async function POST(request: NextRequest) {
  let draftId: string
  let messageId: string | undefined
  try {
    const json = (await request.json()) as { draftId?: string; messageId?: string }
    draftId = json.draftId ?? ''
    messageId = json.messageId
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }
  if (!draftId) {
    return NextResponse.json({ ok: false, error: 'draftId required' }, { status: 400 })
  }

  const ok = await removeDraftFromBriefingFile(draftId, messageId)
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'Draft not found or briefing file missing' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
