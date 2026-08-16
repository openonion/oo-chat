/** Exact React package events render as one usable nested coding-agent card. */

import { type Page } from '@playwright/test'
import { test, expect, pane } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE, type Scenario } from './mock-agent'

async function openCodingRun(
  page: Page,
  scenario: Extract<Scenario, 'coding-agent' | 'coding-agent-completed' | 'coding-agent-failed' | 'coding-agent-long-approval'> = 'coding-agent',
  status: 'running' | 'completed' | 'failed' | 'awaiting approval' = 'running',
) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'oo-chat-storage',
      JSON.stringify({ state: { conversations: [], agents: [] }, version: 0 }),
    )
  })
  await mockAgent(page, scenario)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(pane(page).getByRole('region', { name: `Codex ${status}` })).toBeVisible({
    timeout: 15_000,
  })
}

test('running Codex activity stays nested under one expandable card', async ({ page, shot }) => {
  await openCodingRun(page)

  const card = pane(page).getByRole('region', { name: 'Codex running' })
  await expect(card).toContainText('Fix Windows tests')
  await expect(card).toContainText('running')
  await expect(card.getByRole('button', { name: 'Stop Codex' })).toBeVisible()
  await card.getByRole('button', { expanded: false }).click()
  const activity = card.getByRole('list', { name: 'Codex activity' })
  await expect(activity).toContainText('Running tests')
  await expect(activity.locator('details:not([open])')).toHaveCount(1)
  await activity.locator('summary').click()
  await expect(activity).toContainText('pytest -q')
  await expect(activity).toContainText('89 passed')
  await expect(pane(page).getByRole('region', { name: 'Codex running' })).toHaveCount(1)
  await shot('codex-running-expanded')
})

test('Codex card opens an interactive Work Room with target, queue, activity and files', async ({ page, shot }) => {
  await openCodingRun(page)

  const card = pane(page).getByRole('region', { name: 'Codex running' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = page.getByRole('dialog', { name: 'Codex Work Room' })
  await expect(room).toBeVisible()
  await expect(room).toContainText('Fix Windows tests')

  await room.getByRole('tab', { name: /Chat/ }).click()
  await room.getByPlaceholder('Message Codex…').fill('Also update the changelog')
  await room.getByRole('button', { name: 'Send to Codex' }).click()
  await expect(room).toContainText('Completed #1 by Codex')
  await expect(room).toContainText('Changelog updated.')
  await shot('codex-workroom-chat-desktop')
  await room.getByRole('tab', { name: /Activity/ }).click()
  await expect(room.getByRole('list', { name: 'Codex Work Room activity' })).toContainText('pytest -q')
  await expect(room.getByRole('list', { name: 'Codex Work Room activity' })).toContainText('src/changelog.md')
  await room.getByRole('tab', { name: /Files/ }).click()
  await expect(room).toContainText('src/changelog.md')
  await shot('codex-workroom-desktop')
})

test('Work Room keeps the first result before the resumed request and result', async ({ page }) => {
  await openCodingRun(page, 'coding-agent-completed', 'completed')

  const card = pane(page).getByRole('region', { name: 'Codex completed' })
  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = page.getByRole('dialog', { name: 'Codex Work Room' })
  await room.getByRole('tab', { name: /Chat/ }).click()
  await room.getByPlaceholder('Message Codex…').fill('Also update the changelog')
  await room.getByRole('button', { name: 'Send to Codex' }).click()
  await expect(room).toContainText('Changelog updated.')

  const text = await room.textContent()
  expect(text!.indexOf('Codex fixed the Windows tests.')).toBeLessThan(text!.indexOf('Also update the changelog'))
  expect(text!.indexOf('Also update the changelog')).toBeLessThan(text!.indexOf('Changelog updated.'))
})

test('completed Codex card shows the result and no Stop action', async ({ page, shot }) => {
  await openCodingRun(page, 'coding-agent-completed', 'completed')

  const card = pane(page).getByRole('region', { name: 'Codex completed' })
  await expect(card).toContainText('1s')
  expect(
    await card.getByLabel('Status: completed').evaluate(element => getComputedStyle(element).backgroundColor),
    'terminal status should be visually separated from the provider label',
  ).not.toBe('rgba(0, 0, 0, 0)')
  await expect(card.getByRole('button', { name: 'Stop Codex' })).toHaveCount(0)
  await card.getByRole('button', { expanded: false }).click()
  await expect(card).toContainText('Codex fixed the Windows tests.')
  await shot('codex-completed-expanded')
})

test('failed Codex card exposes the error and no Stop action', async ({ page, shot }) => {
  await openCodingRun(page, 'coding-agent-failed', 'failed')

  const card = pane(page).getByRole('region', { name: 'Codex failed' })
  await expect(card.getByRole('button', { name: 'Stop Codex' })).toHaveCount(0)
  await card.getByRole('button', { expanded: false }).click()
  await expect(card).toContainText('Codex exited before applying the patch.')
  await shot('codex-failed-expanded')
})

test('long native work keeps one actionable card, bounded history, and the approval on that card', async ({ page, shot }) => {
  await openCodingRun(page, 'coding-agent-long-approval', 'awaiting approval')

  const card = pane(page).getByRole('region', { name: 'Codex awaiting approval' })
  const providerInstruction = 'Please work entirely inside the directory .workroom-e2e. Create a deterministic Python Dijkstra implementation, inspect it, run three command-line cases, add focused pytest tests, run pytest, inspect output, and report the final acceptance marker.'
  await expect(card).toContainText('Waiting for your approval')
  await expect(card).toContainText('Codex work room')
  await expect(card).not.toContainText(providerInstruction)
  await expect(card.locator('.line-clamp-2')).toHaveCount(1)
  await expect(card.getByLabel('Live activity snapshot')).toBeVisible()
  await expect(card.getByRole('button', { name: /Allow once/ })).toBeVisible()
  await card.getByRole('button', { expanded: false }).click()
  const activity = card.getByRole('list', { name: 'Codex activity' })
  await expect(activity.locator('li')).toHaveCount(8)
  await expect(activity).toHaveCSS('overflow-y', 'auto')
  await shot('codex-long-approval-card')

  await card.getByRole('button', { name: 'Open Work Room' }).click()
  const room = page.getByRole('dialog', { name: 'Codex Work Room' })
  await expect(room.getByLabel('Work Room live summary')).toContainText('Waiting for your approval')
  await expect(room).not.toContainText(providerInstruction)
  await expect(room.getByRole('button', { name: /Allow once/ })).toBeVisible()
  await expect(room.getByRole('list', { name: 'Codex Work Room activity' }).locator('li')).toHaveCount(8)
  await room.getByRole('tab', { name: /Chat/ }).click()
  await expect(room).toContainText(providerInstruction)
  await shot('codex-long-approval-workroom')
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('expanded provider activity does not overflow the viewport', async ({ page, shot }) => {
    await openCodingRun(page)
    const card = pane(page).getByRole('region', { name: 'Codex running' })
    await card.getByRole('button', { expanded: false }).click()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, 'provider card scrolls sideways on a phone').toBeLessThanOrEqual(0)
    await expect(card).toBeInViewport()
    await shot('codex-phone-expanded')
  })

  test('Work Room is usable without horizontal overflow on a phone', async ({ page, shot }) => {
    await openCodingRun(page, 'coding-agent-completed', 'completed')
    await pane(page).getByRole('region', { name: 'Codex completed' }).getByRole('button', { name: 'Open Work Room' }).click()
    const room = page.getByRole('dialog', { name: 'Codex Work Room' })
    await expect(room).toBeVisible()
    await room.getByRole('tab', { name: /Chat/ }).click()
    await expect(room.getByPlaceholder('Message Codex…')).toBeVisible()

    const heading = room.getByRole('heading', { name: 'Codex Work Room' })
    await expect(heading).toBeVisible()
    expect(
      await heading.evaluate(element => element.scrollWidth <= element.clientWidth),
      'Work Room title is visually truncated on a phone',
    ).toBe(true)
    await expect(room.getByRole('button', { name: 'Return to conversation' })).toContainText('Return')

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, 'Work Room scrolls sideways on a phone').toBeLessThanOrEqual(0)
    await shot('codex-workroom-phone')
  })
})
