/** Native provider OIP events render as one calm, evidence-based Work Room. */

import { type Page } from '@playwright/test'
import { test, expect, pane } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE, type Scenario } from './mock-agent'

const taskTitle = 'Build and verify the requested C program'
const rawInstruction = 'Work inside /private/tmp/codex-workroom. Create sort.c and test_sort.c, compile with cc -std=c11 -Wall -Wextra -Werror, run sorting fixtures, inspect the output, and report the raw command transcript.'

async function openCodingRun(
  page: Page,
  scenario: Extract<Scenario, 'coding-agent' | 'coding-agent-completed' | 'coding-agent-failed' | 'coding-agent-long-approval' | 'coding-agent-stale-approval' | 'coding-agent-stop-ack-no-terminal' | 'coding-agent-stop-no-ack' | 'coding-agent-stop-delayed-ack' | 'coding-agent-stop-fresh-state' | 'coding-agent-stop-rejected'> = 'coding-agent',
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
    // The first local route compilation can exceed the default short UI wait.
    // A real preview is already built; this keeps the evidence test from
    // confusing a cold dev server with a missing OIP state.
    timeout: 60_000,
  })
  return agent
}

function workroom(page: Page) {
  return page.getByRole('dialog', { name: taskTitle })
}

test('a long native Codex run stays calm in the transcript and defaults to one current evidence item', async ({ page, shot }) => {
  test.setTimeout(120_000)
  const updateDepthErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('Maximum update depth exceeded')) {
      updateDepthErrors.push(message.text())
    }
  })
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
  await expect(room.getByRole('heading', { name: taskTitle, exact: true })).toBeInViewport()
  const current = room.getByLabel('Current provider status')
  await expect(current).toContainText('Inspecting workspace context')
  await expect(current).toContainText('Last completed: Run the requested tests')
  await expect(current).not.toContainText('Latest: Inspect the workspace')
  await expect(current).not.toContainText('Update workspace files')
  await expect(room).not.toContainText('sort.c')
  await expect(room).not.toContainText('test_sort.c')
  await expect(room).not.toContainText(rawInstruction)
  await expect(room.locator('pre, details')).toHaveCount(0)
  await expect(room.getByLabel('Codex conversation')).toHaveCount(0)
  await expect(room.getByLabel('Message Codex directly')).toBeVisible()
  await expect(room.getByLabel('Message Codex directly')).toBeInViewport()
  await shot('codex-c-sort-workroom-overview-desktop')
  await expect.poll(() => updateDepthErrors).toEqual([])
})

test('a Work Room message stays in the native Codex conversation', async ({ page, shot }) => {
  const agent = await openCodingRun(page)
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)
  const inputCountBefore = agent.sent('INPUT').length

  const composer = room.getByLabel('Message Codex directly')
  await composer.fill('Please add a reverse-order fixture, then run the tests again.')
  await composer.press('Enter')

  await expect.poll(() => agent.sent('PROVIDER_INPUT')).toContainEqual(
    expect.objectContaining({
      invocationId: 'codex:call-7',
      text: 'Please add a reverse-order fixture, then run the tests again.',
    }),
  )
  await expect(room.getByLabel('Codex conversation')).toContainText(
    'Please add a reverse-order fixture, then run the tests again.',
  )
  await expect(room.getByLabel('Codex conversation')).toContainText(
    'I added the reverse-order fixture and the recorded tests still pass.',
  )
  expect(agent.sent('INPUT')).toHaveLength(inputCountBefore)
  await expect(room).not.toContainText('cc -std=c11')
  await shot('codex-c-sort-workroom-direct-message-desktop')
})

test('activity history uses one page scroll and reveals older semantic evidence intentionally', async ({ page, shot }) => {
  await openCodingRun(page)
  await pane(page).getByRole('region', { name: 'Codex Working' }).getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  await room.getByRole('button', { name: 'Show activity history (7)' }).click()
  const activity = room.getByLabel('Earlier provider activity')
  await expect(activity.locator('li')).toHaveCount(5)
  await expect(activity).toContainText('Run the requested tests')
  await expect(activity).toContainText('Update workspace files')
  await expect(activity).toContainText('3 recorded checks')
  await expect(activity).toContainText('Repeated activity is grouped for readability.')
  await expect(activity.locator('ol')).not.toHaveClass(/overflow-y-auto/)

  await expect(activity).not.toContainText('/private/tmp/codex-workroom')
  await expect(activity).not.toContainText('cc -std=c11')
  await shot('codex-c-sort-workroom-activity-desktop')
})

test('a verified native approval stays compact on the card and opens its full Work Room detail', async ({ page, shot }) => {
  await openCodingRun(page, 'coding-agent-long-approval', 'Needs your decision')

  const card = pane(page).getByRole('region', { name: 'Codex Needs your decision' })
  const preview = card.getByLabel('Provider approval preview')
  await expect(preview).toContainText('Inspect the workspace')
  await expect(preview).toContainText('This Work Room only')
  await expect(preview).toContainText('Check the requested workspace result before continuing')
  await expect(preview).toContainText('Risk: Limited to this Work Room')
  await expect(preview).not.toContainText('sort.c')
  await expect(preview).not.toContainText(rawInstruction)
  await expect(preview).not.toContainText('cc -std=c11')
  await expect(preview.getByRole('button', { name: 'Allow once' })).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Reject this request' })).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Review details in Work Room' })).toBeVisible()
  await shot('codex-c-sort-approval-card-desktop')

  await preview.getByRole('button', { name: 'Review details in Work Room' }).click()
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
    await room.locator('[aria-label="Work Room decision"], [aria-label="Current provider status"]')
      .evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))),
  ).toEqual(['Work Room decision'])
  await expect(room.getByLabel('Codex conversation')).toHaveCount(0)
  await expect(room.getByLabel('Message Codex directly')).toHaveCount(0)
  await shot('codex-c-sort-approval-workroom-desktop')
})

test('a compact native approval sends one scoped allow and settles the same Work Room decision', async ({ page }) => {
  const agent = await openCodingRun(page, 'coding-agent-long-approval', 'Needs your decision')
  const preview = pane(page).getByRole('region', { name: 'Codex Needs your decision' })
    .getByLabel('Provider approval preview')
  const allow = preview.getByRole('button', { name: 'Allow once' })

  await allow.click()
  await expect.poll(() => agent.sent('APPROVAL_RESPONSE')).toEqual([
    { type: 'APPROVAL_RESPONSE', approved: true, scope: 'once' },
  ])
  // A rapid second tap cannot become a decision for a later provider request.
  await allow.click({ force: true, timeout: 2_000 }).catch(() => {})
  expect(agent.sent('APPROVAL_RESPONSE')).toHaveLength(1)
  await expect(preview).toContainText('Allowed once — continuing…')

  await preview.getByRole('button', { name: 'Review details in Work Room' }).click()
  await expect(workroom(page).getByLabel('Approval required')).toContainText('Allowed once — continuing…')
})

test('a compact native approval sends a scoped rejection', async ({ page }) => {
  const agent = await openCodingRun(page, 'coding-agent-long-approval', 'Needs your decision')
  const preview = pane(page).getByRole('region', { name: 'Codex Needs your decision' })
    .getByLabel('Provider approval preview')

  await preview.getByRole('button', { name: 'Reject this request' }).click()
  await expect.poll(() => agent.sent('APPROVAL_RESPONSE')).toEqual([
    { type: 'APPROVAL_RESPONSE', approved: false, scope: 'once', mode: 'reject_soft' },
  ])
  await expect(preview).toContainText('This request was rejected')
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
  await expect(workroom(page).getByLabel('Current provider status')).toContainText('Completed the provider run after the recorded compilation and test checks')
})

test('Stop targets the current Codex invocation and leaves the outer turn alone', async ({ page }) => {
  const agent = await openCodingRun(page)
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  await room.getByRole('button', { name: 'Pause Codex run' }).click()
  await expect(room).toContainText('The provider stopped')
  await expect(room.locator('[data-tool-status="stopped"]')).toBeVisible()
  expect(agent.sent('PROVIDER_INTERRUPT')).toContainEqual(expect.objectContaining({
    invocationId: 'codex:call-7',
  }))
  expect(agent.sent('INTERRUPT')).toHaveLength(0)
})

test('a Stop request writes a current-tab recovery barrier before the Host can reply', async ({ page }) => {
  await openCodingRun(page, 'coding-agent-stop-delayed-ack')
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  await workroom(page).getByRole('button', { name: 'Pause Codex run' }).click()

  await expect.poll(() => page.evaluate(() => Object.entries(sessionStorage)
    .filter(([key]) => key.startsWith('oo-chat:provider-stop-barrier:'))
    .map(([, value]) => JSON.parse(value) as Array<{ phase?: unknown }>)))
    .toEqual(expect.arrayContaining([
      expect.arrayContaining([
        expect.objectContaining({ phase: expect.stringMatching(/requesting|acknowledged|unconfirmed/) }),
      ]),
    ]))
})

test('an unconfirmed Stop barrier survives refresh when no Host acknowledgement arrives', async ({ page }) => {
  test.setTimeout(120_000)
  await openCodingRun(page, 'coding-agent-stop-no-ack')
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  // No Host acknowledgement is not evidence of a stopped provider. The SDK
  // must preserve its conservative unconfirmed state through a stale replay.
  await room.getByRole('button', { name: 'Pause Codex run' }).click()
  await expect(room).toContainText('Codex · Status needs confirmation', { timeout: 15_000 })
  await page.reload()

  const restoredCard = pane(page).getByRole('region', { name: 'Codex Status needs confirmation' })
  await expect(restoredCard).toBeVisible({ timeout: 60_000 })
  await expect(restoredCard.getByRole('button', { name: 'Review decision' })).toHaveCount(0)
  await expect(page.getByPlaceholder('Answer above')).toHaveCount(0)
})

test('an acknowledged Stop keeps replayed approval hidden until a terminal provider state', async ({ page }) => {
  await openCodingRun(page, 'coding-agent-stop-ack-no-terminal')
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  await room.getByRole('button', { name: 'Pause Codex run' }).click()
  await expect(room.getByText('Waiting for Codex to confirm the stop.')).toBeVisible()
  await expect(room).toContainText('Codex · Stopping')
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
  await expect(workroom(page).getByText('Waiting for Codex to confirm the stop.')).toBeVisible()
  await expect(workroom(page).getByRole('button', { name: 'Pause Codex run' })).toBeDisabled()
})

test('an acknowledged Stop barrier survives a full refresh before a stale provider replay', async ({ page }) => {
  test.setTimeout(120_000)
  await openCodingRun(page, 'coding-agent-stop-ack-no-terminal')
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  await room.getByRole('button', { name: 'Pause Codex run' }).click()
  await expect(room.getByText('Waiting for Codex to confirm the stop.')).toBeVisible()

  await page.reload()

  const restoredCard = pane(page).getByRole('region', { name: 'Codex Stop requested' })
  await expect(restoredCard).toBeVisible({ timeout: 60_000 })
  await expect(restoredCard.getByRole('button', { name: 'Review decision' })).toHaveCount(0)
  await expect(page.getByPlaceholder('Answer above')).toHaveCount(0)
  await restoredCard.getByRole('button', { name: 'Open Work Room' }).click()
  const restoredRoom = workroom(page)
  await expect(restoredRoom.getByLabel('Approval required')).toHaveCount(0)
  await expect(restoredRoom.getByText('Waiting for Codex to confirm the stop.')).toBeVisible()
})

test('a damaged current-tab Stop barrier never reopens a replayed Codex approval', async ({ page }) => {
  await openCodingRun(page, 'coding-agent-stop-ack-no-terminal')
  // A browser extension or quota error can damage this small current-tab
  // record. Use the actual route session ID, then make the Host replay its
  // old approval on reconnect.
  await page.evaluate(({ agentAddress }) => {
    const sessionId = location.pathname.split('/').filter(Boolean).at(-1)
    if (!sessionId) throw new Error('Expected a routed session ID')
    const key = `oo-chat:provider-stop-barrier:${encodeURIComponent(agentAddress)}:${encodeURIComponent(sessionId)}`
    sessionStorage.setItem(key, '{not valid json')
  }, { agentAddress: AGENT_ADDRESS })

  await page.reload()

  const restoredCard = pane(page).getByRole('region', { name: 'Codex Status needs confirmation' })
  await expect(restoredCard).toBeVisible({ timeout: 60_000 })
  await expect(restoredCard.getByRole('button', { name: 'Review decision' })).toHaveCount(0)
  await expect(page.getByPlaceholder('Answer above')).toHaveCount(0)
  await restoredCard.getByRole('button', { name: 'Open Work Room' }).click()
  const restoredRoom = workroom(page)
  await expect(restoredRoom.getByRole('alert')).toContainText(
    'The provider state needs confirmation before any action can be taken.',
  )
  await expect(restoredRoom.getByLabel('Approval required')).toHaveCount(0)
  await expect(restoredRoom.getByRole('button', { name: 'Pause Codex run' })).toHaveCount(0)
})

test('a newer correlated provider state releases the Stop barrier without accepting replay', async ({ page, shot }) => {
  await openCodingRun(page, 'coding-agent-stop-fresh-state')
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  await room.getByRole('button', { name: 'Pause Codex run' }).click()
  const approval = room.getByLabel('Approval required')
  await expect(approval).toBeVisible()
  await expect(room).toContainText('Codex · Needs your decision')
  await expect(approval.getByRole('button', { name: 'Allow once' })).toBeVisible()
  await expect(room.getByRole('button', { name: 'Pause Codex run' })).toHaveCount(0)
  await shot('codex-c-sort-stop-fresh-state-desktop')
})

test('a slow Host acknowledgement keeps every Stop signal in the requesting state', async ({ page, shot }) => {
  await openCodingRun(page, 'coding-agent-stop-delayed-ack')
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  await room.getByRole('button', { name: 'Pause Codex run' }).click()
  await expect(room.getByText('Codex · Stopping', { exact: true })).toBeVisible()
  await expect(room.getByRole('button', { name: 'Pause Codex run' })).toBeDisabled()
  await expect(room.getByRole('status')).toContainText('Waiting for Host confirmation.')
  await shot('codex-c-sort-stop-requesting-desktop')

  await expect(room.getByText('Waiting for Codex to confirm the stop.')).toBeVisible()
  await expect(room.getByText('Codex · Stopping', { exact: true })).toBeVisible()
})

test('a rejected Stop acknowledgement marks the provider state as unconfirmed', async ({ page, shot }) => {
  await openCodingRun(page, 'coding-agent-stop-rejected')
  const card = pane(page).getByRole('region', { name: 'Codex Working' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = workroom(page)

  const stop = room.getByRole('button', { name: 'Pause Codex run' })
  await stop.click()

  await expect(room.getByRole('alert')).toContainText('The Host could not confirm the current provider state.')
  await expect(room).toContainText('Codex · Status needs confirmation')
  // An ambiguous Stop must not keep a stale "working" sentence on screen.
  // The only retained progress is the last known completed semantic result.
  await expect(room.getByLabel('Current provider status')).toContainText('Last completed: Run the requested tests')
  await expect(room.getByLabel('Current provider status')).not.toContainText('Inspecting workspace context')
  await expect(room.getByLabel('Current provider status')).not.toContainText('decision needed')
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
  await expect(workroom(page).getByRole('button', { name: 'Pause Codex run' })).toHaveCount(0)
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
    await expect(room.getByRole('button', { name: 'Pause Codex run' })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      'Work Room scrolls sideways on a phone',
    ).toBeLessThanOrEqual(0)
    await shot('codex-c-sort-workroom-phone')
  })

  test('the compact native approval stays readable and reachable at 375px', async ({ page, shot }) => {
    await openCodingRun(page, 'coding-agent-long-approval', 'Needs your decision')
    const card = pane(page).getByRole('region', { name: 'Codex Needs your decision' })
    const preview = card.getByLabel('Provider approval preview')
    const cardAllow = preview.getByRole('button', { name: 'Allow once' })
    const cardReject = preview.getByRole('button', { name: 'Reject this request' })
    await expect(cardAllow).toBeVisible()
    await expect(cardReject).toBeVisible()
    expect((await cardAllow.boundingBox())?.height, 'card allow action is too small to tap').toBeGreaterThanOrEqual(44)
    expect((await cardReject.boundingBox())?.height, 'card rejection action is too small to tap').toBeGreaterThanOrEqual(44)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      'compact approval scrolls sideways on a phone',
    ).toBeLessThanOrEqual(0)
    await shot('codex-c-sort-approval-card-phone')

    await preview.getByRole('button', { name: 'Review details in Work Room' }).click()
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
    const preview = pane(page).getByRole('region', { name: 'Codex Needs your decision' })
      .getByLabel('Provider approval preview')
    await expect(preview.getByRole('button', { name: 'Allow once' })).toBeVisible()
    await expect(preview.getByRole('button', { name: 'Reject this request' })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      'compact approval scrolls sideways at 320px',
    ).toBeLessThanOrEqual(0)
    await preview.getByRole('button', { name: 'Review details in Work Room' }).click()
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
