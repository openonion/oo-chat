/** Exact React package events render as one usable nested coding-agent card. */

import { type Page } from '@playwright/test'
import { test, expect, pane } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE, type Scenario } from './mock-agent'

async function openCodingRun(
  page: Page,
  scenario: Extract<Scenario, 'coding-agent' | 'coding-agent-completed' | 'coding-agent-failed'> = 'coding-agent',
  status: 'running' | 'completed' | 'failed' = 'running',
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
  await expect(card.getByRole('list', { name: 'Codex activity' })).toContainText('Bash')
  await expect(card.getByRole('list', { name: 'Codex activity' })).toContainText('pytest -q')
  await expect(card.getByRole('list', { name: 'Codex activity' })).toContainText('89 passed')
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

  await room.getByPlaceholder('Message Codex…').fill('Also update the changelog')
  await room.getByRole('button', { name: 'Send to Codex' }).click()
  await expect(room).toContainText('Completed #1 by Codex')
  await expect(room).toContainText('Changelog updated.')
  await shot('codex-workroom-chat-desktop')
  await room.getByRole('tab', { name: /Activity/ }).click()
  await expect(room.getByRole('list', { name: 'Codex Work Room activity' })).toContainText('pytest -q')
  await room.getByRole('tab', { name: /Files/ }).click()
  await expect(room).toContainText('No file changes reported yet.')
  await shot('codex-workroom-desktop')
})

test('completed Codex card shows the result and no Stop action', async ({ page, shot }) => {
  await openCodingRun(page, 'coding-agent-completed', 'completed')

  const card = pane(page).getByRole('region', { name: 'Codex completed' })
  await expect(card).toContainText('1s')
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
    await openCodingRun(page)
    await pane(page).getByRole('region', { name: 'Codex running' }).getByRole('button', { name: 'Open Work Room' }).click()
    const room = page.getByRole('dialog', { name: 'Codex Work Room' })
    await expect(room).toBeVisible()
    await expect(room.getByPlaceholder('Message Codex…')).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, 'Work Room scrolls sideways on a phone').toBeLessThanOrEqual(0)
    await shot('codex-workroom-phone')
  })
})
