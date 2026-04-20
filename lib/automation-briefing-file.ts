import { join, dirname } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { capstoneRootCandidatesFromCwd, uniqueOrderedPaths } from '@/lib/capstone-paths'

/** Under monorepo root (sibling of `oo-chat/`). */
const BRIEFING_UNDER_AGENT_TREE = join('agent', 'automation', 'data', 'automation_briefing.json')
/** Older layout: automation at repo root. */
const BRIEFING_UNDER_REPO_ROOT = join('automation', 'data', 'automation_briefing.json')

function briefingPathsUnderRepoRoot(repoRoot: string): string[] {
  // Repo-root automation/data first so it matches Python briefing_file_path() when that file exists.
  return [join(repoRoot, BRIEFING_UNDER_REPO_ROOT), join(repoRoot, BRIEFING_UNDER_AGENT_TREE)]
}

/**
 * Paths to automation_briefing.json, in try order.
 * 1. BRIEFING_FILE_PATH — explicit file override
 * 2. Paths under CAPSTONE_ROOT when set (repo root or `agent/` root)
 * 3. Repo root guesses (parent of `oo-chat/`, then legacy sibling clone layout)
 */
export function getBriefingFileCandidates(): string[] {
  const explicit = process.env.BRIEFING_FILE_PATH?.trim()
  if (explicit) {
    return [explicit]
  }
  const paths: string[] = []
  const capstoneRoot = process.env.CAPSTONE_ROOT?.trim()
  if (capstoneRoot) {
    paths.push(...briefingPathsUnderRepoRoot(capstoneRoot))
  }
  for (const root of capstoneRootCandidatesFromCwd()) {
    paths.push(...briefingPathsUnderRepoRoot(root))
  }
  return uniqueOrderedPaths(paths)
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
  let anyRemoved = false
  // Try each possible briefing file path; remove from every file that still lists this id.
  for (const filePath of getBriefingFileCandidates()) {
    try {
      const raw = await readFile(filePath, 'utf-8')
      const data = JSON.parse(raw) as BriefingJson
      const meetings = data.meetings
      // If meetings is not an array skip this file path
      if (!Array.isArray(meetings)) continue
      // Remove the meeting with the inputted meetingId
      const next = meetings.filter((m) => m.meeting_id !== meetingId)
      const actuallyRemoved = next.length < meetings.length
      if (!actuallyRemoved) continue
      data.meetings = next
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      anyRemoved = true
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code
      if (code === 'ENOENT') continue
      throw e
    }
  }
  return anyRemoved
}
