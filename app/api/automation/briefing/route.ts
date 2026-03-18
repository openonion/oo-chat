/**
 * GET /api/automation/briefing - Latest daily automation result for the frontend.
 *
 * If BACKEND_BRIEFING_URL is set (e.g. http://localhost:8001), fetches from that origin's /briefing.
 * Otherwise reads from BRIEFING_FILE_PATH or backend/automation/data/automation_briefing.json.
 * Tries two locations: cwd/../backend/automation/data/... (when run from oo-chat) and
 * cwd/backend/automation/data/... (when run from repo root).
 */

import { NextResponse } from 'next/server'
import { join } from 'path'
import { readFile } from 'fs/promises'

export interface BriefingPayload {
  lastRunAt: number
  briefing: string
  summary: string
}

const RELATIVE_PATH = join('capstone-project-26t1-3900-w18a-date', 'automation', 'data', 'automation_briefing.json')

function getCandidatePaths(): string[] {
  if (process.env.BRIEFING_FILE_PATH) {
    return [process.env.BRIEFING_FILE_PATH]
  }
  const cwd = process.cwd()
  return [
    join(cwd, '..', RELATIVE_PATH),  // run from oo-chat
    join(cwd, RELATIVE_PATH),        // run from repo root (EmailAI)
  ]
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

  const paths = getCandidatePaths()
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
    { lastRunAt: 0, briefing: '', summary: 'No automation run yet.' },
    { status: 200 }
  )
}
