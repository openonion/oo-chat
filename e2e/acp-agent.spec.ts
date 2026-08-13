/**
 * Browser contract for ConnectOnion's generic downward acp_agent adapter.
 *
 * Real provider/process coverage lives in the core repository. This spec owns
 * the other half of the release claim: the versioned Host carrier goes through
 * @connectonion/react and renders in O Chat without a second parser, duplicate
 * cards, or an ACP-specific component.
 */

import { type Page } from '@playwright/test'
import { test, expect, pane } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

const CHILD_TOOL_TITLE = 'Claude Code › Read file'
const FINAL_RESULT = 'The ACP child finished after one bounded read.'

async function runACPAgent(page: Page) {
  await mockAgent(page, 'acp-agent')
  await page.goto(`/${AGENT_ADDRESS}`)
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(pane(page).getByText(FINAL_RESULT, { exact: true })).toBeVisible({
    timeout: 15_000,
  })
}

test('ACP child activity and the final result each render once', async ({ page, shot }) => {
  await runACPAgent(page)
  const transcript = pane(page).getByRole('log', { name: 'Conversation' })
  const toolCard = transcript.getByRole('button').filter({ hasText: CHILD_TOOL_TITLE })

  // ACP and legacy aliases share a stable tool ID, so the rollout produces one
  // completed card rather than two nearly identical child activities.
  await expect(toolCard).toHaveCount(1)
  await expect(transcript.getByText(FINAL_RESULT, { exact: true })).toHaveCount(1)
  await expect(transcript.getByText(/running…/)).toHaveCount(0)
  await expect(toolCard).toHaveAttribute('aria-expanded', 'false')

  await toolCard.click()
  await expect(toolCard).toHaveAttribute('aria-expanded', 'true')
  await shot('expanded-child-tool')
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('the completed ACP child exchange stays inside 375px', async ({ page, shot }) => {
    await runACPAgent(page)

    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))
    expect(layout.width).toBe(375)
    expect(layout.overflow, 'ACP child exchange scrolls sideways on a phone').toBeLessThanOrEqual(0)

    await shot('completed')
  })
})
