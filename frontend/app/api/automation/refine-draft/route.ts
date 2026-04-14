/**
 * POST /api/automation/refine-draft — rewrite a reply draft via capstone automation (LLM in agent stack).
 *
 * Runs capstone automation/refine_draft.py with JSON on stdin (same pattern as send_reply.py).
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

async function refineViaPython(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const stdin = JSON.stringify(payload)
  for (const root of capstoneRoots()) {
    const script = join(root, 'automation', 'refine_draft.py')
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
      py.stdin.write(stdin)
      py.stdin.end()
    })
    const parsed = parseJsonFromOutput(out)
    const debugLogs = process.env.AUTOMATION_REFINE_DEBUG?.toLowerCase() === 'true'
    if (debugLogs && err.trim()) {
      console.error('[automation/refine-draft]', err.trim())
    }
    if (parsed) {
      if (parsed.ok !== true && err.trim()) {
        console.error('[automation/refine-draft]', err.trim())
      }
      return parsed
    }
    if (err.trim()) {
      console.error('[automation/refine-draft]', err.trim())
    }
    return { ok: false, error: out.trim() || 'Invalid JSON from refine_draft.py' }
  }
  return {
    ok: false,
    error: 'Could not run refine_draft.py. Set CAPSTONE_ROOT so oo-chat can find the capstone project.',
  }
}

export async function POST(request: NextRequest) {
  let instruction: string
  let currentDraft: string
  let subject: string
  let from: string
  let originalEmail: string | undefined
  let draftId: string | undefined
  let messageId: string | undefined
  try {
    const json = (await request.json()) as {
      instruction?: string
      currentDraft?: string
      subject?: string
      from?: string
      originalEmail?: string
      draftId?: string
      messageId?: string
    }
    instruction = (json.instruction ?? '').trim()
    currentDraft = json.currentDraft ?? ''
    subject = json.subject ?? ''
    from = json.from ?? ''
    originalEmail = json.originalEmail
    draftId = json.draftId
    messageId = json.messageId
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!instruction) {
    return NextResponse.json({ ok: false, error: 'instruction required' }, { status: 400 })
  }

  const result = await refineViaPython({
    instruction,
    currentDraft,
    subject,
    from,
    originalEmail,
    draftId,
    messageId,
  })
  const ok = result.ok === true
  return NextResponse.json(result, { status: ok ? 200 : 502 })
}
