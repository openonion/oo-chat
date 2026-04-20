/**
 * POST /api/connect-email/google — run ConnectOnion CLI in **agent/** (see co_cli_reference.md),
 * then return the Google OAuth URL printed by `co auth google` so the user can open it in a browser.
 *
 * `co auth google` keeps running until OAuth completes; after the URL is parsed the process is
 * unref’d so it can finish writing tokens without blocking the HTTP response.
 */

import { NextResponse } from 'next/server'
import {
  runCo,
  startCoAuthOAuthAndCaptureUrl,
  tryExtractGoogleOAuthUrl,
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
      console.warn('[connect-email/google] co init -y failed:', init.stderr || init.stdout)
    }

    const authUrl = await startCoAuthOAuthAndCaptureUrl(
      agentDir,
      'google',
      tryExtractGoogleOAuthUrl,
      90_000,
    )
    if (!authUrl) {
      return NextResponse.json(
        {
          error:
            'Could not read a Google OAuth URL from `co auth google`. Ensure `connectonion` is installed and try `co auth` in the agent folder if OpenOnion auth is missing.',
        },
        { status: 504 },
      )
    }

    return NextResponse.json({ authUrl })
  } catch (e) {
    console.error('[connect-email/google]', e)
    const message = e instanceof Error ? e.message : 'Failed to run ConnectOnion CLI'
    const isSpawn = message.includes('ENOENT') || message.includes('spawn')
    return NextResponse.json(
      {
        error: isSpawn
          ? '`co` was not found on the server PATH. Install connectonion (pip) in the web image or run `co auth google` locally in the agent directory.'
          : message,
      },
      { status: 500 },
    )
  }
}
