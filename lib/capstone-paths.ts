import { join } from 'path'
import { access } from 'fs/promises'

/** When the chat app lived next to a separate capstone clone (legacy). */
export const LEGACY_CAPSTONE_FOLDER = 'capstone-project-26t1-3900-w18a-date'

/**
 * Candidate **repo roots** (parent of `oo-chat/`, `agent/`, top-level `data/`, `automation/`).
 * Used for automation_briefing.json, subscriptions, etc.
 */
export function capstoneRootCandidatesFromCwd(cwd: string = process.cwd()): string[] {
  return [join(cwd, '..'), cwd, join(cwd, '..', LEGACY_CAPSTONE_FOLDER), join(cwd, LEGACY_CAPSTONE_FOLDER)]
}

/**
 * Candidate directories that contain `automation/send_reply.py` (the merged `agent/` tree).
 */
export function agentRootCandidatesFromCwd(cwd: string = process.cwd()): string[] {
  return uniqueOrderedPaths([
    join(cwd, '..', 'agent'),
    join(cwd, 'agent'),
    join(cwd, '..', LEGACY_CAPSTONE_FOLDER, 'agent'),
  ])
}

/**
 * Absolute path to the **agent project** directory (contains `agent.py`).
 * ConnectOnion CLI (`co init`, `co auth google`, `co auth microsoft`, …) must run here, not the capstone repo root.
 */
export async function resolveAgentProjectRoot(cwd: string = process.cwd()): Promise<string | null> {
  const candidates: string[] = []
  const capstone = process.env.CAPSTONE_ROOT?.trim()
  if (capstone) {
    candidates.push(join(capstone, 'agent'))
  }
  const agentProject = process.env.AGENT_PROJECT_PATH?.trim()
  if (agentProject) {
    const normalized = agentProject.replace(/\\/g, '/')
    if (normalized.endsWith('/agent')) {
      candidates.push(agentProject)
    } else {
      candidates.push(join(agentProject, 'agent'))
    }
  }
  candidates.push(...agentRootCandidatesFromCwd(cwd))
  for (const dir of uniqueOrderedPaths(candidates)) {
    try {
      await access(join(dir, 'agent.py'))
      return dir
    } catch {
      continue
    }
  }
  return null
}

/** Dedupe while preserving order. */
export function uniqueOrderedPaths(paths: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of paths) {
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

/**
 * Paths for JSON under `agent/data/` (matches Python `agent/subscriptions.py`) or legacy repo `data/`.
 * `AGENT_PROJECT_PATH` if set: tries `{override}/agent/data/` then `{override}/data/` (repo or agent root).
 */
export function agentDataJsonCandidates(fileName: string, cwd: string = process.cwd()): string[] {
  const override = process.env.AGENT_PROJECT_PATH?.trim()
  if (override) {
    return uniqueOrderedPaths([
      join(override, 'agent', 'data', fileName),
      join(override, 'data', fileName),
    ])
  }
  const paths: string[] = []
  for (const root of capstoneRootCandidatesFromCwd(cwd)) {
    paths.push(join(root, 'agent', 'data', fileName))
    paths.push(join(root, 'data', fileName))
  }
  return uniqueOrderedPaths(paths)
}
