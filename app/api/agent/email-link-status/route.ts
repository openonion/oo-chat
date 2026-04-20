/**
 * GET /api/agent/email-link-status — whether agent/.env contains OAuth tokens (written by `co auth google|microsoft`).
 * Settings uses this to trigger POST /api/agent/reload-email-tools so the HTTP agent picks up tools without a restart.
 */

import { NextResponse } from 'next/server'
import { join } from 'path'
import { readFile } from 'fs/promises'
import { resolveAgentProjectRoot } from '@/lib/capstone-paths'

function hasEnvKey(text: string, key: string): boolean {
  const re = new RegExp(`^${key}=`, 'm')
  return re.test(text)
}

export async function GET() {
  const agentDir = await resolveAgentProjectRoot()
  if (!agentDir) {
    return NextResponse.json(
      { hasGoogle: false, hasMicrosoft: false, error: 'Agent project not found' },
      { status: 404 },
    )
  }
  try {
    const text = await readFile(join(agentDir, '.env'), 'utf-8')
    const hasGoogle =
      hasEnvKey(text, 'GOOGLE_REFRESH_TOKEN') || hasEnvKey(text, 'GOOGLE_ACCESS_TOKEN')
    const hasMicrosoft =
      hasEnvKey(text, 'MICROSOFT_REFRESH_TOKEN') || hasEnvKey(text, 'MICROSOFT_ACCESS_TOKEN')
    return NextResponse.json({ hasGoogle, hasMicrosoft })
  } catch {
    return NextResponse.json({ hasGoogle: false, hasMicrosoft: false })
  }
}
