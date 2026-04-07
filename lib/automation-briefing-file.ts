import { join, dirname } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'

const CAPSTONE_DIR = 'capstone-project-26t1-3900-w18a-date'
/** Path from capstone repo root to the briefing JSON (matches Python `briefing_file_path`). */
const BRIEFING_UNDER_CAPSTONE = join('automation', 'data', 'automation_briefing.json')
const RELATIVE_PATH = join(CAPSTONE_DIR, BRIEFING_UNDER_CAPSTONE)

/**
 * Paths to automation_briefing.json, in try order.
 * 1. BRIEFING_FILE_PATH — explicit file override
 * 2. CAPSTONE_ROOT/automation/data/automation_briefing.json — when CAPSTONE_ROOT is set
 * 3. Sibling guesses from cwd (../capstone… or ./capstone…)
 */
export function getBriefingFileCandidates(): string[] {
  const explicit = process.env.BRIEFING_FILE_PATH?.trim()
  if (explicit) {
    return [explicit]
  }
  const capstoneRoot = process.env.CAPSTONE_ROOT?.trim()
  if (capstoneRoot) {
    return [join(capstoneRoot, BRIEFING_UNDER_CAPSTONE)]
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
