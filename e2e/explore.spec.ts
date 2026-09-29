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
  await expect(page.getByRole('heading', { name: 'Start a conversation' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Have an agent address?' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Agent address' })).toBeInViewport()
  expect(directoryRequests).toBe(0)
  await expect(page.getByText('Document helper')).toHaveCount(0)
  await shot('multiple-agents-desktop')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('link', { name: 'Explore', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await shot('multiple-agents-phone')
  await page.getByRole('link', { name: 'Explore', exact: true }).click()
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
  await expect(page.getByRole('link', { name: 'Explore', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Deploy' })).toHaveCount(0)
  await shot('home-preview')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await shot('home-preview-phone')
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.getByRole('link', { name: 'Explore', exact: true }).click()
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

test('saved agents have distinct work cards without opening the directory', async ({ page, shot }) => {
  const offlineAddress = `0x${'b'.repeat(64)}`
  await page.addInitScript(({ first, second }) => {
    localStorage.setItem('oo-chat-storage', JSON.stringify({
      state: {
        agents: [first, second],
        conversations: [{
          sessionId: 'recent-chat',
          agentAddress: first,
          title: 'Prepare the release',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
        activeSessionId: null,
      },
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
  await expect(page.getByRole('heading', { name: 'Your agents' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Your saved agents' }).locator('article')).toHaveCount(2)
  await expect(page.getByRole('heading', { name: 'Deploy' })).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Researcher' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View details' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Recent.*Prepare the release/ })).toBeVisible()
  expect(directoryRequests).toBe(0)
  await shot('saved-agents-desktop')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await shot('saved-agents-phone')
})

test('saved agents with real catalog task names have distinct visual identities', async ({ page, shot }) => {
  const homes = `0x${'a'.repeat(64)}`
  const maker = `0x${'b'.repeat(64)}`
  await page.addInitScript(addresses => {
    localStorage.setItem('oo-chat-storage', JSON.stringify({
      state: { agents: addresses, conversations: [], activeSessionId: null },
      version: 0,
    }))
  }, [homes, maker])
  const profiles = [
    { address: homes, name: 'airbnb-ops', skills: [
      { name: 'house-overview', description: 'Review property details and recent operating metrics.' },
      { name: 'house-status-scan', description: 'Scan the latest property status.' },
    ] },
    { address: maker, name: 'oo', skills: [
      { name: 'oo-init', description: 'Set up a publishable agent identity.' },
      { name: 'nano-banana-us', description: 'Generate images for a task.' },
    ] },
  ]
  for (const profile of profiles) {
    await page.route(`**/api/agents/${profile.address}`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ endpoints: [], relay: 'wss://oo.openonion.ai/ws', last_seen: new Date().toISOString(), profile }),
    }))
  }
  let directoryRequests = 0
  await page.route('**/api/agents/online', route => { directoryRequests += 1; return route.abort() })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'House Overview' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Oo Init' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nano Banana Us' })).toBeVisible()
  const cards = page.getByRole('region', { name: 'Your saved agents' }).locator('article')
  const firstPictogram = await cards.nth(0).locator('svg path').first().getAttribute('d')
  const secondPictogram = await cards.nth(1).locator('svg path').first().getAttribute('d')
  expect(firstPictogram).toBeTruthy()
  expect(secondPictogram).not.toBe(firstPictogram)
  expect(directoryRequests).toBe(0)
  await shot('saved-agents-catalog-desktop')
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
