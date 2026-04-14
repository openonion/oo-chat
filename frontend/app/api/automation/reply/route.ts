/**
 * POST /api/automation/reply — send an edited reply for a draft (Gmail/Outlook).
 *
 * Runs capstone automation/send_reply.py with JSON on stdin (CAPSTONE_ROOT or sibling capstone path).
 * On success, Python removes that draft from automation_briefing.json.
 */

import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { spawn } from 'child_process'
import { access } from 'fs/promises'

const RELATIVE_CAPSTONE = 'capstone-project-26t1-3900-w18a-date'

function capstoneRoots(): string[] {
  if (process.env.CAPSTONE_ROOT?.trim()) {
    return [process.env.CAPSTONE_ROOT.trim()]
  }
  const cwd = process.cwd()
  return [join(cwd, '..', RELATIVE_CAPSTONE), join(cwd, RELATIVE_CAPSTONE)]
}

async function sendViaPython(
  messageId: string,
  body: string,
  draftId?: string
): Promise<Record<string, unknown>> {
  const payload = JSON.stringify({ messageId, body, draftId })
  for (const root of capstoneRoots()) {
    const script = join(root, 'automation', 'send_reply.py')
    try {
      await access(script)
    } catch {
      continue
    }
    const { out, err } = await new Promise<{ out: string; err: string }>((resolve, reject) => {
      const py = spawn('python3', [script], { cwd: root, env: process.env })
      let o = ''
      let e = ''
      py.stdout.on('data', (d) => {
        o += d.toString()
      })
      py.stderr.on('data', (d) => {
        e += d.toString()
      })
      py.on('close', () => resolve({ out: o, err: e }))
      py.on('error', reject)
      py.stdin.write(payload)
      py.stdin.end()
    })
    const parsed = parseJsonFromOutput(out)
    const debugLogs = process.env.AUTOMATION_REPLY_DEBUG?.toLowerCase() === 'true'
    if (debugLogs && err.trim()) {
      console.error('[automation/reply]', err.trim())
    }
    if (parsed) {
      if (parsed.ok !== true && err.trim()) {
        console.error('[automation/reply]', err.trim())
      }
      return parsed
    }
    {
      if (err.trim()) {
        console.error('[automation/reply]', err.trim())
      }
      return { ok: false, error: out.trim() || 'Invalid JSON from send_reply.py' }
    }
  }
  return {
    ok: false,
    error: 'Could not run send_reply.py. Set CAPSTONE_ROOT so oo-chat can find the capstone project.',
  }
}

function parseJsonFromOutput(output: string): Record<string, unknown> | null {
  const trimmed = output.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    // Ignore noisy non-JSON lines and parse the last JSON-looking line.
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if (!(line.startsWith('{') && line.endsWith('}'))) continue
    try {
      return JSON.parse(line) as Record<string, unknown>
    } catch {
      // Try earlier lines.
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  let messageId: string
  let body: string
  let draftId: string | undefined
  try {
    const json = (await request.json()) as {
      messageId?: string
      body?: string
      draftId?: string
    }
    messageId = json.messageId ?? ''
    body = json.body ?? ''
    draftId = json.draftId
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }
  if (!messageId || body === undefined || body === null) {
    return NextResponse.json({ ok: false, error: 'messageId and body required' }, { status: 400 })
  }

  const result = await sendViaPython(messageId, String(body), draftId)
  const ok = result.ok === true
  return NextResponse.json(result, { status: ok ? 200 : 502 })
}
