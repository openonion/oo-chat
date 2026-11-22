/**
 * Control Center | Chat on a desktop.
 *
 * The Control Center used to be a resizable side pane next to the chat, and it
 * was the smallest thing on screen for the agents whose owners open the page to
 * read it. Now desktop works like the phone: one view at a time, full width, and
 * the switch between them in the header. These are the promises that layout
 * makes: which view opens, that the choice sticks, that the chat is still a
 * full-width chat, and that nothing about agents without a Control Center moved.
 */

import { test, expect, pane, ask } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

const controlCenter = (page: import('@playwright/test').Page) => page.locator('iframe[title="Agent Control Center"]')
const tab = (page: import('@playwright/test').Page, name: 'Control Center' | 'Chat') =>
  page.getByRole('tab', { name: new RegExp(`^${name}`) })

async function openAgent(page: import('@playwright/test').Page, scenario: Parameters<typeof mockAgent>[1] = 'control-center-starter') {
  await mockAgent(page, scenario)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(tab(page, 'Control Center')).toBeVisible({ timeout: 20_000 })
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test(`the Control Center fills the window at ${viewport.width}x${viewport.height}`, async ({ page, shot }) => {
    await page.setViewportSize(viewport)
    await openAgent(page)

    await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Harbor Desk' })).toBeVisible()
    await expect(tab(page, 'Control Center')).toHaveAttribute('aria-selected', 'true')
    const box = (await controlCenter(page).boundingBox())!
    // Edge to edge: no 280px sidebar on the left, no chat column on the right.
    expect(box.x, 'something still sits to the left of the Control Center').toBeLessThanOrEqual(1)
    expect(box.width, 'the Control Center does not fill the window').toBeGreaterThanOrEqual(viewport.width - 1)
    await expect(page.getByPlaceholder(/send a message/i), 'a chat column is still showing').toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Agents' }), 'the rail is in the way').toBeHidden()
    await shot('home')
  })
}

test('Chat is one switch away and gets the whole width', async ({ page, shot }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openAgent(page)

  await tab(page, 'Chat').click()
  await expect(pane(page).getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
  await expect(controlCenter(page)).toBeHidden()
  const rail = (await page.getByRole('navigation', { name: 'Agents' }).boundingBox())!
  expect(rail.width, 'the rail is not 56px').toBe(56)
  await expect(page.getByPlaceholder(/send a message/i)).toBeVisible()
  await shot('chat')

  await tab(page, 'Control Center').click()
  await expect(controlCenter(page)).toBeVisible()
})

test('the choice survives a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openAgent(page)

  await tab(page, 'Chat').click()
  await page.reload()
  await expect(tab(page, 'Chat')).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 })
  await expect(controlCenter(page)).toBeHidden()

  await tab(page, 'Control Center').click()
  await page.reload()
  await expect(tab(page, 'Control Center')).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 })
  await expect(controlCenter(page)).toBeVisible()
})

test('a conversation link opens on Chat', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openAgent(page)
  await tab(page, 'Chat').click()
  await ask(page)
  await expect(pane(page).getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

  // Even after the reader last chose the Control Center: a link to a
  // conversation is a request to read that conversation.
  await tab(page, 'Control Center').click()
  await expect(controlCenter(page)).toBeVisible()
  await page.reload()
  await expect(tab(page, 'Chat')).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 })
  await expect(pane(page).getByText('You said: What can you do?')).toBeVisible()
})

for (const width of [1024, 1280, 1440]) {
  test(`a message can be typed in Chat at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await openAgent(page)
    await tab(page, 'Chat').click()

    const field = page.getByPlaceholder(/message/i)
    await expect(field).toBeVisible()
    // The chat no longer shares the window, so it should have the room a chat column wants.
    expect((await field.boundingBox())!.width).toBeGreaterThan(400)
    await field.fill('reconcile the july ledger')
    await expect(field).toHaveValue('reconcile the july ledger')
  })
}

test('an agent with no Control Center is chat only, as before', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(pane(page).getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })

  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByPlaceholder(/send a message/i)).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Agents' })).toBeVisible()
})

test('the Chat tab says when a run is waiting on the reader', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openAgent(page, 'control-center-approval')
  await tab(page, 'Chat').click()
  await ask(page)
  await expect(page.getByText('check the kernel')).toBeVisible({ timeout: 20_000 })

  await tab(page, 'Control Center').click()
  await expect(page.getByRole('tab', { name: /Chat.*waiting/i })).toBeVisible({ timeout: 15_000 })
  await expect(tab(page, 'Chat').locator('[data-attention]')).toBeVisible()
})

test('a phone gets the same switch, and keeps its menu drawer', async ({ page, shot }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openAgent(page)

  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Harbor Desk' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Agents' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Show agents' })).toBeHidden()
  await shot('home')

  await tab(page, 'Chat').click()
  await expect(pane(page).getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
  await shot('chat')

  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.locator('aside')).toHaveCSS('visibility', 'visible')
})
