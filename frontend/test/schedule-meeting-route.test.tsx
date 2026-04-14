import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.setConfig({ testTimeout: 30000 })

// Mocks for testing
const { spawnMock, removeMeetingFromBriefingFile, accessMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  removeMeetingFromBriefingFile: vi.fn(async () => true),
  accessMock: vi.fn(async () => undefined),
}))
// Mocks removing meeting from briefing file after testing
vi.mock('@/lib/automation-briefing-file', () => ({
  removeMeetingFromBriefingFile,
}))
// Mimics file system access
vi.mock('fs/promises', () => ({
  access: accessMock,
  default: { access: accessMock },
}))
// Mocks Python execution
vi.mock('child_process', () => ({
  spawn: spawnMock,
  default: { spawn: spawnMock },
}))

import { POST } from '@/app/api/automation/schedule-meeting/route'

// Mimics Python execution output
function makeSpawnMock(payload: { ok: boolean; message?: string; error?: string }) {
  return {
    // If listening for data, return the payload
    stdout: {
      on: (event: string, cb: (d: Buffer) => void) => {
        if (event === 'data') cb(Buffer.from(JSON.stringify(payload)))
      },
    },
    // If listening for errors, return nothing
    stderr: { on: () => {} },
    // If listening for close, call callback
    on: (event: string, cb: () => void) => {
      if (event === 'close') cb()
    },
    // If listening for stdin, return nothing
    stdin: {
      write: () => {},
      end: () => {},
    },
  }
}


describe('POST /api/automation/schedule-meeting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CAPSTONE_ROOT = 'C:/fake/capstone'
    spawnMock.mockImplementation(() => makeSpawnMock({ ok: true, message: 'ok' }) as any)
  })

  // Testing Missing Meeting ID
  it('returns 400 if meetingId missing', async () => {
    const req = new Request('http://localhost/api/automation/schedule-meeting', {
      method: 'POST',
      body: JSON.stringify({ meeting: { title: 'A' } }),
    })

    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  // Testing Behaviour when Python Fails
  it('returns 502 when python returns failure', async () => {
    spawnMock.mockImplementationOnce(() =>
      makeSpawnMock({ ok: false, error: 'python failed' })
    )

    const req = new Request('http://localhost/api/automation/schedule-meeting', {
      method: 'POST',
      body: JSON.stringify({
        meetingId: 'm1',
        meeting: { title: 'A', date: '2026-04-10', start_time: '18:00', end_time: '19:00' },
      }),
    })

    const res = await POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.ok).toBe(false)
    expect(spawnMock).toHaveBeenCalled()
    expect(removeMeetingFromBriefingFile).not.toHaveBeenCalled()
  })

  // Testing success case
  it('returns 200 and removes meeting on success', async () => {
    spawnMock.mockImplementationOnce(() =>
      makeSpawnMock({ ok: true, message: 'scheduled' })
    )

    const req = new Request('http://localhost/api/automation/schedule-meeting', {
      method: 'POST',
      body: JSON.stringify({
        meetingId: 'm1',
        meeting: { title: 'A', date: '2026-04-10', start_time: '18:00', end_time: '19:00' },
      }),
    })

    const res = await POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(spawnMock).toHaveBeenCalled()
    expect(removeMeetingFromBriefingFile).toHaveBeenCalledWith('m1')
  })
})