/** Native provider OIP events render as one calm, evidence-based Work Room. */

import { type Page } from '@playwright/test'
import { test, expect, pane } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE, type Scenario } from './mock-agent'

const taskTitle = 'Build and verify the requested C program'
const rawInstruction = 'Work inside /private/tmp/codex-workroom. Create sort.c and test_sort.c, compile with cc -std=c11 -Wall -Wextra -Werror, run sorting fixtures, inspect the output, and report the raw command transcript.'

async function openCodingRun(
  page: Page,
  scenario: Extract<Scenario, 'coding-agent' | 'coding-agent-completed' | 'coding-agent-failed' | 'coding-agent-long-approval' | 'coding-agent-stale-approval' | 'coding-agent-stop-ack-no-terminal' | 'coding-agent-stop-delayed-ack' | 'coding-agent-stop-fresh-state' | 'coding-agent-stop-rejected'> = 'coding-agent',
  status: 'Working' | 'Completed' | 'Needs attention' | 'Needs your decision' = 'Working',
) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'oo-chat-storage',
      JSON.stringify({ state: { conversations: [], agents: [] }, version: 0 }),
    )
  })
  const agent = await mockAgent(page, scenario)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(pane(page).getByRole('region', { name: `Codex ${status}` })).toBeVisible({
    timeout: 15_000,
  })
  return agent
}

function workroom(page: Page) {
  return page.getByRole('dialog', { name: taskTitle })
}

test('a long native Codex run stays calm in the transcript and defaults to one current evidence item', async ({ page, shot }) => {
  await openCodingRun(page)

  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await expect(card).toContainText(taskTitle)
  await expect(card).toContainText('Inspecting workspace context')
  await expect(card).not.toContainText(rawInstruction)
  await expect(card).not.toContainText('/private/tmp/codex-workroom')
  await expect(card).not.toContainText('cc -std=c11')
  await expect(card.locator('pre, details')).toHaveCount(0)
  await expect(card.getByRole('button')).toHaveCount(1)
  await expect(card.getByRole('button', { name: 'Open Work Room' })).toBeVisible()
  await shot('codex-c-sort-card-desktop')

  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)
  await expect(room).toBeVisible()
  const progress = room.getByLabel('Work Room progress')
  await expect(progress).toContainText('7 of 8 steps completed')
  await expect(progress).toContainText('Inspecting workspace context')
  await expect(progress).not.toContainText('Run the requested tests')
  await expect(progress).not.toContainText('Update workspace files')
  await expect(room.getByLabel('Latest completed step')).toContainText('Completed the requested tests')
  await expect(room).not.toContainText('sort.c')
  await expect(room).not.toContainText('test_sort.c')
  await expect(room).not.toContainText(rawInstruction)
  await expect(room.locator('pre, details, textarea')).toHaveCount(0)
  await shot('codex-c-sort-workroom-overview-desktop')
})

test('activity history uses one page scroll and reveals older semantic evidence intentionally', async ({ page, shot }) => {
  await openCodingRun(page)
  await pane(page).getByRole('region', { name: 'Codex Working' }).getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  await room.getByRole('button', { name: 'Show activity history (8 steps)' }).click()
  const activity = room.getByLabel('All provider activity')
  await expect(activity.locator('li')).toHaveCount(6)
  await expect(activity).toContainText('Run the requested tests')
  await expect(activity).toContainText('Update workspace files')
  await expect(activity).toContainText('3 recorded checks')
  await expect(activity).toContainText('Repeated activity is grouped for readability.')
  await expect(activity.locator('ol')).not.toHaveClass(/overflow-y-auto/)

  await expect(activity).not.toContainText('/private/tmp/codex-workroom')
  await expect(activity).not.toContainText('cc -std=c11')
  await shot('codex-c-sort-workroom-activity-desktop')
})

test('a native approval is inside Work Room and exposes only a narrow decision', async ({ page, shot }) => {
  await openCodingRun(page, 'coding-agent-long-approval', 'Needs your decision')

  const card = pane(page).getByRole('region', { name: 'Codex Needs your decision' })
  await expect(card).toContainText('Your decision is needed in the Work Room.')
  await expect(card).not.toContainText('Run the final sorting verification')
  await expect(card).not.toContainText(rawInstruction)
  await expect(card.getByRole('button', { name: 'Review decision' })).toBeVisible()
  await shot('codex-c-sort-approval-card-desktop')

  await card.getByRole('button', { name: 'Review decision' }).click()
  const room = workroom(page)
  const approval = room.getByLabel('Approval required')
  await expect(approval).toContainText('Inspect the workspace')
  await expect(approval).toContainText('This Work Room only')
  await expect(approval).toContainText('Check the requested workspace result before continuing')
  await expect(approval).toContainText('sort.c, test_sort.c')
  await expect(approval).not.toContainText(rawInstruction)
  await expect(approval).not.toContainText('cc -std=c11')
  await expect(approval.getByRole('button', { name: 'Allow once' })).toBeVisible()
  await expect(approval.getByText('Trust this Work Room for the session')).toHaveCount(0)
  expect(
    await room.locator('[aria-label="Work Room decision"], [aria-label="Work Room progress"]')
      .evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))),
  ).toEqual(['Work Room decision', 'Work Room progress'])
  await shot('codex-c-sort-approval-workroom-desktop')
})

test('a native approval envelope does not interrupt a still-working Codex run', async ({ page }) => {
  await openCodingRun(page, 'coding-agent-stale-approval')

  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await expect(card).toContainText('Inspecting workspace context')
  await expect(card.getByRole('button', { name: 'Review decision' })).toHaveCount(0)
  await expect(page.getByPlaceholder('Answer above')).toHaveCount(0)
  await expect(page.getByPlaceholder('Send a message...')).toBeVisible()
  await expect(pane(page).locator('[data-pending-decision]')).toHaveCount(0)
})

test('a completed run receives an honest terminal summary', async ({ page }) => {
  await openCodingRun(page, 'coding-agent-completed', 'Completed')
  const completed = pane(page).getByRole('region', { name: 'Codex Completed' })
  await expect(completed).toContainText('Completed the provider run after the recorded compilation and test checks')
  await completed.getByRole('button', { name: 'Open Work Room' }).click()
  await expect(workroom(page).getByLabel('Work Room progress')).toContainText('Completed the provider run after the recorded compilation and test checks')
})

test('Stop targets the current Codex invocation and leaves the outer turn alone', async ({ page }) => {
  const agent = await openCodingRun(page)
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  await room.getByRole('button', { name: 'Stop Codex run' }).click()
  await expect(room).toContainText('The provider stopped')
  await expect(room.locator('[data-tool-status="stopped"]')).toBeVisible()
  expect(agent.sent('PROVIDER_INTERRUPT')).toContainEqual(expect.objectContaining({
    invocationId: 'codex:call-7',
  }))
  expect(agent.sent('INTERRUPT')).toHaveLength(0)
})

test('an acknowledged Stop keeps replayed approval hidden until a terminal provider state', async ({ page }) => {
  await openCodingRun(page, 'coding-agent-stop-ack-no-terminal')
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  await room.getByRole('button', { name: 'Stop Codex run' }).click()
  await expect(room.getByText('Stop requested. Waiting for Codex to confirm.')).toBeVisible()
  await expect(room).toContainText('Codex · Stop requested')
  await expect(room.getByLabel('Approval required')).toHaveCount(0)
  await expect(room.getByLabel('Permission boundary')).toHaveCount(0)
  await expect(page.getByPlaceholder('Answer above')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Stop agent' })).toHaveCount(0)
  await expect(page.getByPlaceholder('Send a message...')).toBeVisible()
  await room.getByRole('button', { name: 'Back to conversation' }).click()
  const acknowledgedCard = pane(page).getByRole('region', { name: 'Codex Stop requested' })
  await expect(acknowledgedCard).toContainText('Waiting for Codex to confirm the stop request')
  await expect(page.getByRole('button', { name: 'Stop agent' })).toHaveCount(0)
  await expect(page.locator('[data-agent-thinking="active"]')).toHaveCount(0)
  await acknowledgedCard.getByRole('button', { name: 'Open Work Room' }).click()
  await expect(workroom(page).getByRole('alert')).toHaveCount(0)
  await expect(workroom(page).getByText('Stop requested. Waiting for Codex to confirm.')).toBeVisible()
  await expect(workroom(page).getByRole('button', { name: 'Stop Codex run' })).toBeDisabled()
})

test('a newer correlated provider state releases the Stop barrier without accepting replay', async ({ page, shot }) => {
  await openCodingRun(page, 'coding-agent-stop-fresh-state')
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  await room.getByRole('button', { name: 'Stop Codex run' }).click()
  const approval = room.getByLabel('Approval required')
  await expect(approval).toBeVisible()
  await expect(room).toContainText('Codex · Needs your decision')
  await expect(approval.getByRole('button', { name: 'Allow once' })).toBeVisible()
  await expect(room.getByRole('button', { name: 'Stop Codex run' })).toHaveCount(0)
  await shot('codex-c-sort-stop-fresh-state-desktop')
})

test('a slow Host acknowledgement keeps every Stop signal in the requesting state', async ({ page, shot }) => {
  await openCodingRun(page, 'coding-agent-stop-delayed-ack')
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  await room.getByRole('button', { name: 'Stop Codex run' }).click()
  await expect(room.getByText('Codex · Requesting stop', { exact: true })).toBeVisible()
  await expect(room.getByRole('button', { name: 'Stop Codex run' })).toBeDisabled()
  await expect(room.getByRole('status')).toContainText('Requesting Host confirmation for the stop.')
  await shot('codex-c-sort-stop-requesting-desktop')

  await expect(room.getByText('Stop requested. Waiting for Codex to confirm.')).toBeVisible()
  await expect(room.getByText('Codex · Stop requested', { exact: true })).toBeVisible()
})

test('a rejected Stop acknowledgement marks the provider state as unconfirmed', async ({ page, shot }) => {
  await openCodingRun(page, 'coding-agent-stop-rejected')
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  const stop = room.getByRole('button', { name: 'Stop Codex run' })
  await stop.click()

  await expect(room.getByRole('alert')).toContainText('The Host could not confirm the current provider state.')
  await expect(room).toContainText('Codex · Status needs confirmation')
  await expect(room.getByLabel('Work Room progress')).toContainText('Last reported: 7 of 8 steps completed')
  await expect(room.getByLabel('Work Room progress')).not.toContainText('decision needed')
  await expect(page.getByPlaceholder('Answer above')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Stop agent' })).toHaveCount(0)
  await expect(page.getByPlaceholder('Send a message...')).toBeVisible()
  await expect(room.getByRole('button', { name: 'Return to conversation' })).toBeVisible()
  await expect(stop).toHaveCount(0)
  await room.getByRole('button', { name: 'Return to conversation' }).click()
  const unconfirmedCard = pane(page).getByRole('region', { name: 'Codex Status needs confirmation' })
  await expect(unconfirmedCard).toContainText('Codex · Status needs confirmation')
  await expect(page.getByRole('button', { name: 'Stop agent' })).toHaveCount(0)
  await expect(page.locator('[data-agent-thinking="active"]')).toHaveCount(0)
  await unconfirmedCard.getByRole('button', { name: 'Open Work Room' }).click()
  await expect(workroom(page).getByRole('alert')).toContainText('The Host could not confirm the current provider state.')
  await expect(workroom(page).getByRole('button', { name: 'Stop Codex run' })).toHaveCount(0)
  await shot('codex-c-sort-stop-rejected-desktop')
})

test('a failed run receives an honest terminal summary', async ({ page }) => {
  await openCodingRun(page, 'coding-agent-failed', 'Needs attention')
  const failed = pane(page).getByRole('region', { name: 'Codex Needs attention' })
  await expect(failed).toContainText('The provider reported an error')
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('the compact card and one-scroll Work Room do not overflow horizontally', async ({ page, shot }) => {
    await openCodingRun(page)
    const card = pane(page).getByRole('region', { name: 'Codex Working' })
    await expect(card).toBeInViewport()
    await expect(card).not.toContainText(rawInstruction)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      'provider card scrolls sideways on a phone',
    ).toBeLessThanOrEqual(0)
    await shot('codex-c-sort-card-phone')

    await card.getByRole('button', { name: 'Open Work Room' }).click()
    const room = workroom(page)
    await expect(room).toBeVisible()
    await expect(room.getByRole('heading', { name: taskTitle })).toBeVisible()
    await expect(room.getByRole('button', { name: 'Stop Codex run' })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      'Work Room scrolls sideways on a phone',
    ).toBeLessThanOrEqual(0)
    await shot('codex-c-sort-workroom-phone')
  })

  test('the native approval remains readable and reachable at 375px', async ({ page, shot }) => {
    await openCodingRun(page, 'coding-agent-long-approval', 'Needs your decision')
    const card = pane(page).getByRole('region', { name: 'Codex Needs your decision' })
    await card.getByRole('button', { name: 'Review decision' }).click()
    const approval = workroom(page).getByLabel('Approval required')
    const allow = approval.getByRole('button', { name: 'Allow once' })

    await expect(allow).toBeVisible()
    const reject = approval.getByRole('button', { name: 'Reject this request' })
    await expect(reject).toBeVisible()
    const bounds = await allow.boundingBox()
    expect(bounds?.height, 'approval action is too small to tap').toBeGreaterThanOrEqual(44)
    const rejectBounds = await reject.boundingBox()
    expect(rejectBounds?.height, 'rejection action is too small to tap').toBeGreaterThanOrEqual(44)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      'approval scrolls sideways on a phone',
    ).toBeLessThanOrEqual(0)
    await shot('codex-c-sort-approval-workroom-phone')
  })

  test('the native approval does not overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await openCodingRun(page, 'coding-agent-long-approval', 'Needs your decision')
    await pane(page).getByRole('region', { name: 'Codex Needs your decision' })
      .getByRole('button', { name: 'Review decision' }).click()
    const approval = workroom(page).getByLabel('Approval required')

    const allow = approval.getByRole('button', { name: 'Allow once' })
    await expect(allow).toBeVisible()
    const bounds = await allow.boundingBox()
    expect(bounds?.y, 'approval action begins below the 320px first screen').toBeLessThan(640)
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0), 'approval action is clipped below the 320px first screen')
      .toBeLessThanOrEqual(640)
    const reject = approval.getByRole('button', { name: 'Reject this request' })
    const rejectBounds = await reject.boundingBox()
    expect(rejectBounds?.y, 'rejection action begins below the 320px first screen').toBeLessThan(640)
    expect((rejectBounds?.y ?? 0) + (rejectBounds?.height ?? 0), 'rejection action is clipped below the 320px first screen')
      .toBeLessThanOrEqual(640)
    expect(rejectBounds?.height, 'rejection action is too small to tap').toBeGreaterThanOrEqual(44)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      '320px approval scrolls sideways',
    ).toBeLessThanOrEqual(0)
  })
})
