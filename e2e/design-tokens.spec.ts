import { type Page } from '@playwright/test'
import { test, expect, ask } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

// Dark mode is driven by the role tokens in app/globals.css (oo-chat#278, PR 1):
// the same screens in both schemes, with the page ground, the accent and the
// danger role all resolving to real, different colours. Set SHOTS_DIR to also
// keep a screenshot of each screen for the PR.

const SCHEMES = ['light', 'dark'] as const
const SIZES = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'oo-chat-storage',
      JSON.stringify({ state: { conversations: [], agents: [] }, version: 0 }),
    )
  })
}

async function shot(page: Page, name: string) {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png` })
}

const colour = (page: Page, selector: string, property: string) =>
  page.locator(selector).first().evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property)

for (const scheme of SCHEMES) {
  for (const size of SIZES) {
    test.describe(`${scheme} ${size.name}`, () => {
      test.use({ colorScheme: scheme, viewport: { width: size.width, height: size.height } })

      test('home (agent picker)', async ({ page }) => {
        await seed(page)
        await page.goto('/')
        await expect(page.getByRole('main')).toBeVisible()
        const ground = await colour(page, 'body', 'background-color')
        const [r, g, b] = (ground.match(/\d+(\.\d+)?/g) ?? []).map(Number)
        const lightness = (r + g + b) / 3
        if (scheme === 'dark') expect(lightness).toBeLessThan(60)
        else expect(lightness).toBeGreaterThan(200)
        await shot(page, `home-${scheme}-${size.name}`)
      })

      test('conversation and composer', async ({ page }) => {
        await seed(page)
        await mockAgent(page, 'reply')
        await page.goto(`/${AGENT_ADDRESS}`)
        await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
        const composer = page.getByRole('textbox').first()
        await composer.fill('What can you do?')
        await composer.press('Enter')
        await expect(page.getByText(/You said:/)).toBeVisible({ timeout: 15_000 })
        await shot(page, `conversation-${scheme}-${size.name}`)
      })

      test('an error keeps the danger role readable', async ({ page }) => {
        await seed(page)
        await mockAgent(page, 'error')
        await page.goto(`/${AGENT_ADDRESS}`)
        await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
        await ask(page)
        const alert = page.getByRole('alert').filter({ hasText: /credits/i })
        await expect(alert).toBeVisible({ timeout: 15_000 })
        const text = await alert.locator('span').first().evaluate((el) => getComputedStyle(el).color)
        expect(text).not.toBe('')
        expect(text).not.toBe('rgba(0, 0, 0, 0)')
        const ground = await alert.evaluate((el) => getComputedStyle(el).backgroundColor)
        expect(ground).not.toBe(text)
        await shot(page, `error-${scheme}-${size.name}`)
      })
    })
  }
}
