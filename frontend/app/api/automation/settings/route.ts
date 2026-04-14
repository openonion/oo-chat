/**
 * GET/PATCH /api/automation/settings - Read or update automation opt-in (running = true).
 *
 * Reads/writes capstone .../automation/automation_config.json.
 * PATCH preserves lastScannedAt when toggling running.
 */

import { NextRequest, NextResponse } from 'next/server'
import { join, dirname } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'

const RELATIVE_CONFIG = join('capstone-project-26t1-3900-w18a-date', 'automation', 'automation_config.json')

function getConfigPathCandidates(): string[] {
  if (process.env.AUTOMATION_CONFIG_PATH) return [process.env.AUTOMATION_CONFIG_PATH]
  const cwd = process.cwd()
  return [
    join(cwd, '..', RELATIVE_CONFIG),
    join(cwd, RELATIVE_CONFIG),
  ]
}

export interface AutomationSettings {
  running: boolean
  lastScannedAt?: number
}

async function readConfig(): Promise<{ running: boolean; lastScannedAt?: number }> {
  for (const filePath of getConfigPathCandidates()) {
    try {
      const raw = await readFile(filePath, 'utf-8')
      const data = JSON.parse(raw) as { running?: boolean; lastScannedAt?: number }
      const lastScannedAt =
        typeof data.lastScannedAt === 'number' && Number.isFinite(data.lastScannedAt)
          ? data.lastScannedAt
          : undefined
      return { running: data.running === true, lastScannedAt }
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code
      if (code === 'ENOENT') continue
      throw e
    }
  }
  return { running: false }
}

export async function GET() {
  try {
    const { running, lastScannedAt } = await readConfig()
    return NextResponse.json({ running, lastScannedAt } as AutomationSettings)
  } catch (e) {
    console.error('[automation/settings] read failed:', e)
    return NextResponse.json({ error: 'Failed to read automation running status' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { running?: boolean }
    const running = body.running === true
    const existing = await readConfig()
    const merged: Record<string, unknown> = { running }
    if (existing.lastScannedAt !== undefined) {
      merged.lastScannedAt = existing.lastScannedAt
    }
    const payload = JSON.stringify(merged, null, 2)
    const candidates = getConfigPathCandidates()
    let lastErr: unknown
    for (const filePath of candidates) {
      try {
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, payload, 'utf-8')
        return NextResponse.json({
          running,
          lastScannedAt: existing.lastScannedAt,
        } as AutomationSettings)
      } catch (e) {
        lastErr = e
      }
    }
    throw lastErr
  } catch (e) {
    console.error('[automation/settings] write failed:', e)
    return NextResponse.json({ error: 'Failed to update automation running status' }, { status: 500 })
  }
}
