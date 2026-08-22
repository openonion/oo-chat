import { defineConfig, devices } from '@playwright/test'

/**
 * Runs against a URL, not imported application internals. By default the local
 * server is a production build; E2E_DEV_SERVER=1 is an explicit fast-feedback
 * opt-in for tests that are not validating session handoff behavior.
 *
 * Testing the preview rather than a local build is deliberate: the preview is the
 * artifact that would ship, built by Vercel with the same env and the same
 * published dependencies. A local build has been green while the deploy was red
 * more than once in this repo.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const useDevServer = process.env.E2E_DEV_SERVER === '1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Local acceptance stays serial even when it points at an explicitly started
  // localhost server. The scripted OIP Host is intentionally per-page and Next
  // compiles cold routes lazily; parallel local workers turn an infrastructure
  // race into thirteen misleading "connecting" failures. CI runs against a
  // built preview, where parallelism is useful and safe.
  workers: process.env.CI ? undefined : 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['list']],
  use: {
    baseURL,
    // Vercel previews sit behind deployment protection, which answers every
    // request with a login page — the first CI run failed all ten specs on it.
    // The bypass header is the supported way through; without the secret we test
    // a production build served by the job itself instead.
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
      : {},
    // Every failure keeps a trace and a video; every run keeps its screenshots.
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /screenshots\.spec\.ts/ },
    // Checks the folder the run above wrote, so it depends on it having finished.
    { name: 'screenshot-flow', use: { ...devices['Desktop Chrome'] }, testMatch: /screenshots\.spec\.ts/, dependencies: ['chromium'] },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // React development replay can manufacture a second landing/session
        // handoff that production never performs. Release acceptance therefore
        // defaults to the artifact that ships; dev mode remains an explicit opt-in.
        command: useDevServer ? 'npm run dev' : 'npm run build && npm start',
        url: 'http://localhost:3000',
        reuseExistingServer: useDevServer,
        timeout: 180_000,
      },
})
