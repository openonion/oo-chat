import { defineConfig, devices } from '@playwright/test'

/**
 * Runs against a URL, not a build. Locally that is `npm run dev`, started for you;
 * in CI it is the Vercel preview for the pull request, passed as E2E_BASE_URL.
 *
 * Testing the preview rather than a local build is deliberate: the preview is the
 * artifact that would ship, built by Vercel with the same env and the same
 * published dependencies. A local build has been green while the deploy was red
 * more than once in this repo.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Against the local dev server, one worker. Next compiles each route on first
  // request, and several workers hitting cold routes at once times out tests that
  // pass individually. CI runs against a built preview, where that does not apply.
  workers: process.env.E2E_BASE_URL ? undefined : 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['list']],
  use: {
    baseURL,
    // Every failure keeps a trace and a video; every run keeps its screenshots.
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120_000 },
})
