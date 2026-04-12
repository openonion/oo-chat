/**
 * POST /api/automation/schedule-meeting — create calendar event with the front-end function automation/schedule_meeting.py
 *
 * Runs with meeting JSON on stdin (CAPSTONE_ROOT or sibling capstone path). On success, removes that
 * meeting from automation_briefing.json (functionaly inspired by send_reply).
 */

import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { spawn } from 'child_process'
import { access } from 'fs/promises'

import { removeMeetingFromBriefingFile } from '@/lib/automation-briefing-file'
import type { MeetingProposal } from '../briefing/route'

const RELATIVE_CAPSTONE = 'capstone-project-26t1-3900-w18a-date'

// Gets possible paths to the root of the frontend
function capstoneRoots(): string[] {
    if (process.env.CAPSTONE_ROOT?.trim()) {
        return [process.env.CAPSTONE_ROOT.trim()]
    }
    const cwd = process.cwd()
    return [join(cwd, '..', RELATIVE_CAPSTONE), join(cwd, RELATIVE_CAPSTONE)]
}

// Gets the path to the python executable
function pythonExecutable(): string {
    if (process.env.PYTHON_PATH?.trim()) {
        return process.env.PYTHON_PATH.trim()
    }
    return process.platform === 'win32' ? 'python' : 'python3'
}

// Parses the output from the python script into a JSON object
function parseJsonFromOutput(output: string): Record<string, unknown> | null {
    const trimmed = output.trim()
    if (!trimmed) return null
    try {
        return JSON.parse(trimmed) as Record<string, unknown>
    } catch {
        // Fall through 
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
            // Try earlier lines
        }
    }
    return null
}

/** Stdin must match what schedule_meeting.py parses (title, date, start_time, …). */
async function scheduleViaPython(meeting: MeetingProposal): Promise<Record<string, unknown>> {
    // Designing payload to be passed in to the python script
    const payload = JSON.stringify({
        title: meeting.title,
        date: meeting.date,
        start_time: meeting.start_time,
        end_time: meeting.end_time,
        location: meeting.location,
        attendees: meeting.attendees,
        is_video_call: meeting.is_video_call,
    })

    // For each possible path to the frontend root, find schedule_meeting.py
    for (const root of capstoneRoots()) {
        const script = join(root, 'automation', 'schedule_meeting.py')
        try {
            await access(script)
        } catch {
            continue
        }

        const { out, err } = await new Promise<{ out: string; err: string }>((resolve, reject) => {
        
        // Run $ python schedule_meeting.py
        const py = spawn(pythonExecutable(), [script], { cwd: root, env: process.env })
        // Collect output and errors from script
        let script_output = ''
        let script_error = ''
        py.stdout.on('data', (d) => {
            script_output += d.toString()
        })
        py.stderr.on('data', (d) => {
            script_error += d.toString()
        })
        py.on('close', () => resolve({ 
            out: script_output, 
            err: script_error 
        }))
        py.on('error', reject)
        // Write payload to stdin
        py.stdin.write(payload)
        py.stdin.end()
        })

        // Parse the output from the python script into a JSON object
        const parsed = parseJsonFromOutput(out)
        const debugLogs = process.env.AUTOMATION_SCHEDULE_DEBUG?.toLowerCase() === 'true'
        
        // Get errors if they occur
        if (debugLogs && err.trim()) {
        console.error('[automation/schedule-meeting]', err.trim())
        }
        if (parsed) {
        if (parsed.ok !== true && err.trim()) {
            console.error('[automation/schedule-meeting]', err.trim())
        }
        return parsed
        }
        if (err.trim()) {
        console.error('[automation/schedule-meeting]', err.trim())
        }
        return { ok: false, error: out.trim() || 'Invalid JSON from schedule_meeting.py' }
    }

  // If the python script fails to run, return an error
    return {
        ok: false,
        error:
        'Could not run schedule_meeting.py.',
    }
}

// Handles POST request to schedule a meeting
export async function POST(request: NextRequest) {
    let meetingId: string
    let meeting: MeetingProposal
    try {
        const json = (await request.json()) as { meetingId?: string; meeting?: MeetingProposal }
        meetingId = json.meetingId ?? ''
        meeting = json.meeting ?? {}
    } catch {
        return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }
    if (!meetingId) {
        return NextResponse.json({ ok: false, error: 'meetingId required' }, { status: 400 })
    }
    if (!meeting.date || !meeting.start_time) {
        return NextResponse.json(
            { ok: false, error: 'Meeting must include date and start_time' },
            { status: 400 }
        )
    }

    const result = await scheduleViaPython(meeting)
    const ok = result.ok === true
    let message: string

    // Get the message from the result
    if (typeof result.message === 'string') {
    message = result.message
    } else if (typeof result.error === 'string') {
    message = result.error
    } else {
    message = 'Schedule failed'
    }

    if (!ok) {
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
    }

    await removeMeetingFromBriefingFile(meetingId)
    return NextResponse.json({ ok: true, message })
}