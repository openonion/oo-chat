import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

test('pairing a Claude terminal transfers control without an outer agent turn', async ({ page, shot }) => {
  await page.addInitScript(() => {
    localStorage.setItem('oo-chat-storage', JSON.stringify({
      state: { conversations: [], agents: [] }, version: 0,
    }))
  })
  const agent = await mockAgent(page, 'claude-station')
  await page.goto(`/${AGENT_ADDRESS}`)
  const pair = page.getByRole('textbox', { name: 'Connect to this Claude terminal' })
  await expect(pair).toBeVisible()
  await expect.poll(() => pair.evaluate((input) => getComputedStyle(input.closest('form')!).opacity)).toBe('1')
  await shot('station-pairing-desktop')
  await pair.fill('test-pairing-code')
  await page.getByRole('button', { name: 'Open Work Room' }).click()
  await expect(page).toHaveURL(/station-session$/)
  const control = page.getByRole('region', { name: 'Claude terminal control' })
  await expect(control).toContainText('Terminal controls this session')
  await shot('terminal-control-desktop')
  await control.getByRole('button', { name: 'Take control here' }).click()
  await expect(control).toContainText('Browser controls this session')
  expect(agent.sent('INPUT')).toHaveLength(0)
  await shot('browser-control-desktop')

  await page.getByRole('button', { name: 'Open Work Room' }).click()
  const room = page.getByRole('dialog')
  const composer = room.getByLabel('Message Claude Code directly')
  await expect(composer).toBeEnabled()
  await composer.fill('Reply exactly STATION_WEB_OK')
  await composer.press('Enter')
  await expect(composer).toBeEmpty()
  await expect.poll(() => agent.sent('PROVIDER_INPUT')).toHaveLength(1)
  await room.getByRole('button', { name: 'Back' }).click()
  await expect(control.getByRole('button', { name: 'Return to terminal' })).toBeVisible()
  expect(agent.sent('INPUT')).toHaveLength(0)

  await page.setViewportSize({ width: 375, height: 812 })
  await expect(control.getByRole('button', { name: 'Return to terminal' })).toBeInViewport()
  await shot('browser-control-mobile')
  await control.getByRole('button', { name: 'Return to terminal' }).click()
  await expect(control).toContainText('Terminal controls this session')
  expect(agent.sent('INPUT')).toHaveLength(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})
