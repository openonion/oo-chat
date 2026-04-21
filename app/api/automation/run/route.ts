/**
 * POST /api/automation/run — trigger a one-shot automation run via run_automation.py
 */

import { NextResponse } from 'next/server'
import { join } from 'path'
import { spawn } from 'child_process'
import { access } from 'fs/promises'
import { agentRootCandidatesFromCwd, uniqueOrderedPaths } from '@/lib/capstone-paths'

function capstoneRoots(): string[] {
  const env = process.env.CAPSTONE_ROOT?.trim()
  if (env) return uniqueOrderedPaths([env, join(env, 'agent')])
  return agentRootCandidatesFromCwd()
}

function pythonExecutable(): string {
  if (process.env.PYTHON_PATH?.trim()) return process.env.PYTHON_PATH.trim()
  return process.platform === 'win32' ? 'python' : 'python3'
}

export async function POST() {
  for (const root of capstoneRoots()) {
    const script = join(root, 'automation', 'run_automation.py')
    try {
      await access(script)
    } catch {
      continue
    }

    const { code, stderr } = await new Promise<{ code: number; stderr: string }>((resolve, reject) => {
      const py = spawn(pythonExecutable(), [script], { cwd: root, env: process.env })
      let errOut = ''
      py.stderr.on('data', (d) => { errOut += d.toString() })
      py.on('close', (c) => resolve({ code: c ?? 1, stderr: errOut }))
      py.on('error', reject)
    })

    if (code !== 0) {
      console.error('[automation/run]', stderr.trim())
      return NextResponse.json({ ok: false, error: stderr.trim() || 'Automation run failed' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: 'Could not find run_automation.py' }, { status: 500 })
}
