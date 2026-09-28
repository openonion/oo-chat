import { readFileSync } from 'node:fs'
import { test, expect, selectMode } from './fixtures'
import { AGENT_ADDRESS, mockAgent, type Scenario } from './mock-agent'

const baseline = process.env.E2E_DENSITY_BASELINE === '1'
async function openSession(page: import('@playwright/test').Page, scenario: Scenario) {
  await page.addInitScript(address => localStorage.setItem('oo-chat-storage', JSON.stringify({
    state: { conversations: [{ sessionId: 'e2e-session', title: 'Prepare the release CLI', agentAddress: address, createdAt: new Date(0).toISOString() }], activeSessionId: 'e2e-session', agents: [address] }, version: 0,
  })), AGENT_ADDRESS)
  await mockAgent(page, scenario)
  await page.goto(`/${AGENT_ADDRESS}/e2e-session`)
}

for (const viewport of [{ width: 390, height: 667 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
  test(`completed work has a clear reading surface at ${viewport.width}x${viewport.height}`, async ({ page, shot }) => {
    await page.setViewportSize(viewport)
    await openSession(page, 'density-review')
    await page.getByPlaceholder(/message/i).fill('Build and verify the release CLI with tests and a README.')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Your release CLI is ready' })).toBeVisible()
    await selectMode(page, 'Full access')
    await page.getByRole('button', { name: 'Enable', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Mode: Full access/ })).toBeVisible()
    await page.getByPlaceholder(/message/i).blur()
    if (!baseline) {
      await expect(page.locator('[aria-label="Current Todo List"]')).toBeHidden()
      await expect(page.locator('summary', { hasText: 'Task details · 12 completed steps' })).toHaveCount(1)
      await expect(page.getByRole('heading', { name: 'Your release CLI is ready' })).toBeInViewport()
      await expect(page.getByText('Created rust-release-agent and verified its output.', { exact: false })).toBeInViewport()
      await expect(page.getByRole('button', { name: 'Exit Full access' })).toBeInViewport()
      await expect(page.getByRole('button', { name: /Latest: scroll/ })).toHaveCount(0)
      await expect(page.getByText('No other project files were changed.', { exact: false })).toBeInViewport()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
      if (viewport.width >= 1024) {
        await expect(page.locator('iframe')).toBeHidden()
        await expect(page.getByRole('button', { name: 'Open Control Center' })).toBeVisible()
      }
    }
    await shot('completed')
    if (baseline) return
    const activity = page.locator('details').filter({ has: page.locator('summary', { hasText: '12 completed steps' }) })
    await activity.locator(':scope > summary').click()
    const plan = page.getByRole('complementary', { name: 'Current Todo List' })
    await expect(plan).toBeVisible()
    expect((await plan.boundingBox())!.height).toBeLessThanOrEqual(52)
    await plan.locator('summary').focus()
    await page.keyboard.press('Enter')
    await expect(plan.getByRole('list')).toBeVisible()
    await expect(plan.getByText('High priority', { exact: false })).toBeVisible()
    await plan.locator('summary').press('Enter')
    await expect(activity.getByText('Inspect project files', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Exit Full access' }).click()
    await expect(page.getByRole('button', { name: 'Mode: Auto', exact: true })).toBeVisible()
    if (viewport.width >= 1024) {
      await page.getByRole('button', { name: 'Open Control Center' }).click()
      await expect(page.locator('iframe')).toBeVisible()
      await page.locator('header').getByRole('button', { name: 'Collapse Control Center' }).click()
      await expect(page.locator('iframe')).toBeHidden()
    }
  })
}

for (const width of [390, 1440]) {
  test(`Work Room prioritises the result at ${width}px`, async ({ page, shot }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await openSession(page, 'coding-agent-completed')
    await page.getByPlaceholder(/message/i).fill('Review the completed C project')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Open Work Room', exact: true }).click()
    const room = page.getByRole('dialog', { name: 'Build and verify the requested C program', exact: true })
    await expect(room).toBeVisible()
    if (!baseline) {
      await expect(room.getByText('Strict compilation and all requested tests passed.', { exact: true })).toBeInViewport()
      await expect(room.getByLabel('Message Codex directly')).toBeInViewport()
      await expect(room.locator('summary', { hasText: 'Task details' })).toBeVisible()
      await expect(room.getByRole('region', { name: 'Your request', exact: true })).toBeHidden()
      await expect(room.getByRole('region', { name: 'Reported file changes' }).getByText('sort.c', { exact: true })).toBeInViewport()
      await expect(room.getByRole('region', { name: 'Reported file changes' }).getByText('test_sort.c', { exact: true })).toBeInViewport()
    }
    const liveState = await page.evaluate<{ userContextAvailable: boolean; currentStatusPresent: boolean }>('(' + readFileSync('e2e/live/query-provider-workroom.js', 'utf8') + ')({provider: "Codex"})')
    expect(liveState.userContextAvailable).toBe(true)
    expect(liveState.currentStatusPresent).toBe(true)
    await shot('completed-workroom')
    if (baseline) return
    await room.locator('summary', { hasText: 'Task details' }).click()
    await expect(room.getByText('Report the files created, tests run, and how to use the result.', { exact: false }).last()).toBeVisible()
  })
}

test('a completed result that grows under the same message ID keeps its beginning readable', async ({ page, shot }) => {
  await page.setViewportSize({ width: 390, height: 667 })
  await openSession(page, 'density-stream')
  await page.getByPlaceholder(/message/i).fill('Build the release CLI')
  await page.keyboard.press('Enter')
  await expect(page.getByText('No other project files were changed.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stop agent' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Your release CLI is ready' })).toBeInViewport()
  await expect(page.getByText('Created rust-release-agent and verified its output.', { exact: false })).toBeInViewport()
  await shot('streamed-result')
})

test.describe('touch composition', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('task context, permissions and history remain usable by touch', async ({ page, shot }) => {
    await openSession(page, 'coding-agent-completed')
    await page.getByPlaceholder(/message/i).fill('Review the completed C project')
    await page.getByRole('button', { name: 'Send message', exact: true }).tap()
    await page.getByRole('button', { name: 'Open Work Room', exact: true }).tap()
    const room = page.getByRole('dialog', { name: 'Build and verify the requested C program', exact: true })
    await expect(room.getByRole('heading', { name: 'Build and verify the requested C program', exact: true })).toBeInViewport()
    const permission = room.getByRole('button', { name: 'Provider permissions: Ask for approval' })
    await permission.tap()
    await expect(room.getByRole('menu', { name: 'Codex permission profiles' })).toBeInViewport()
    await permission.tap()
    await expect(room.getByText('Enter sends · Shift+Enter adds a line')).toBeHidden()
    await shot('touch-result')
    await room.locator('summary', { hasText: 'Task details' }).tap()
    await expect(room.getByRole('region', { name: 'Your request', exact: true })).toBeVisible()
    await expect(room.getByRole('region', { name: 'Earlier conversation', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})

test('reading a completed result still offers Latest when returning to older history', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 })
  await openSession(page, 'density-review')
  await page.getByPlaceholder(/message/i).fill([
    'Build the release CLI with these requirements:',
    'Accept a release version and report it as JSON.',
    'Validate missing arguments and malformed versions.',
    'Include tests for successful and failed input.',
    'Document how to compile, test and run the program.',
    'Keep all generated files in the project folder.',
    'Run the full test suite before reporting the result.',
    'Explain which files changed and how to use the CLI.',
  ].join('\n'))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Your release CLI is ready' })).toBeInViewport()
  const latest = page.getByRole('button', { name: /Latest: scroll/ })
  await expect(latest).toHaveCount(0)
  await page.mouse.move(190, 210)
  await page.mouse.wheel(0, -600)
  await expect(latest).toBeInViewport()
  await latest.click()
  await expect(latest).toHaveCount(0)
  await expect(page.locator('summary', { hasText: 'Task details · 12 completed steps' })).toBeInViewport()
})

test('copying a result preserves its content and reports clipboard failure', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openSession(page, 'density-review')
  await page.getByPlaceholder(/message/i).fill('Build the release CLI')
  await page.keyboard.press('Enter')
  const copy = page.getByRole('button', { name: 'Copy response', exact: true })
  await copy.click()
  await expect(copy).toHaveText('Copied')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('## Your release CLI is ready')
  expect(copied).toContain('Run `cargo run` from the project folder')
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Clipboard unavailable') } })
  await copy.click()
  await expect(copy).toHaveText('Could not copy · Retry')
})

test('a later response offers Latest without dragging a reader away from the completed result', async ({ page, shot }) => {
  await page.setViewportSize({ width: 390, height: 667 })
  await openSession(page, 'density-follow-up')
  await page.getByPlaceholder(/message/i).fill('Build the release CLI')
  await page.keyboard.press('Enter')
  const heading = page.getByRole('heading', { name: 'Your release CLI is ready' })
  await expect(heading).toBeInViewport()
  const latest = page.getByRole('button', { name: /Latest: scroll/ })
  await expect(latest).toHaveCount(0)
  await expect(page.getByText('Additional verification is available.')).toBeVisible()
  await expect(heading).toBeInViewport()
  await expect(latest).toBeInViewport()
  await shot('later-result-unread')
  await latest.click()
  await expect(page.getByText('Additional verification is available.')).toBeInViewport()
  await shot('later-result')
})


for (const viewport of [{ width: 390, height: 667 }, { width: 1440, height: 900 }, { width: 1920, height: 1200 }]) {
  test(`a new task leads the conversation after long history at ${viewport.width}px`, async ({ page, shot }) => {
    await page.setViewportSize(viewport)
    await openSession(page, 'density-next-task')
    const gate = page.getByRole('dialog')
    await gate.getByRole('textbox').fill('PUBLIC-DENSITY-TEST')
    await gate.getByRole('button', { name: /continue/i }).click()
    await expect(page.getByText('Invite accepted', { exact: true })).toBeVisible()
    const composer = page.getByPlaceholder('Send a message...')
    await composer.fill([
      'Build and verify the release CLI.',
      'Accept a release version and report it as JSON.',
      'Validate missing arguments and malformed versions.',
      'Include tests for successful and failed input.',
      'Document how to compile, test and run the program.',
      'Keep all generated files in the project folder.',
      'Run the full test suite before reporting the result.',
      'Explain which files changed and how to use the CLI.',
    ].join('\n'))
    await composer.press('Enter')
    const priorResult = page.getByRole('heading', { name: 'Your release CLI is ready' })
    await expect(priorResult).toBeVisible()
    const nextTask = 'Create a C++20 LRU cache with a capacity of three. Test insert, update, eviction and lookup. Compile with strict warnings, run the tests and report the result. Keep all changes in the new project folder.'
    await composer.fill(nextTask)
    await composer.press('Enter')
    await expect(page.getByRole('button', { name: 'Stop agent' })).toBeVisible()
    await expect(page.locator('[data-agent-thinking="active"]')).toBeInViewport()
    const currentRequest = page.getByRole('log').getByText(nextTask, { exact: true })
    await expect(currentRequest).toBeInViewport()
    if (baseline) {
      await shot('current-task')
      return
    }
    const scroller = page.locator('div.overflow-y-auto.overflow-x-hidden').first()
    await expect.poll(async () => (await currentRequest.boundingBox())!.y - (await scroller.boundingBox())!.y).toBeLessThan(80)
    await expect(priorResult).not.toBeInViewport()
    await expect(page.getByText('Verified — Continuing your request')).toHaveCount(0)
    await expect(page.locator('summary', { hasText: 'Conversation details' })).toHaveCount(0)
    await shot('current-task')
    // Earlier content is ordinary scrollback, still readable in full.
    await priorResult.scrollIntoViewIfNeeded()
    await expect(priorResult).toBeInViewport()
    const latest = page.getByRole('button', { name: /Latest: scroll/ })
    await expect(latest).toBeVisible()
    await latest.click()
    await expect(currentRequest).toBeInViewport()
    await expect(priorResult).not.toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
  })
}
