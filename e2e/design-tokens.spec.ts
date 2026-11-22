import { type Page } from '@playwright/test'
import { test, expect, ask } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

// Dark mode is driven by the role tokens in app/globals.css (oo-chat#278, PR 1):
// the same screens in both schemes, with the page ground, the accent and the
// danger role all resolving to real, different colours, the error banner's
// text at least 4.5:1 on its tint in both schemes. Set SHOTS_DIR to also
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
        // The composer card's edge: in dark its shadow carries the light hairline, so the
        // card does not melt into the dark paper (#279).
        const card = composer.locator('xpath=ancestor::*[contains(@class,"shadow-lg")][1]')
        const edge = await card.evaluate((el) => getComputedStyle(el).boxShadow)
        if (scheme === 'dark') expect(edge).toMatch(/rgba\(255, 255, 255, 0\.0[5-9]\)/)
        if (process.env.SHOTS_DIR) await card.screenshot({ path: `${process.env.SHOTS_DIR}/card-${scheme}-${size.name}.png` })
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
        // WCAG contrast of the banner text on its tinted fill, both normalised to sRGB
        // through a canvas (computed colours may be oklch / color-mix) and the fill
        // composited on the page ground. 4.5:1 is the AA floor for body text.
        const ratio = await alert.evaluate((el) => {
          const ctx = document.createElement('canvas').getContext('2d')!
          const rgba = (c: string) => {
            ctx.clearRect(0, 0, 1, 1)
            ctx.fillStyle = '#000'
            ctx.fillStyle = c
            ctx.fillRect(0, 0, 1, 1)
            return Array.from(ctx.getImageData(0, 0, 1, 1).data)
          }
          const over = (top: number[], under: number[]) =>
            top.slice(0, 3).map((v, i) => v * (top[3] / 255) + under[i] * (1 - top[3] / 255))
          const ground = rgba(getComputedStyle(document.body).backgroundColor)
          const fill = over(rgba(getComputedStyle(el).backgroundColor), ground)
          const text = over(rgba(getComputedStyle(el.querySelector('span')!).color), fill)
          const lum = (c: number[]) =>
            c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
              .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
          const [hi, lo] = [lum(text), lum(fill)].sort((a, b) => b - a)
          return (hi + 0.05) / (lo + 0.05)
        })
        expect(ratio).toBeGreaterThanOrEqual(4.5)
        if (process.env.SHOTS_DIR) await alert.screenshot({ path: `${process.env.SHOTS_DIR}/banner-${scheme}-${size.name}.png` })
        await shot(page, `error-${scheme}-${size.name}`)
      })
    })
  }
}
