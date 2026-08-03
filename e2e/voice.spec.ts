/**
 * The microphone, when it does not work.
 *
 * Dictation is the second most prominent control in the composer and the one
 * most likely to fail on a phone, where mic access is a per-site permission
 * people deny by reflex and forget. Nothing covered it.
 *
 * It did surface a banner — but a raw one: `Error: Permission denied`. That is
 * the browser's words, and it tells a reader neither who denied it nor what to
 * do about it. The API-key branch three lines away already says "Please set your
 * OpenOnion API key in Settings", which is the standard this should meet.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

/** Refuse the microphone the way a browser does when the reader blocked it. */
async function denyTheMicrophone(
  page: import('@playwright/test').Page,
  name: 'NotAllowedError' | 'NotFoundError' = 'NotAllowedError',
) {
  // Real messages, not one message reused: browsers word these differently while
  // the DOMException name stays put, which is why the component matches on name.
  const message = name === 'NotFoundError' ? 'Requested device not found' : 'Permission denied'
  await page.addInitScript(([errorName, errorMessage]) => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new DOMException(errorMessage, errorName)),
      },
    })
  }, [name, message])
}

async function inAConversation(page: import('@playwright/test').Page) {
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('a blocked microphone says who blocked it and what to do', async ({ page, shot }) => {
    await denyTheMicrophone(page)
    await inAConversation(page)

    await page.getByRole('button', { name: /start recording/i }).click()

    // Not "Error: Permission denied". The reader needs to know this is a browser
    // permission they can change, not the agent refusing them or the app breaking.
    const banner = page.locator('.bg-red-50').first()
    await expect(banner).toBeVisible({ timeout: 10_000 })
    await expect(banner, 'the banner repeats the browser instead of explaining').toContainText(/microphone/i)
    await expect(banner).toContainText(/browser|settings|allow/i)

    await shot('blocked')
  })

  test('a missing microphone is not reported as a refusal', async ({ page }) => {
    await denyTheMicrophone(page, 'NotFoundError')
    await inAConversation(page)

    await page.getByRole('button', { name: /start recording/i }).click()

    // Nothing to allow if there is no device — telling this reader to change a
    // permission sends them somewhere that cannot help.
    const banner = page.locator('.bg-red-50').first()
    await expect(banner).toBeVisible({ timeout: 10_000 })
    await expect(banner).toContainText(/no microphone|not find|no.*device/i)
  })

  test('the composer is usable again after the mic fails', async ({ page }) => {
    await denyTheMicrophone(page)
    await inAConversation(page)

    await page.getByRole('button', { name: /start recording/i }).click()
    await expect(page.locator('.bg-red-50').first()).toBeVisible({ timeout: 10_000 })

    // A failed dictation must not leave the composer stuck in a recording state —
    // typing is the fallback, and it is the only one left.
    await expect(page.getByRole('button', { name: /start recording/i })).toBeVisible()
    await page.getByPlaceholder(/message/i).fill('typing instead')
    await page.keyboard.press('Enter')
    await expect(page.getByText('You said: typing instead')).toBeVisible({ timeout: 20_000 })
  })
})
