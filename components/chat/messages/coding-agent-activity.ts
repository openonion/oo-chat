import { modeLabels } from '../mode-policy'
import type { ProviderInvocationUI } from '../types'

export type ProviderActivity = ProviderInvocationUI['activities'][number]
export type ProviderArtifactPreview = NonNullable<ProviderInvocationUI['artifact']>

const SAFE_PROVIDER_ARTIFACT_ALTS = new Set<ProviderArtifactPreview['alt']>([
  'Latest provider workspace view',
  'Latest provider browser view',
])
const PROVIDER_ARTIFACT_DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/
const MAX_PROVIDER_ARTIFACT_DATA_URL_LENGTH = 262_144

export function providerPermissionLabel(mode: ProviderInvocationUI['permissionMode']) {
  return mode === 'auto_approve'
    ? modeLabels.auto
    : mode === 'full_access'
      ? modeLabels['full-access']
      : modeLabels['read-only']
}

export function providerPermissionBoundary(
  mode: ProviderInvocationUI['permissionMode'],
  status?: ProviderInvocationUI['status'],
) {
  if (status === 'completed') {
    return 'No further action is needed. Return to the conversation to continue.'
  }
  if (status === 'failed') {
    return 'The run needs attention. Return to the conversation to retry or add context.'
  }
  if (status === 'cancelled') {
    return 'This provider run has stopped. Return to the conversation to continue.'
  }
  if (status === 'awaiting_approval') {
    return 'Review this request before the provider can continue.'
  }
  return mode === 'auto_approve'
    ? 'Workspace actions are automatic; broader requests still need review.'
    : mode === 'full_access'
      ? 'This run has the Host-approved full-access boundary.'
      : 'Read-only mode asks before the provider can make a scoped change.'
}

export function allProviderActivities(
  invocation: ProviderInvocationUI,
  continuations: ProviderInvocationUI[] = [],
) {
  const activities: ProviderActivity[] = []
  for (const item of [invocation, ...continuations]) {
    for (const activity of item.activities) {
      const index = activities.findIndex(candidate => candidate.id === activity.id)
      if (index < 0) {
        activities.push(activity)
      } else if (activity.legacy === false) {
        // A typed OIP activity is the authoritative, redacted representation of
        // the same native step. Never keep the generic raw compatibility item.
        activities[index] = activity
      }
    }
  }
  return activities
}

export function latestProviderActivity(
  invocation: ProviderInvocationUI,
  continuations: ProviderInvocationUI[] = [],
) {
  return allProviderActivities(invocation, continuations).at(-1)
}

/** Evidence for this completed result, never an inventory inferred from prose. */
export function completedProviderFiles(invocation: ProviderInvocationUI): string[] {
  if (invocation.status !== 'completed') return []
  return [...new Set(invocation.activities
    .filter(activity => activity.legacy === false && activity.kind === 'file_change' && activity.status === 'done')
    .flatMap(activity => activity.files ?? []))]
}

/**
 * The overview may show one completed result only while a later activity is
 * actively running.  This gives a long task useful progress without repeating
 * the current line or dumping its command transcript into the Work Room.
 */
export function latestCompletedProviderActivity(
  invocation: ProviderInvocationUI,
  continuations: ProviderInvocationUI[] = [],
) {
  return allProviderActivities(invocation, continuations)
    .findLast(activity => activity.status === 'done')
}

/**
 * Return visual evidence only when it is a bounded raster capture for the
 * exact lifecycle state currently rendered.  This is deliberately repeated at
 * the UI edge: an older SDK or persisted transcript must never turn arbitrary
 * provider data into an image after it reaches O Chat.
 */
export function currentProviderArtifactPreview(
  invocation: ProviderInvocationUI,
  continuations: ProviderInvocationUI[] = [],
): ProviderArtifactPreview | undefined {
  const current = continuations.at(-1) ?? invocation
  const artifact = current.artifact
  const stateRevision = current.stateRevision
  if (
    !artifact
    || artifact.kind !== 'screenshot'
    || !Number.isSafeInteger(stateRevision)
    || stateRevision === undefined
    || stateRevision < 1
    || artifact.stateRevision !== stateRevision
    || typeof artifact.thumbnailDataUrl !== 'string'
    || artifact.thumbnailDataUrl.length > MAX_PROVIDER_ARTIFACT_DATA_URL_LENGTH
    || !PROVIDER_ARTIFACT_DATA_URL.test(artifact.thumbnailDataUrl)
    || !SAFE_PROVIDER_ARTIFACT_ALTS.has(artifact.alt)
  ) return undefined
  return artifact
}

/** The card and Work Room title: who, and where the run stands, in words.
 *  Never the task text, which may hold a command, path or secret. */
export function providerStatusTitle(status: ProviderInvocationUI['status'], providerDisplayName: string) {
  return status === 'completed' ? `${providerDisplayName} finished`
    : status === 'failed' ? `${providerDisplayName} failed`
      : status === 'cancelled' ? `${providerDisplayName} stopped`
        : status === 'awaiting_approval' ? `${providerDisplayName} needs approval`
          : `${providerDisplayName} is working`
}

function count(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** One line built from structured data only. A live run names its current
 *  step from the Host's fixed step vocabulary; an ended run counts what it
 *  changed: files reported, whether its recorded checks included tests. A
 *  failure keeps the Host's own error, which says what to fix. */
export function providerOutcomeLine(invocation: ProviderInvocationUI, continuations: ProviderInvocationUI[] = []) {
  const current = continuations.at(-1) ?? invocation
  const activities = allProviderActivities(invocation, continuations)
  if (current.status === 'awaiting_approval') return 'Waiting for your decision'
  if (current.status === 'running' || current.status === 'starting') {
    const latest = latestProviderActivity(invocation, continuations)
    return latest ? activitySummary(latest, true) : 'Getting started'
  }
  if (current.status === 'failed' && current.error) return current.error
  const files = new Set(activities.flatMap(activity => activity.files ?? []))
  const tested = current.status === 'completed' && /test checks/.test(current.resultSummary ?? '')
  const parts = [files.size ? `${count(files.size, 'file')} changed` : null, tested ? 'tests passed' : null].filter(Boolean)
  if (parts.length) return parts.join(', ')
  const done = activities.filter(activity => activity.status !== 'running').length
  if (current.status === 'cancelled') return done ? `Stopped after ${count(done, 'step')}` : 'Stopped before any step'
  return done ? `${count(done, 'step')}, no file changes reported` : 'No file changes reported'
}

/** Keep a terminal provider state from looking like a live operation. */
export function providerSnapshotSummary(
  status: ProviderInvocationUI['status'],
  activity: ProviderActivity | undefined,
  currentSummary?: string,
) {
  if (status === 'completed') return currentSummary || 'Completed the work'
  if (status === 'failed') return currentSummary || 'Work stopped before completion'
  if (status === 'cancelled') return currentSummary || 'Work stopped'
  if (status === 'awaiting_approval') return currentSummary || 'Waiting for your approval'
  // Provider invocation fields are an initial state snapshot. Once a typed
  // activity arrives, its finite semantic phase is fresher and more useful
  // than a permanently repeated "Working in the selected workspace" label.
  return activity ? activitySummary(activity, true) : currentSummary || 'Preparing the workroom'
}

/** A short human description; raw commands and outputs stay behind disclosure. */
export function activitySummary(activity: ProviderActivity | undefined, running: boolean) {
  if (!activity) return running ? 'Preparing the workroom' : 'No provider activity recorded'
  if (activity.summary) return activity.summary
  if (activity.title) return activity.title
  const command = typeof activity.args?.command === 'string'
    ? activity.args.command.toLowerCase()
    : ''
  const path = typeof activity.args?.file_path === 'string'
    || typeof activity.args?.path === 'string'
  const name = activity.name?.toLowerCase() || ''
  if (/pytest|vitest|jest|npm test|pnpm test/.test(command)) return 'Running tests'
  const compilesC = /(?:^|\s)(?:cc|gcc|clang)(?:\s|$)/.test(command)
  const runsCSortTests = /(?:^|\s)\.\/(?:test_?sort|sort_test)(?:\s|$)/.test(command)
  if (compilesC && runsCSortTests) return 'Compiling and running C tests'
  if (compilesC) return 'Compiling a C program'
  if (runsCSortTests) return 'Running C tests'
  if (/(?:^|\s)\.\/sort(?:\s|$)/.test(command)) return 'Running the sorting program'
  if (/python|py_compile/.test(command)) return 'Running a Python check'
  if (/git diff|git status|rg |grep |find |cat |sed |head |tail /.test(command)) return 'Inspecting the workspace'
  if (path || /file|edit|write|patch/.test(name)) return 'Updating files'
  if (/search|browse|web/.test(name)) return 'Researching context'
  if (activity.status === 'running') return 'Working on the next step'
  return 'Completed a work step'
}

export function activityRawDetails(activity: ProviderActivity) {
  return activity.legacy
    ? 'Legacy activity did not provide safe technical details.'
    : 'No additional technical details were provided.'
}
