/**
 * Shared helpers for POST /api/connect-email/* routes: run `co` in **agent/** and
 * parse Rich-wrapped OAuth URLs from `co auth google` / `co auth microsoft` output.
 */

import { spawn } from 'child_process'

const RICH_URL_STOP = /\n\n|\n⏳|Waiting for authorization/

function extractRichWrappedUrl(
  buffer: string,
  markers: string[],
  isValid: (url: string) => boolean,
): string | null {
  for (const marker of markers) {
    const i = buffer.indexOf(marker)
    if (i < 0) continue
    let s = buffer.slice(i)
    const stop = s.search(RICH_URL_STOP)
    if (stop >= 0) s = s.slice(0, stop)
    const url = s.split(/\r?\n/).map((l) => l.trim()).join('')
    if (isValid(url)) return url
  }
  return null
}

export function tryExtractGoogleOAuthUrl(buffer: string): string | null {
  return extractRichWrappedUrl(
    buffer,
    [
      'https://accounts.google.com/o/oauth2/v2/auth?',
      'https://accounts.google.com/o/oauth2/auth?',
    ],
    (u) => u.startsWith('https://accounts.google.com'),
  )
}

export function tryExtractMicrosoftOAuthUrl(buffer: string): string | null {
  return extractRichWrappedUrl(
    buffer,
    [
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?',
      'https://login.microsoftonline.com/common/oauth2/authorize?',
    ],
    (u) => u.startsWith('https://login.microsoftonline.com'),
  )
}

export function runCo(
  cwd: string,
  args: string[],
  timeoutMs: number,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('co', args, { cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      proc.kill('SIGTERM')
    }, timeoutMs)
    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString()
    })
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({ ok: code === 0, stdout, stderr })
    })
  })
}

export type CoEmailService = 'google' | 'microsoft'

export function startCoAuthOAuthAndCaptureUrl(
  agentDir: string,
  service: CoEmailService,
  extractUrl: (buffer: string) => string | null,
  timeoutMs: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout>

    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }

    const proc = spawn(
      'bash',
      ['-lc', `stty cols 512 2>/dev/null || true; exec co auth ${service}`],
      {
        cwd: agentDir,
        env: process.env,
      },
    )

    let buffer = ''

    const append = (chunk: Buffer) => {
      buffer += chunk.toString()
      const u = extractUrl(buffer)
      if (u) {
        finish(u)
        // Keep the process attached after returning the URL so `co auth <service>`
        // can continue polling OAuth completion and persist credentials to .env.
        // Detaching here can cause the CLI flow to terminate before save.
      }
    }

    proc.stdout.on('data', append)
    proc.stderr.on('data', append)

    proc.on('error', () => {
      finish(null)
    })

    proc.on('close', () => {
      finish(extractUrl(buffer))
    })

    timer = setTimeout(() => {
      proc.kill('SIGTERM')
      finish(extractUrl(buffer))
    }, timeoutMs)
  })
}
