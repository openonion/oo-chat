import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

for (const viewport of [
  { name: 'phone', width: 375, height: 667 },
  { name: 'desktop', width: 1280, height: 900 },
]) {
  test(`mode controls fit and remain tappable on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('button', { name: 'Auto', exact: true })).toBeVisible({ timeout: 90_000 })

    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }))
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.innerWidth)
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.innerWidth)

    for (const label of [
      /^Plan$/,
      /^Read only(?:, current mode)?$/,
      /^Auto(?:, current mode)?$/,
      /^Full access(?:, current mode)?$/,
    ]) {
      const box = await page.getByRole('button', { name: label }).boundingBox()
      expect(box, `${label} should be visible`).not.toBeNull()
      expect(box!.height, `${label} should be at least 44px tall`).toBeGreaterThanOrEqual(44)
      expect(box!.width, `${label} should be at least 44px wide`).toBeGreaterThanOrEqual(44)
    }
  })
}
