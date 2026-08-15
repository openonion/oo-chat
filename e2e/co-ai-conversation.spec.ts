/**
 * A representative co ai conversation, kept as visual release evidence.
 *
 * The scripted Host keeps CI deterministic while the browser still exercises
 * the production HTTP discovery, WebSocket parser, signed input, route change,
 * tool card, final answer, persistence, and responsive transcript UI.
 */

import { test, expect, pane } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

const prompt = 'Check this machine and tell me whether it is ready for the 1.6.8 release.'

test('co ai receives a real input and leaves reviewable desktop and phone screenshots', async ({ page, shot }) => {
  // Do not race first-paint identity hydration: a late store hydrate can replace
  // text typed into the landing composer before React owns the field.
  await page.addInitScript(() => {
    localStorage.setItem(
      'oo-chat-storage',
      JSON.stringify({ state: { conversations: [], agents: [] }, version: 0 }),
    )
  })
  await mockAgent(page, 'tools', {
    name: 'co ai',
    skills: [{ name: 'release', description: 'Review and ship a stable release' }],
  })
  await page.goto(`/${AGENT_ADDRESS}`)

  await expect(page.getByRole('heading', { name: 'co ai', exact: true })).toBeVisible({ timeout: 20_000 })
  const composer = page.getByPlaceholder('Message this agent...')
  await expect(composer).toBeEditable()
  await composer.fill(prompt)
  await expect(composer).toHaveValue(prompt)
  const send = page.getByRole('button', { name: 'Send message' })
  await expect(send).toBeEnabled()
  await send.click()

  // The development server may still be compiling the dynamic session route.
  // Wait for the observable route transition instead of assuming it completes
  // within Playwright's short assertion default.
  await expect(page).toHaveURL(new RegExp(`${AGENT_ADDRESS}/.+`), { timeout: 20_000 })
  await expect(pane(page).getByText(prompt)).toBeVisible({ timeout: 20_000 })
  await expect(pane(page).getByText('check the kernel')).toBeVisible()
  await expect(pane(page).getByText('Darwin 23.1.0 arm64')).toBeVisible()
  const answer = pane(page).locator('p').filter({ hasText: 'The machine reports' })
  await expect(answer).toContainText('The machine reports Darwin 23.1.0 arm64.')
  await expect(answer.locator('code')).toHaveText('Darwin 23.1.0 arm64')

  await shot('desktop-conversation')

  await page.setViewportSize({ width: 390, height: 844 })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'the co ai transcript scrolls sideways on a phone').toBeLessThanOrEqual(0)
  await expect(pane(page).getByText('Darwin 23.1.0 arm64')).toBeVisible()
  await shot('phone-conversation')
})
