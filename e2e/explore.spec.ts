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

test('first use does not discover agents until Explore is opened', async ({ page, shot }) => {
  await mockAgent(page)
  let directoryRequests = 0
  await page.route('**/api/agents/online', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ agents: [listed, { ...listed, address: `0x${'b'.repeat(64)}`, name: 'Document helper' }] }),
  }).then(() => { directoryRequests += 1 }))
  await page.goto('/')
  // v12: a first visit is the hero and nothing else.
  await expect(page.getByRole('heading', { name: 'Talk to any agent.' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Agent address' })).toBeInViewport()
  expect(directoryRequests).toBe(0)
  await expect(page.getByText('Document helper')).toHaveCount(0)
  await shot('multiple-agents-desktop')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await shot('multiple-agents-phone')
  // Explore lives in the drawer on a phone.
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.locator('aside').getByRole('link', { name: 'Explore agents' }).click()
  await expect(page.getByText('2 online agents')).toBeVisible()
  expect(directoryRequests).toBe(1)
})

test('a new visitor can discover an online agent and open its page', async ({ page, shot }) => {
  await mockAgent(page)
  await page.route('**/api/agents/online', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ agents: [listed] }),
  }))

  await page.goto('/')
  const explore = page.locator('aside').getByRole('link', { name: 'Explore agents' })
  await expect(explore).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Deploy' })).toHaveCount(0)
  await shot('home-preview')
  await explore.click()
  await expect(page.getByRole('heading', { name: 'Explore agents' })).toBeVisible()
  await expect(page.getByText('1 online agent')).toBeVisible()
  await expect(page.locator('main').getByText('Ship the current branch to production.')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search online agents' }).fill('production')
  await expect(page.locator('main').getByRole('link', { name: /Scriptbot/ })).toBeVisible()
  await shot('explore-list')

  await page.locator('main').getByRole('link', { name: /Scriptbot/ }).click()
  await expect(page).toHaveURL(new RegExp(`/${AGENT_ADDRESS}$`))
  await expect(page.locator('main').getByRole('heading', { name: 'Scriptbot' })).toBeVisible()
  await shot('agent-profile')
})

test('saved agents are listed by name and address without opening the directory', async ({ page, shot }) => {
  const offlineAddress = `0x${'b'.repeat(64)}`
  await page.addInitScript(({ first, second }) => {
    localStorage.setItem('oo-chat-storage', JSON.stringify({
      state: { agents: [first, second], conversations: [], activeSessionId: null },
      version: 0,
    }))
  }, { first: AGENT_ADDRESS, second: offlineAddress })
  await mockAgent(page)
  await page.route(`**/api/agents/${offlineAddress}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      endpoints: [],
      relay: null,
      last_seen: new Date(0).toISOString(),
      profile: { address: offlineAddress, name: 'Researcher', skills: [{ name: 'research', description: 'Investigate a topic and summarize the evidence.' }] },
    }),
  }))
  let directoryRequests = 0
  await page.route('**/api/agents/online', route => {
    directoryRequests += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ agents: [listed] }) })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Choose an agent' })).toBeVisible()
  const list = page.getByRole('list', { name: 'Your agents' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list.getByText('Researcher')).toBeVisible()
  await expect(list.getByText('Scriptbot')).toBeVisible()
  // Published skills come from a relay profile anyone can read; the home list
  // does not repeat them (#263).
  await expect(page.getByText('Investigate a topic and summarize the evidence.')).toHaveCount(0)
  expect(directoryRequests).toBe(0)
  await shot('saved-agents-desktop')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await shot('saved-agents-phone')
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
  let unavailable = true
  await page.route('**/api/agents/online', route => {
    return route.fulfill({
      status: unavailable ? 502 : 200,
      contentType: 'application/json',
      body: unavailable ? JSON.stringify({ error: 'unavailable' }) : JSON.stringify({ agents: [listed] }),
    })
  })
  await page.goto('/explore')
  await expect(page.locator('main').getByRole('alert')).toContainText('Could not load online agents')
  unavailable = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('main').getByRole('link', { name: /Scriptbot/ })).toBeVisible()
})
