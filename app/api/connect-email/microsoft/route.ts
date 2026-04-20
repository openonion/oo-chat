/**
 * POST /api/connect-email/microsoft — same as Google, but runs `co auth microsoft` in **agent/**
 * and returns the Microsoft identity platform authorize URL for Outlook / Microsoft 365.
 */

import { NextResponse } from 'next/server'
import {
  runCo,
  startCoAuthOAuthAndCaptureUrl,
  tryExtractMicrosoftOAuthUrl,
} from '@/lib/co-connect-email'
import { resolveAgentProjectRoot } from '@/lib/capstone-paths'

export async function POST() {
  try {
    const agentDir = await resolveAgentProjectRoot()
    if (!agentDir) {
      return NextResponse.json(
        {
          error:
            'Could not find the agent project directory (agent.py). Set CAPSTONE_ROOT or AGENT_PROJECT_PATH.',
        },
        { status: 404 },
      )
    }

    const init = await runCo(agentDir, ['init', '-y'], 120_000)
    if (!init.ok) {
      console.warn('[connect-email/microsoft] co init -y failed:', init.stderr || init.stdout)
    }

    const authUrl = await startCoAuthOAuthAndCaptureUrl(
      agentDir,
      'microsoft',
      tryExtractMicrosoftOAuthUrl,
      90_000,
    )
    if (!authUrl) {
      return NextResponse.json(
        {
          error:
            'Could not read a Microsoft OAuth URL from `co auth microsoft`. Ensure `connectonion` is installed and run `co auth` in the agent folder if OpenOnion auth is missing.',
        },
        { status: 504 },
      )
    }

    return NextResponse.json({ authUrl })
  } catch (e) {
    console.error('[connect-email/microsoft]', e)
    const message = e instanceof Error ? e.message : 'Failed to run ConnectOnion CLI'
    const isSpawn = message.includes('ENOENT') || message.includes('spawn')
    return NextResponse.json(
      {
        error: isSpawn
          ? '`co` was not found on the server PATH. Install connectonion (pip) in the web image or run `co auth microsoft` locally in the agent directory.'
          : message,
      },
      { status: 500 },
    )
  }
}
