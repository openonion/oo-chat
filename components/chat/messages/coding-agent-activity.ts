import type { ProviderInvocationUI } from '../types'

export type ProviderActivity = ProviderInvocationUI['activities'][number]

export function providerPermissionLabel(mode: ProviderInvocationUI['permissionMode']) {
  return mode === 'auto_approve'
    ? 'Auto (workspace)'
    : mode === 'full_access'
      ? 'Full access'
      : 'Manual'
}

export function providerPermissionBoundary(mode: ProviderInvocationUI['permissionMode']) {
  return mode === 'auto_approve'
    ? 'Workspace actions are automatic; broader requests still need review.'
    : mode === 'full_access'
      ? 'This run has the Host-approved full-access boundary.'
      : 'Each request needs your review.'
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

/**
 * Provider adapters sometimes send their entire internal instruction as
 * `taskSummary`. That belongs in the explicit Work Room chat, never in the
 * compact conversation card. Keep genuinely short task names useful while
 * falling back to a stable, provider-specific heading for everything else.
 */
export function compactProviderTaskHeading(
  taskTitle: string | undefined,
  taskSummary: string | undefined,
  providerDisplayName: string,
) {
  const title = taskTitle?.replace(/\s+/g, ' ').trim()
  if (title && title.length <= 96) return title
  const summary = taskSummary?.replace(/\s+/g, ' ').trim()
  if (!summary || summary.length > 80) return `${providerDisplayName} work room`
  return summary
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
