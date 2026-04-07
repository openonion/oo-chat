import { join, dirname } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { MeetingProposal } from '@/app/api/automation/briefing/route'

const RELATIVE_PATH = join('capstone-project-26t1-3900-w18a-date', 'automation', 'data', 'automation_briefing.json')

/** Paths to automation_briefing.json (same resolution as API routes). */
export function getBriefingFileCandidates(): string[] {
  if (process.env.BRIEFING_FILE_PATH) {
    return [process.env.BRIEFING_FILE_PATH]
  }
  const cwd = process.cwd()
  return [join(cwd, '..', RELATIVE_PATH), join(cwd, RELATIVE_PATH)]
}

type BriefingJson = Record<string, unknown> & { drafts?: unknown[] }

/** Remove one draft row by draftId (matches Python remove_draft_from_briefing). */
export async function removeDraftFromBriefingFile(draftId: string, messageId?: string): Promise<boolean> {
  for (const filePath of getBriefingFileCandidates()) {
    try {
      const raw = await readFile(filePath, 'utf-8')
      const data = JSON.parse(raw) as BriefingJson
      const drafts = data.drafts
      if (!Array.isArray(drafts)) continue
      let removed = false
      const next = drafts.filter((d) => {
        if (!d || typeof d !== 'object') return true
        const row = d as Record<string, unknown>
        if (draftId && row.draftId === draftId) {
          removed = true
          return false
        }
        if (!draftId && messageId && row.messageId === messageId) {
          removed = true
          return false
        }
        return true
      })
      if (!removed) continue
      data.drafts = next
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      return true
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code
      if (code === 'ENOENT') continue
      throw e
    }
  }
  return false
}

/** Remove one meeting row by meetingId.
 * @param meetingId - The ID of the meeting to be removed
 * @returns True if the meeting was removed, false otherwise
 */
export async function removeMeetingFromBriefingFile(meetingId: string): Promise<boolean> {
  // Try each possible briefing file path
  for (const filePath of getBriefingFileCandidates()) {
    try {
      const raw = await readFile(filePath, 'utf-8')
      const data = JSON.parse(raw) as BriefingJson
      const meetings = data.meetings
      // If meetings is not an array skip this file path
      if (!Array.isArray(meetings)) continue
      // Remove the meeting with the inputted meetingId
      const next = meetings.filter((m) => m.meeting_id !== meetingId)
      data.meetings = next
      // Save the data WITHOUT the meeting to the briefing file
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      return true
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code
      if (code === 'ENOENT') continue
      throw e
    }
  }
  // If theres no file paths or meeting was not found return false
  return false
}
