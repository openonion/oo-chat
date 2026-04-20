/**
 * POST /api/agent/reload-email-tools — tell the running HTTP agent to reload agent/.env
 * and rebuild Gmail/Outlook tools (no Docker restart). Uses OPENONION_API_KEY as Bearer
 * token (same as ConnectOnion admin routes), available to the web container via agent/.env.
 */

import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { resolveAgentProjectRoot } from '@/lib/capstone-paths'

function defaultAgentUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_DEFAULT_AGENT_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}


async function getOpenOnionApiKey(): Promise<string | null> {
  const fromEnv = process.env.OPENONION_API_KEY?.trim()
  if (fromEnv) return fromEnv

  const agentDir = await resolveAgentProjectRoot()
  if (!agentDir) return null

  try {
    const envText = await readFile(join(agentDir, '.env'), 'utf-8')
    const match = envText.match(/^OPENONION_API_KEY=(.+)$/m)
    return match?.[1]?.trim() || null
  } catch {
    return null
  }
}

function candidateAgentUrls(): string[] {
  const base = defaultAgentUrl()
  const candidates: string[] = []
  if (base) candidates.push(base)

  try {
    if (base) {
      const u = new URL(base)
      const port = u.port || '8000'
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        candidates.push(`http://agent:${port}`)
      } else if (u.hostname === 'agent') {
        candidates.push(`http://localhost:${port}`)
        candidates.push(`http://127.0.0.1:${port}`)
      }
    }
  } catch {
    // ignore
  }

  candidates.push('http://agent:8000')
  candidates.push('http://localhost:8000')
  candidates.push('http://127.0.0.1:8000')
  return [...new Set(candidates)]
}

export async function POST() {
  const apiKey = await getOpenOnionApiKey()
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'OPENONION_API_KEY not found in environment or agent/.env (needed for /internal/reload-email)' },
      { status: 500 },
    )
  }

  const candidates = candidateAgentUrls()
  const errors: string[] = []

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/internal/reload-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        signal: AbortSignal.timeout(15000),
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        errors.push(`${base} -> ${res.status} ${JSON.stringify(data)}`)
        continue
      }
      return NextResponse.json(data)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'fetch failed'
      errors.push(`${base} -> ${message}`)
    }
  }

  return NextResponse.json(
    { ok: false, error: `Could not reload agent. Tried: ${errors.join(' | ')}` },
    { status: 502 },
  )
}
