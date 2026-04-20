/**
 * GET /api/agent/email-link-status — whether agent/.env contains OAuth tokens (written by `co auth google|microsoft`).
 * Settings uses this to trigger POST /api/agent/reload-email-tools so the HTTP agent picks up tools without a restart.
 */

import { NextResponse } from 'next/server'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { resolveAgentProjectRoot } from '@/lib/capstone-paths'

function hasEnvKey(text: string, key: string): boolean {
  const re = new RegExp(`^${key}=`, 'm')
  return re.test(text)
}

function ensureEnvValue(text: string, key: string, value: string): string {
  const re = new RegExp(`^${key}=.*$`, 'm')
  if (re.test(text)) {
    return text.replace(re, `${key}=${value}`)
  }
  const needsNewline = text.length > 0 && !text.endsWith('\n')
  return `${text}${needsNewline ? '\n' : ''}${key}=${value}\n`
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
    const envPath = join(agentDir, '.env')
    const text = await readFile(envPath, 'utf-8')
    const hasGoogle =
      hasEnvKey(text, 'GOOGLE_REFRESH_TOKEN') || hasEnvKey(text, 'GOOGLE_ACCESS_TOKEN')
    const hasMicrosoft =
      hasEnvKey(text, 'MICROSOFT_REFRESH_TOKEN') || hasEnvKey(text, 'MICROSOFT_ACCESS_TOKEN')

    let nextText = text
    let shouldWrite = false
    if (hasGoogle && !/^LINKED_GMAIL=true$/m.test(nextText)) {
      nextText = ensureEnvValue(nextText, 'LINKED_GMAIL', 'true')
      shouldWrite = true
    }
    if (hasMicrosoft && !/^LINKED_OUTLOOK=true$/m.test(nextText)) {
      nextText = ensureEnvValue(nextText, 'LINKED_OUTLOOK', 'true')
      shouldWrite = true
    }
    if (shouldWrite) {
      await writeFile(envPath, nextText, 'utf-8')
    }

    return NextResponse.json({ hasGoogle, hasMicrosoft })
  } catch {
    return NextResponse.json({ hasGoogle: false, hasMicrosoft: false })
  }
}
