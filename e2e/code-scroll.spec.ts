/**
 * Long code in an agent reply, on a phone.
 *
 * A fenced block is 635px of content in a 304px box at 390px wide. overflow-x is
 * auto so it scrolls, but the line ended flush at the edge and nothing said there
 * was more of it.
 *
 * Asserted by sampling pixels, because I could not judge this by eye: the first
 * attempt painted the conventional dark scroll-shadow, which on a near-black
 * block is invisible, and the screenshot looked identical to the broken version.
 * A colour reading is the only honest check here.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

test.use({ viewport: { width: 390, height: 844 } })

test('a code block that scrolls says so, at the end that has more', async ({ page, shot }) => {
  test.setTimeout(60_000)
  await mockAgent(page, 'busy')
  await page.goto(`/${AGENT_ADDRESS}`)
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(page.getByText(/build finished in 4\.2 seconds/)).toBeVisible({ timeout: 20_000 })

  const pre = page.locator('[role="log"] pre').first()
  const box = (await pre.boundingBox())!

  // Only meaningful while the content really is wider than the box.
  const overflows = await pre.evaluate(el => el.scrollWidth > el.clientWidth + 8)
  expect(overflows, 'the sample block no longer overflows — pick a longer line').toBe(true)

  const shot1 = (await page.screenshot({ clip: box })).toString('base64')
  const sample = await page.evaluate(async (b64: string) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const at = (x: number) => {
      const d = ctx.getImageData(Math.round(x), Math.round(img.height / 2), 1, 1).data
      return d[0]
    }
    return { left: at(2), mid: at(img.width / 2), right: at(img.width - 3) }
  }, shot1)

  // Scrolled to the start: the right edge has content past it and lifts; the
  // left edge does not and stays flat. background-attachment: local is what
  // ties each fade to whether there is anything behind it.
  expect(sample.right - sample.mid, `no edge indicator: ${JSON.stringify(sample)}`).toBeGreaterThan(12)
  expect(Math.abs(sample.left - sample.mid), 'the start edge is fading with nothing behind it').toBeLessThan(12)

  await shot('code-block')
})
