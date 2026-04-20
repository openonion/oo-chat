import { NextResponse } from 'next/server'

function defaultAgentUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_DEFAULT_AGENT_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/+$/, '')
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
        // Web in Docker: localhost points to itself, so try compose DNS.
        candidates.push(`http://agent:${port}`)
      } else if (u.hostname === 'agent') {
        // Web on host (npm dev): compose DNS does not resolve, so try localhost.
        candidates.push(`http://localhost:${port}`)
        candidates.push(`http://127.0.0.1:${port}`)
      }
    }
  } catch {
    // Ignore malformed URL and continue with defaults below
  }

  // Fallbacks for both deployment styles.
  candidates.push('http://agent:8000')
  candidates.push('http://localhost:8000')
  candidates.push('http://127.0.0.1:8000')

  // Deduplicate while preserving order.
  return [...new Set(candidates)]
}

export async function GET() {
  const candidates = candidateAgentUrls()
  if (candidates.length === 0) {
    return NextResponse.json({ address: null, error: 'NEXT_PUBLIC_DEFAULT_AGENT_URL is not set' }, { status: 404 })
  }

  const errors: string[] = []
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/info`, { signal: AbortSignal.timeout(4000), cache: 'no-store' })
      if (!res.ok) {
        errors.push(`${base}/info -> ${res.status}`)
        continue
      }
      const info = (await res.json()) as { address?: string }
      const address = info.address?.trim() ?? null
      if (!address || !address.startsWith('0x')) {
        errors.push(`${base}/info -> missing valid address`)
        continue
      }
      return NextResponse.json({ address })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'fetch failed'
      errors.push(`${base}/info -> ${message}`)
    }
  }

  return NextResponse.json(
    { address: null, error: `Failed to reach default agent. Tried: ${errors.join(' | ')}` },
    { status: 502 },
  )
}
