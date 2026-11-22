import { type Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

// The conversation screen's motion (oo-chat#278, PR 2), on the mock agent's
// streaming reply: the newest words blur in without moving the layout, the working
// line is a dot wave that resolves to a check, the composer's one send button morphs
// idle → running → idle, and reduced motion turns all of it into opacity only.
// Set SHOTS_DIR to keep a screenshot of each stage for the PR.

const SCHEMES = ['light', 'dark'] as const
const SIZES = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('oo-chat-storage', JSON.stringify({ state: { conversations: [], agents: [] }, version: 0 }))
  })
}

async function shot(page: Page, name: string) {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png` })
}

async function startStreaming(page: Page) {
  await seed(page)
  await mockAgent(page, 'stream-reply')
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
  const send = page.locator('[data-composer-state]')
  await expect(send).toHaveAttribute('data-composer-state', 'idle')
  const composer = page.getByRole('textbox').first()
  await composer.fill('Why is the build failing?')
  await composer.press('Enter')
  return send
}

for (const scheme of SCHEMES) {
  for (const size of SIZES) {
    test.describe(`${scheme} ${size.name}`, () => {
      test.use({ colorScheme: scheme, viewport: { width: size.width, height: size.height } })

      test('streaming reply, status wave → check, composer morph', async ({ page }) => {
        const send = await startStreaming(page)

        // Running: the one send button is now Stop, and the working line is a dot wave.
        await expect(send).toHaveAttribute('data-composer-state', 'running', { timeout: 15_000 })
        await expect(send).toHaveAttribute('aria-label', 'Stop agent')
        await expect(page.locator('.status-wave').first()).toBeVisible()
        await expect(page.getByRole('status').filter({ hasText: 'Agent is working' }).first()).toBeAttached()

        // Mid-stream: the reply is growing and its newest words are blurring in.
        await expect(page.locator('[data-streaming] .stream-word').first()).toBeVisible({ timeout: 15_000 })
        const before = await page.locator('[data-streaming]').boundingBox()
        await expect(page.locator('.stream-word.is-fresh').first()).toBeAttached({ timeout: 5_000 })
        await shot(page, `stream-mid-${scheme}-${size.name}`)
        // The fresh words animate blur and opacity only: no transform, so nothing shifts.
        const transform = await page.locator('.stream-word').first().evaluate(el => getComputedStyle(el).transform)
        expect(transform).toBe('none')
        const after = await page.locator('[data-streaming]').boundingBox()
        expect(after?.x).toBe(before?.x)

        // Done: the dots resolve to a check, Done is announced, the reply is plain text.
        await expect(page.locator('svg.status-check')).toBeVisible({ timeout: 15_000 })
        await expect(page.getByRole('status').filter({ hasText: 'Done' }).first()).toBeAttached()
        await expect(send).toHaveAttribute('data-composer-state', 'idle')
        await expect(send).toHaveAttribute('aria-label', 'Send message')
        await shot(page, `done-${scheme}-${size.name}`)
        await expect(page.locator('[data-streaming]')).toHaveCount(0)
        await expect(page.getByText('the site builds again.')).toBeVisible()
      })
    })
  }
}

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('every conversation animation becomes opacity only', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startStreaming(page)
    const fresh = page.locator('.stream-word.is-fresh').first()
    await expect(fresh).toBeAttached({ timeout: 15_000 })
    expect(await fresh.evaluate(el => getComputedStyle(el).animationName)).toBe('motion-fade-in')
    expect(await fresh.evaluate(el => getComputedStyle(el).filter)).toBe('none')
    const dot = page.locator('.status-wave > span').first()
    if (await dot.count()) expect(await dot.evaluate(el => getComputedStyle(el).animationName)).toBe('status-wave-fade')
    const arrow = page.locator('.composer-send-arrow')
    expect(await arrow.evaluate(el => getComputedStyle(el).transform)).toBe('none')
  })
})
