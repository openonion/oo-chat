/**
 * The end-to-end pass: land on an agent, send a message, get a reply, and
 * photograph every state on the way through — desktop and phone.
 *
 * Screenshots are the deliverable as much as the assertions. A green run that
 * nobody looks at cannot catch "the button is now white on white"; the workflow
 * uploads these and links them from the pull request so a human sees the change.
 */

import { type Page } from '@playwright/test'
import { test, expect, pane, ask } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

/** Seed the sidebar store before first paint so hydration cannot race the test's
 *  first interaction. React owns the secure browser identity separately. */
async function seedIdentity(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'oo-chat-storage',
      JSON.stringify({ state: { conversations: [], agents: [] }, version: 0 })
    )
  })
}

async function landing(page: Page, scenario: Parameters<typeof mockAgent>[1] = 'reply') {
  await seedIdentity(page)
  await mockAgent(page, scenario)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
}

test.describe('agent landing page', () => {
  test('opens on the agent name with its skills open on a desktop', async ({ page }) => {
    // v12: SKILLS is a disclosure, open by default where there is room for it.
    await landing(page)
    const main = page.getByRole('main')
    const skills = main.locator('details[data-skills]')
    await expect(skills).toBeVisible()
    await expect(skills).toHaveJSProperty('open', true)
    await expect(skills.locator('summary')).toHaveText(/Skills\s*2/i)
    await expect(main.getByText('Ship the current branch to production')).toBeVisible()
    // The removed inventory wording stays removed.
    await expect(main.getByText(/What this agent can do|Agent details|Published by/)).toHaveCount(0)
    await main.getByRole('button', { name: /Deploy.*Ship the current branch to production/ }).click()
    await expect(page).toHaveURL(new RegExp(`${AGENT_ADDRESS}/.+`))
    await expect(page.getByText('You said: /deploy')).toBeVisible({ timeout: 15_000 })
  })

  test('shows who the agent is, its balance, and how to share and pay it', async ({ page }) => {
    await landing(page)
    // The agent page's bar: live dot and name, then balance and share.
    await expect(page.getByRole('img', { name: 'Agent online' })).toBeVisible()

    // Published balance means the address resolves, so the top-up must be offered.
    const topUp = page.getByRole('link', { name: /top up/i })
    await expect(topUp).toHaveText('$4.20')
    await expect(topUp).toHaveAttribute('href', `https://o.openonion.ai/purchase?key=${AGENT_ADDRESS}`)

    // The address is the agent's only durable name and the target of a top-up;
    // the page no longer prints it, so Share is where it can be read and copied.
    await page.getByRole('button', { name: /share/i }).click()
    await expect(page.getByRole('dialog').getByRole('button', { name: /copy agent address/i })).toBeVisible()
  })

  test('the header survives opening the skills', async ({ page }) => {
    await landing(page)
    const skills = page.locator('details[data-skills]')
    if (!(await skills.evaluate(el => (el as HTMLDetailsElement).open))) await skills.locator('summary').click()
    // Regression for the centred-scroller bug: growing the column used to push the
    // identity off the top of a scroll container that could not scroll back up.
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeInViewport()
  })
})

test.describe('a full exchange', () => {
  test('send a message and get the reply rendered', async ({ page }) => {
    await landing(page)

    await ask(page)
    await expect(page).toHaveURL(new RegExp(`${AGENT_ADDRESS}/.+`))
    await expect(page.locator('main header').getByRole('link', { name: PROFILE.name })).toBeVisible()
    await expect(page.locator('main header').getByRole('link', { name: 'New chat' })).toBeVisible()

    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 15_000 })
  })

  test('shows new, cached, output tokens and the final cost', async ({ page }) => {
    await landing(page, 'cache-usage')
    await ask(page)

    await expect(page.getByText('Cache accounting is visible.')).toBeVisible({ timeout: 15_000 })
    await page.locator('summary', { hasText: 'Response details' }).click()
    await expect(page.getByText('2.3k new', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('8.2k cached', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('4 out', { exact: true })).toBeVisible()
    await expect(page.getByText('$0.0024', { exact: true }).first()).toBeVisible()
  })

  test('a tool call renders as a card and reports its result', async ({ page }) => {
    await landing(page, 'tools')
    await ask(page)

    // Collapsed, the row states the action; implementation details stay behind
    // the disclosure. Both halves matter — the summary is what a reader skims,
    // the tool name and command are what they audit.
    const toolDisclosure = page.getByRole('button', { name: /Check the operating system/ })
    await expect(toolDisclosure).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('inspect_system')).toHaveCount(0)
    await expect(page.getByText('uname -a')).toHaveCount(0)
    await expect(page.getByText(/Darwin 23\.1\.0/)).toBeVisible()

    await toolDisclosure.click()
    await expect(page.getByText('inspect_system')).toBeVisible()
    await expect(page.getByText('uname -a')).toBeVisible()
  })

  test('an approval prompt blocks the run with a simple first decision layer', async ({ page }) => {
    await landing(page, 'approval')
    await ask(page)

    await expect(page.getByRole('button', { name: /allow once/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /reject this request/i })).toBeVisible()
    await expect(page.getByText('Ask for an explanation', { exact: true })).toBeVisible()
    // A parked approval is already waiting on the reader. "Stop" here used to
    // mean two different things, so only a specific rejection is offered.
    await expect(page.getByRole('button', { name: /^stop/i })).toHaveCount(0)

    await page.getByText('Ask for an explanation', { exact: true }).click()
    await expect(page.getByRole('button', { name: /reject and ask for an explanation/i })).toBeVisible()
  })

  test('an agent error is surfaced, not swallowed', async ({ page }) => {
    await landing(page, 'error')
    await ask(page)

    await expect(page.getByRole('alert').filter({ hasText: /credits/i })).toBeVisible({ timeout: 15_000 })
  })

  test('a terminal error stops loading and Retry keeps one user message', async ({ page, shot }) => {
    await landing(page, 'error')
    await ask(page)

    const conversation = pane(page)
    const alert = conversation.getByRole('alert').filter({ hasText: /credits/i })
    await expect(alert).toBeVisible({ timeout: 15_000 })
    await expect(conversation.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(1)
    await expect(conversation.getByText(/Thinking|Synthesizing|Reasoning|Pondering|Composing|Ruminating|Cooking|Crunching|Percolating|Noodling|Wrangling|Conjuring/)).toHaveCount(0)
    await expect(conversation.getByRole('log').getByText('What can you do?', { exact: true })).toHaveCount(1)

    await alert.getByRole('button', { name: 'Retry' }).click()
    await expect(conversation.getByRole('alert').filter({ hasText: /credits/i })).toBeVisible()
    await expect(conversation.getByRole('log').getByText('What can you do?', { exact: true })).toHaveCount(1)
    await expect(conversation.getByText(/Thinking|Synthesizing|Reasoning|Pondering|Composing|Ruminating|Cooking|Crunching|Percolating|Noodling|Wrangling|Conjuring/)).toHaveCount(0)
    await shot('terminal-error-no-duplicate')
  })

  test('a successful Retry clears the terminal error banner and status', async ({ page }) => {
    await landing(page, 'error-once')
    await ask(page)

    const conversation = pane(page)
    const alert = conversation.getByRole('alert').filter({ hasText: /temporary agent failure/i })
    await expect(alert).toBeVisible({ timeout: 15_000 })

    await alert.getByRole('button', { name: 'Retry' }).click()
    await expect(conversation.getByText('You said: What can you do?')).toBeVisible({ timeout: 15_000 })
    await expect(alert).toHaveCount(0)
    await expect(conversation.getByText('error', { exact: true })).toHaveCount(0)
    await expect(conversation.getByText('Connected', { exact: true })).toBeVisible()
  })
})

test.describe('a visitor the host has not let in', () => {
  test('sees only the invite card, with the code field focused, and no skills', async ({ page, shot }) => {
    // The public relay profile carries skills; before 2026-09-29 the page listed
    // them to anyone with the address, gate or no gate (#263). v12 goes further:
    // behind an invite the card is the whole page.
    await seedIdentity(page)
    await mockAgent(page, 'onboard-success')
    await page.goto(`/${AGENT_ADDRESS}`)
    const gate = page.getByRole('dialog', { name: `${PROFILE.name} is invite-only` })
    await expect(gate).toBeVisible({ timeout: 20_000 })
    await expect(page.getByPlaceholder('Invite code')).toBeFocused()
    await expect(gate.getByRole('button', { name: /Continue/ })).toBeVisible()
    await expect(gate.getByRole('button', { name: 'pay $12.00 to join' })).toBeVisible()
    // Nothing else on the page: no heading, no composer, no skills, no helper copy.
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toHaveCount(0)
    await expect(page.getByPlaceholder(/send a message/i)).toHaveCount(0)
    await expect(page.locator('details[data-skills]')).toHaveCount(0)
    await expect(page.getByText(/Enter your code to start talking|No code\?/)).toHaveCount(0)
    for (const skill of PROFILE.skills) {
      await expect(page.getByText(skill.description)).toHaveCount(0)
      await expect(page.getByText(new RegExp(`/${skill.name}\\b`))).toHaveCount(0)
    }
    await shot('invite-only')

    // The payment line opens the existing flow in place.
    await gate.getByRole('button', { name: 'pay $12.00 to join' }).click()
    await expect(gate.getByRole('button', { name: /I've sent it/ })).toBeVisible()
  })

  test('gets the skills fold only after the host admits them', async ({ page }) => {
    await seedIdentity(page)
    await mockAgent(page, 'onboard-success')
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByPlaceholder('Invite code')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('details[data-skills]')).toHaveCount(0)
    await page.getByPlaceholder('Invite code').fill('LETMEIN')
    await page.getByRole('button', { name: /Continue/ }).click()
    await expect(page.locator('details[data-skills]')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByPlaceholder('Invite code')).toHaveCount(0)
  })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('skills start folded on a phone and read cleanly when opened', async ({ page, shot }) => {
    await landing(page)
    const main = page.getByRole('main')
    const skills = main.locator('details[data-skills]')
    await expect(skills).toBeVisible()
    await expect(skills).toHaveJSProperty('open', false)
    await expect(main.getByText('Ship the current branch to production')).toBeHidden()
    await skills.locator('summary').click()
    await expect(main.getByText('Ship the current branch to production')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    const menuBounds = await page.getByRole('button', { name: 'Open menu' }).boundingBox()
    expect(menuBounds?.y, 'mobile navigation must stay inside the viewport').toBeGreaterThanOrEqual(0)
    await shot('landing-capabilities')
  })

  test('nothing overflows the viewport at 375px', async ({ page }) => {
    await landing(page, 'approval')
    await ask(page)
    await expect(page.getByRole('button', { name: /allow once/i })).toBeVisible({ timeout: 15_000 })

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, 'page scrolls sideways on a phone').toBeLessThanOrEqual(0)
  })

  test('cache accounting remains readable at 375px', async ({ page }) => {
    await landing(page, 'cache-usage')
    await ask(page)

    await page.locator('summary', { hasText: 'Response details' }).click()
    await expect(page.getByText('8.2k cached', { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('2.3k new', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('$0.0024', { exact: true }).first()).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, 'cache accounting scrolls sideways on a phone').toBeLessThanOrEqual(0)
  })

  test('the closed drawer is not reachable by keyboard', async ({ page }) => {
    await landing(page)
    // Regression for the off-screen sidebar: it used to stay in the tab order, so
    // Remove agent and Delete chat were activatable while invisible.
    const hidden = await page.locator('aside').evaluate(el => getComputedStyle(el).visibility)
    expect(hidden).toBe('hidden')
  })
})

test.describe('the other surfaces', () => {
  test('agent picker', async ({ page }) => {
    await seedIdentity(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Talk to any agent.' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Agent address' })).toBeFocused()
    await expect(page.getByRole('button', { name: 'Connect' })).toBeDisabled()
  })

  test('settings', async ({ page }) => {
    await seedIdentity(page)
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
  })
})
