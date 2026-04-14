/**
 * POST /api/draft/send - send a new email from an edited draft.
 *
 * Runs capstone automation/send_draft.py with JSON on stdin.
 * Same pattern as /api/automation/reply but for new emails (not replies).
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
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
): Promise<Record<string, unknown>> {
  const payload = JSON.stringify({ to, subject, body, cc, bcc })

  for (const root of capstoneRoots()) {
    const script = join(root, 'drafting', 'send_draft.py')
    try {
      await access(script)
    } catch {
      continue
    }

    const { out, err } = await new Promise<{ out: string; err: string }>((resolve, reject) => {
      const py = spawn('python3', [script], { cwd: root, env: process.env })
      let o = ''
      let e = ''
      py.stdout.on('data', (d) => { o += d.toString() })
      py.stderr.on('data', (d) => { e += d.toString() })
      py.on('close', () => resolve({ out: o, err: e }))
      py.on('error', reject)
      py.stdin.write(payload)
      py.stdin.end()
    })

    const parsed = parseJsonFromOutput(out)

    if (err.trim()) {
      console.error('[draft/send]', err.trim())
    }

    if (parsed) {
      return parsed
    }

    return { ok: false, error: out.trim() || 'Invalid JSON from send_draft.py' }
  }

  return {
    ok: false,
    error: 'Could not run send_draft.py. Set CAPSTONE_ROOT so oo-chat can find the capstone project.',
  }
}

function parseJsonFromOutput(output: string): Record<string, unknown> | null {
  const trimmed = output.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    // Try last JSON-looking line
  }
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if (!(line.startsWith('{') && line.endsWith('}'))) continue
    try {
      return JSON.parse(line) as Record<string, unknown>
    } catch {
      // Try earlier lines
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  let to: string
  let subject: string
  let body: string
  let cc: string | undefined
  let bcc: string | undefined

  try {
    const json = (await request.json()) as {
      to?: string
      subject?: string
      body?: string
      cc?: string
      bcc?: string
    }
    to = json.to ?? ''
    subject = json.subject ?? ''
    body = json.body ?? ''
    cc = json.cc || undefined
    bcc = json.bcc || undefined
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!to || !subject || !body) {
    return NextResponse.json(
      { ok: false, error: 'to, subject, and body are required' },
      { status: 400 }
    )
  }

  const result = await sendViaPython(to, subject, body, cc, bcc)
  const ok = result.ok === true
  return NextResponse.json(result, { status: ok ? 200 : 502 })
}