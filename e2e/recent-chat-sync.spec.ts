/** Visual contract for the local-draft versus Host-retained Recent Chat actions. */

import { type Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

async function recentChat(page: Page) {
  await page.addInitScript((address) => {
    localStorage.setItem('oo-chat-storage', JSON.stringify({
      state: {
        conversations: [{
          sessionId: 'remote-session',
          title: 'Synced from my phone',
          agentAddress: address,
          createdAt: '2026-08-20T09:00:00.000Z',
          updatedAt: '2026-09-01T09:30:00.000Z',
          remoteRevision: 7,
        }, {
          sessionId: 'local-draft',
          title: 'Local draft',
          agentAddress: address,
          createdAt: '2026-08-31T09:00:00.000Z',
          updatedAt: '2026-08-31T09:00:00.000Z',
        }],
        activeSessionId: null,
        agents: [address],
      },
      version: 0,
    }))
  }, AGENT_ADDRESS)
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({
    timeout: 20_000,
  })
  return page.locator('aside')
}

function row(sidebar: ReturnType<Page['locator']>, title: string) {
  return sidebar.getByRole('link', { name: title }).locator('..')
}

test('Recent Chat names local deletion and remote archive truthfully', async ({ page, shot }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const sidebar = await recentChat(page)
  await expect(sidebar).toHaveCSS('visibility', 'visible')

  const remote = row(sidebar, 'Synced from my phone')
  const draft = row(sidebar, 'Local draft')
  await expect(remote).toBeInViewport()
  await expect(draft).toBeInViewport()
  await expect(remote.getByRole('button')).toHaveAccessibleName('Archive chat')
  await expect(draft.getByRole('button')).toHaveAccessibleName('Delete chat')

  await draft.hover()
  await draft.getByRole('button', { name: 'Delete chat' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Delete this chat?')
  await shot('before-local-delete-desktop')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()

  await remote.hover()
  await remote.getByRole('button', { name: 'Archive chat' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Archive this chat?')
  await expect(page.getByRole('alertdialog')).toContainText('hidden from Recent Chat on your devices')
  await expect(page.getByRole('alertdialog').getByRole('button', { name: 'Archive' })).toBeVisible()
  await shot('after-remote-archive-desktop')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(sidebar).toHaveCSS('visibility', 'visible')
  await row(sidebar, 'Synced from my phone').getByRole('button', { name: 'Archive chat' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Archive this chat?')
  await expect(page.getByRole('alertdialog').getByRole('button', { name: 'Archive' })).toBeVisible()
  await shot('after-remote-archive-mobile')
})
