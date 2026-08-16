import type { ProviderInvocationUI } from '../types'

export type ProviderActivity = ProviderInvocationUI['activities'][number]

export function allProviderActivities(
  invocation: ProviderInvocationUI,
  continuations: ProviderInvocationUI[] = [],
) {
  return [invocation, ...continuations].flatMap(item => item.activities)
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
  taskSummary: string | undefined,
  providerDisplayName: string,
) {
  const summary = taskSummary?.replace(/\s+/g, ' ').trim()
  if (!summary || summary.length > 80) return `${providerDisplayName} work room`
  return summary
}

/** Keep a terminal provider state from looking like a live operation. */
export function providerSnapshotSummary(
  status: ProviderInvocationUI['status'],
  activity: ProviderActivity | undefined,
) {
  if (status === 'awaiting_approval') return 'Waiting for your approval'
  if (status === 'completed') return 'Completed the work'
  if (status === 'failed') return 'Work stopped before completion'
  if (status === 'cancelled') return 'Work stopped'
  return activitySummary(activity, true)
}

/** A short human description; raw commands and outputs stay behind disclosure. */
export function activitySummary(activity: ProviderActivity | undefined, running: boolean) {
  if (!activity) return running ? 'Preparing the workroom' : 'No provider activity recorded'
  const command = typeof activity.args?.command === 'string'
    ? activity.args.command.toLowerCase()
    : ''
  const path = typeof activity.args?.file_path === 'string'
    || typeof activity.args?.path === 'string'
  const name = activity.name.toLowerCase()
  if (/pytest|vitest|jest|npm test|pnpm test/.test(command)) return 'Running tests'
  if (/python|py_compile/.test(command)) return 'Running a Python check'
  if (/git diff|git status|rg |grep |find /.test(command)) return 'Inspecting the workspace'
  if (path || /file|edit|write|patch/.test(name)) return 'Updating files'
  if (/search|browse|web/.test(name)) return 'Researching context'
  if (activity.status === 'running') return 'Working on the next step'
  return 'Completed a work step'
}

export function activityRawDetails(activity: ProviderActivity) {
  const data = {
    ...(activity.args && { input: activity.args }),
    ...(activity.result && { result: activity.result }),
  }
  return Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : 'No additional details.'
}

export function activityPath(activity: ProviderActivity): string | null {
  const value = activity.args?.file_path ?? activity.args?.path
  return typeof value === 'string' && value ? value : null
}
