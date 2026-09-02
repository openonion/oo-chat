/**
 * The composer on a phone, with something attached.
 *
 * Attaching is a flow nothing had walked. The controls all cleared the 24px
 * floor, so measuring them said everything was fine — but the preview row sat
 * *outside* the composer card, flush against the page padding, and each remove
 * button is absolutely positioned at -top-2 -right-2, so it hung outside its
 * container and was clipped. Numbers passed; the screenshot did not.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

async function openDraft(page: import('@playwright/test').Page, sessionId: string) {
  // A missing session link now waits for discovery and returns to the landing
  // page. Exercise attachment layout on an actual local draft, not mid-redirect.
  await page.addInitScript(({ address, sessionId }) => {
    localStorage.setItem('oo-chat-storage', JSON.stringify({
      state: {
        conversations: [{
          sessionId, agentAddress: address, title: 'Local draft',
          createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
        }],
        agents: [address], activeSessionId: sessionId,
      }, version: 0,
    }))
  }, { address: AGENT_ADDRESS, sessionId })
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}/${sessionId}`)
  await expect(page.getByRole('button', { name: 'Attach file' })).toBeEnabled()
}

/** A real 64x64 PNG. A 1x1 transparent one renders as nothing, which is how the
 *  first run of this produced a blank thumbnail and a false alarm. */
function swatch(path: string) {
  const [w, h] = [64, 64]
  const raw = Buffer.concat(
    Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0).fill(0xdc)]))
  )
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const crcTable = (n: number) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 }
    let crc = 0xffffffff
    for (const b of body) crc = crcTable((crc ^ b) & 0xff) ^ (crc >>> 8)
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
    return Buffer.concat([len, body, crcBuf])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]))
}

test.use({ viewport: { width: 390, height: 844 } })

test('an attached image and its remove button stay inside the composer', async ({ page, shot }) => {
  const file = '/tmp/e2e-swatch.png'
  swatch(file)

  await openDraft(page, 'attach')
  await expect(page.getByRole('button', { name: 'Attach file' })).toBeVisible({ timeout: 20_000 })

  await page.locator('input[type=file]').first().setInputFiles({
    name: 'swatch.png', mimeType: 'image/png', buffer: readFileSync(file),
  })

  const remove = page.getByRole('button', { name: 'Remove image' })
  await expect(remove).toBeVisible()

  // The thumbnail is the anchor, not a class-name guess: the button is pinned to
  // its top-right corner, so it belongs *inside* the composer's own padding.
  // Measuring against the card by class matched a different rounded element on
  // the old markup and passed either way — the first version of this assertion
  // proved nothing.
  const thumb = (await page.locator('img[alt^="Upload"]').first().boundingBox())!
  const btn = (await remove.boundingBox())!

  // Outside the card the thumbnail sat flush at the page's 16px padding, so the
  // button's -8px offset put it at x=8 with nothing behind it. Inside, the card's
  // own px-4 gives it room.
  expect(thumb.x, `the thumbnail is flush against the page edge (x=${thumb.x})`).toBeGreaterThanOrEqual(28)
  expect(btn.x, `the remove button hangs off the left (x=${btn.x})`).toBeGreaterThanOrEqual(20)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow, 'attaching pushed the page sideways').toBeLessThanOrEqual(0)

  await shot('with-attachment')
})

test('every composer control clears the touch floor', async ({ page }) => {
  await openDraft(page, 'touch')
  await expect(page.getByRole('button', { name: 'Attach file' })).toBeVisible({ timeout: 20_000 })

  for (const name of ['Attach file', 'Start recording', 'Send message']) {
    const box = await page.getByRole('button', { name }).first().boundingBox()
    expect(box, `${name} is not rendered`).not.toBeNull()
    expect(Math.min(box!.width, box!.height), `${name} is ${box!.width}x${box!.height}`).toBeGreaterThanOrEqual(24)
  }
})
