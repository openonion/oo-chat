/**
 * A reviewed Control Center is a real cross-origin Web app, not executable HTML
 * smuggled into the legacy Dashboard snapshot. Its buttons create visible Agent
 * turns through the typed bridge: current conversation by default, a new one only
 * when the app asks explicitly.
 */

import { test, expect, pane } from './fixtures'
import {
  AGENT_ADDRESS,
  CONTROL_CENTER_APP_REVISION,
  CONTROL_CENTER_APP_URL,
  mockAgent,
} from './mock-agent'

// The O Chat runtime can merge before the coordinated @connectonion/react alpha:
// old SDKs safely ignore CONTROL_CENTER_APP. CI enables this spec when that
// package lands; local cross-repo runs exercise it against the built SDK branch.
test.skip(
  process.env.CI === 'true' && process.env.E2E_CONTROL_CENTER_APP !== '1',
  'requires the pending @connectonion/react CONTROL_CENTER_APP frame',
)

const APP_HTML = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice desk</title>
<style>
  :root { font: 15px/1.45 Inter, ui-sans-serif, system-ui; color: #171717; background: #f5f4ef; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; }
  main { max-width: 760px; margin: auto; }
  header { display: flex; justify-content: space-between; gap: 20px; align-items: start; margin-bottom: 26px; }
  h1 { margin: 0; font: 650 30px/1.1 Georgia, serif; }
  .eyebrow { margin: 0 0 7px; color: #6b6b62; text-transform: uppercase; letter-spacing: .12em; font-size: 11px; }
  .status { border: 1px solid #cfd8cc; border-radius: 999px; padding: 6px 10px; color: #32633b; background: #fff; font-size: 12px; }
  .invoice { padding: 22px; border: 1px solid #d9d6cc; border-radius: 18px; background: white; box-shadow: 0 12px 40px #34301e0a; }
  .row { display: flex; justify-content: space-between; gap: 16px; padding: 11px 0; border-bottom: 1px solid #eceae3; }
  .row:last-child { border: 0; font-weight: 700; font-size: 17px; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
  button { min-height: 44px; border: 1px solid #d4d1c8; border-radius: 12px; padding: 10px 14px; background: #fff; color: #24231f; font: inherit; cursor: pointer; }
  button.primary { border-color: #171717; background: #171717; color: white; }
  #bridge-state { margin-top: 14px; color: #68665f; font-size: 12px; }
  @media (max-width: 520px) { body { padding: 18px; } header { display: block; } .status { display: inline-block; margin-top: 12px; } }
</style>
<main>
  <header><div><p class="eyebrow">Invoice desk</p><h1>Northwind Studio</h1></div><span class="status">Ready to send</span></header>
  <section class="invoice">
    <div class="row"><span>Invoice</span><strong>#1042</strong></div>
    <div class="row"><span>Design retainer</span><span>$4,800</span></div>
    <div class="row"><span>GST</span><span>$480</span></div>
    <div class="row"><span>Total</span><span>$5,280</span></div>
    <div class="actions">
      <button id="generate" class="primary">Generate invoice</button>
      <button id="explain">Ask Agent to explain</button>
      <button id="new-chat">Open in a new chat</button>
    </div>
    <p id="bridge-state">Waiting for Agent context…</p>
  </section>
</main>
<script>
  let revision = ${JSON.stringify(CONTROL_CENTER_APP_REVISION)};
  let controlPort;
  let sequence = 0;
  const send = (action, payload) => controlPort.postMessage({
    type: 'connectonion.control-center/request', version: 1, revision,
    id: 'invoice-' + (++sequence), action, payload
  });
  addEventListener('message', event => {
    if (event.data?.type !== 'connectonion.control-center/connect' || !event.ports[0]) return;
    if (event.data.revision !== revision || event.data.version !== 1) return;
    controlPort?.close();
    controlPort = event.ports[0];
    controlPort.onmessage = ({ data: message = {} }) => {
      if (message.type === 'connectonion.control-center/context') {
        document.querySelector('#bridge-state').textContent = message.conversation.sessionId
          ? 'Connected to current chat' : 'A chat will be created when you act';
      }
      if (message.type === 'connectonion.control-center/response') {
        document.querySelector('#bridge-state').textContent = message.ok
          ? 'Sent to Agent' : message.error.message;
      }
    };
    controlPort.start();
  });
  document.querySelector('#generate').onclick = () => send('run_skill', {
    skill: 'generate-invoice', args: 'invoice 1042'
  });
  document.querySelector('#explain').onclick = () => send('send_message', {
    message: 'Explain invoice 1042 and check the GST calculation.'
  });
  document.querySelector('#new-chat').onclick = () => send('send_message', {
    message: 'Start a separate review of invoice 1042.', conversation: 'new'
  });
</script>`

async function invoiceApp(page: import('@playwright/test').Page) {
  await page.route(CONTROL_CENTER_APP_URL, route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: APP_HTML,
  }))
  await mockAgent(page, 'control-center-app')
  await page.goto(`/${AGENT_ADDRESS}`)
  const frame = page.frameLocator('iframe[title="Agent Control Center app"]')
  await expect(frame.getByRole('heading', { name: 'Northwind Studio' })).toBeVisible()
  return frame
}

test('an invoice button creates one visible turn, then stays in that chat', async ({ page, shot }) => {
  const frame = await invoiceApp(page)
  await frame.getByRole('button', { name: 'Generate invoice' }).click()

  await expect(page).toHaveURL(new RegExp(`/${AGENT_ADDRESS}/[^/]+$`))
  const firstSession = new URL(page.url()).pathname.split('/').pop()!
  await expect(pane(page).getByText('You said: /generate-invoice invoice 1042')).toBeVisible()

  const sessionFrame = page.frameLocator('iframe[title="Agent Control Center app"]')
  await sessionFrame.getByRole('button', { name: 'Ask Agent to explain' }).click()
  await expect(page).toHaveURL(new RegExp(`/${firstSession}$`))
  await expect(pane(page).getByText('You said: Explain invoice 1042 and check the GST calculation.')).toBeVisible()
  await shot('current-chat')
})

test('a Control Center action opens a new chat only when explicitly requested', async ({ page }) => {
  const frame = await invoiceApp(page)
  await frame.getByRole('button', { name: 'Generate invoice' }).click()
  await expect(pane(page).getByText('You said: /generate-invoice invoice 1042')).toBeVisible()
  const firstSession = new URL(page.url()).pathname.split('/').pop()!

  const sessionFrame = page.frameLocator('iframe[title="Agent Control Center app"]')
  await sessionFrame.getByRole('button', { name: 'Open in a new chat' }).click()
  await expect(page).not.toHaveURL(new RegExp(`/${firstSession}$`))
  await expect(pane(page).getByText('You said: Start a separate review of invoice 1042.')).toBeVisible()
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('the full invoice app remains usable and creates a chat', async ({ page, shot }) => {
    const frame = await invoiceApp(page)
    await expect(frame.getByRole('button', { name: 'Generate invoice' })).toBeVisible()
    await shot('invoice')
    await frame.getByRole('button', { name: 'Generate invoice' }).click()
    await expect(pane(page).getByText('You said: /generate-invoice invoice 1042')).toBeVisible()
  })
})
