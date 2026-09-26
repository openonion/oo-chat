import { test, expect } from './fixtures'
import { AGENT_ADDRESS, mockAgent } from './mock-agent'

const listed = {
  address: AGENT_ADDRESS,
  name: 'Scriptbot',
  model: 'gemini-2.5-pro',
  skillCount: 2,
  capabilities: [
    { name: 'deploy', title: 'Deploy', summary: 'Ship the current branch to production.' },
    { name: 'summarise', title: 'Summarise', summary: 'Summarise a document you paste in.' },
  ],
}

test('a new visitor can discover an online agent and open its page', async ({ page, shot }) => {
  await mockAgent(page)
  await page.route('**/api/agents/online', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ agents: [listed] }),
  }))

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Explore online agents' })).toBeVisible()
  await page.getByRole('link', { name: 'Explore online agents' }).click()
  await expect(page.getByRole('heading', { name: 'Explore agents' })).toBeVisible()
  await expect(page.getByText('1 online agent')).toBeVisible()
  await expect(page.locator('main').getByText('Ship the current branch to production.')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search online agents' }).fill('production')
  await expect(page.locator('main').getByRole('link', { name: /Scriptbot/ })).toBeVisible()
  await shot('explore-list')

  await page.locator('main').getByRole('link', { name: /Scriptbot/ }).click()
  await expect(page).toHaveURL(new RegExp(`/${AGENT_ADDRESS}$`))
  await expect(page.locator('main').getByRole('heading', { name: 'Scriptbot' })).toBeVisible()
})

test('Explore search, no results, and empty directory are clear on a phone', async ({ page, shot }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/agents/online', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ agents: [listed] }),
  }))
  await page.goto('/explore')
  await expect(page.locator('main').getByRole('link', { name: /Scriptbot/ })).toBeVisible()
  await shot('mobile-list')
  await page.getByRole('searchbox', { name: 'Search online agents' }).fill('no-such-agent')
  await expect(page.getByText(/No online agents match/)).toBeVisible()

  await page.route('**/api/agents/online', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ agents: [] }),
  }))
  await page.reload()
  await expect(page.getByText('No agents are online right now.')).toBeVisible()
  await expect(page.locator('main').getByRole('link', { name: 'Use an address' })).toBeVisible()
})

test('Explore remains readable at tablet width', async ({ page, shot }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.route('**/api/agents/online', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ agents: [listed, {
      ...listed,
      address: `0x${'b'.repeat(64)}`,
      name: 'Another agent',
    }] }),
  }))
  await page.goto('/explore')
  await expect(page.locator('main').getByRole('link', { name: /Scriptbot/ })).toBeVisible()
  await expect(page.locator('main').getByRole('link', { name: /Another agent/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768)
  await shot('tablet-list')
})

test('Explore offers a retry when discovery is unavailable', async ({ page }) => {
  let calls = 0
  await page.route('**/api/agents/online', route => {
    calls += 1
    return route.fulfill({
      status: calls === 1 ? 502 : 200,
      contentType: 'application/json',
      body: calls === 1 ? JSON.stringify({ error: 'unavailable' }) : JSON.stringify({ agents: [listed] }),
    })
  })
  await page.goto('/explore')
  await expect(page.locator('main').getByRole('alert')).toContainText('Could not load online agents')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('main').getByRole('link', { name: /Scriptbot/ })).toBeVisible()
})
