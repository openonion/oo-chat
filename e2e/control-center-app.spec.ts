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

import { readFileSync } from 'node:fs'

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
<script type="module">
  import {connectControlCenter} from '/control-center-sdk.js';
  const params = new URLSearchParams(location.hash.slice(1));
  const client = await connectControlCenter({parentOrigin:params.get('co-parent'), revision:params.get('co-revision'), allowLocalhost:true});
  client.subscribe(snapshot => {
    document.querySelector('#bridge-state').textContent = 'Connected to current chat';
    document.body.dataset.items = String(snapshot.chatItems.length);
    document.body.dataset.connection = snapshot.connectionState;
  });
  const act = async (callback) => {
    try { await callback(); document.body.dataset.action = 'complete'; }
    catch(error) { document.querySelector('#bridge-state').textContent = error.message; }
  };
  document.querySelector('#generate').onclick = () => act(() => client.runSkill('generate-invoice','invoice 1042'));
  document.querySelector('#explain').onclick = () => act(() => client.sendMessage('Explain invoice 1042 and check the GST calculation.'));
  document.querySelector('#new-chat').onclick = () => act(() => client.sendMessage('Start a separate review of invoice 1042.',{conversation:'new'}));
  window.controlClient = client;
</script>`

const transports=new WeakMap<import('@playwright/test').Page,Awaited<ReturnType<typeof mockAgent>>>()

async function invoiceApp(page: import('@playwright/test').Page, transport:'direct'|'relay'|'fallback'='direct', path?:string) {
  await page.route('https://control-center.e2e.test/control-center-sdk.js', route => route.fulfill({contentType:'text/javascript', body:readFileSync('node_modules/@connectonion/react/browser/control-center.js','utf8')}))
  await page.route(CONTROL_CENTER_APP_URL, route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    headers: {'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src https: wss:; worker-src 'self'; media-src 'self' blob: https:; object-src 'none'; base-uri 'self'", 'X-Content-Type-Options':'nosniff'},
    body: APP_HTML,
  }))
  transports.set(page,await mockAgent(page, 'control-center-app',{},transport))
  await page.goto(path??`/${AGENT_ADDRESS}`)
  const frame = page.frameLocator('iframe[title="Agent Control Center app"]')
  await expect(frame.getByRole('heading', { name: 'Northwind Studio' })).toBeVisible()
  await expect(frame.locator('#bridge-state')).toContainText('Connected')
  return frame
}

test('an invoice button creates one visible turn, then stays in that chat', async ({ page, shot }) => {
  const frame = await invoiceApp(page)
  await frame.getByRole('button', { name: 'Generate invoice' }).click()

  await expect(page).toHaveURL(new RegExp(`/${AGENT_ADDRESS}/[^/?]+(?:\\?.*)?$`))
  const firstSession = new URL(page.url()).pathname.split('/').pop()!
  await expect(pane(page).getByText('You said: /generate-invoice invoice 1042', { exact: false })).toBeVisible()

  const sessionFrame = page.frameLocator('iframe[title="Agent Control Center app"]')
  await sessionFrame.getByRole('button', { name: 'Ask Agent to explain' }).click()
  await expect(page).toHaveURL(new RegExp(`/${firstSession}$`))
  await expect(pane(page).getByText('You said: Control Center: Explain invoice 1042 and check the GST calculation.')).toBeVisible()
  await shot('current-chat')
})

test('a Control Center action opens a new chat only when explicitly requested', async ({ page }) => {
  const frame = await invoiceApp(page)
  await frame.getByRole('button', { name: 'Generate invoice' }).click()
  await expect(pane(page).getByText('You said: /generate-invoice invoice 1042', { exact: false })).toBeVisible()
  const firstSession = new URL(page.url()).pathname.split('/').pop()!

  const sessionFrame = page.frameLocator('iframe[title="Agent Control Center app"]')
  await sessionFrame.getByRole('button', { name: 'Open in a new chat' }).click()
  await expect(page).not.toHaveURL(new RegExp(`/${firstSession}$`))
  await expect(pane(page).getByText('You said: Control Center: Start a separate review of invoice 1042.')).toBeVisible()
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('the full invoice app remains usable and creates a chat', async ({ page, shot }) => {
    const frame = await invoiceApp(page)
    await expect(frame.getByRole('button', { name: 'Generate invoice' })).toBeVisible()
    const dimensions=await frame.locator('body').evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    expect(await page.evaluate(()=>innerWidth)).toBe(375);
    expect(dimensions.width).toBeGreaterThanOrEqual(373);expect(dimensions.width).toBeLessThanOrEqual(375);
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
    for(const button of await frame.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await shot('invoice')
    await frame.getByRole('button', { name: 'Generate invoice' }).click()
    await expect(pane(page).getByText('You said: /generate-invoice invoice 1042', { exact: false })).toBeVisible()
  })
})


test('focus preserves the iframe, and the same app receives updated normalized chat state', async ({page,shot}) => {
  const frame=await invoiceApp(page);
  await frame.getByRole('button',{name:'Generate invoice'}).click();
  await expect(pane(page).getByText('You said: /generate-invoice invoice 1042',{exact:false})).toBeVisible();
  const app=page.frameLocator('iframe[title="Agent Control Center app"]');
  await expect(app.locator('body')).toHaveAttribute('data-items',/^[1-9][0-9]*$/);
  await page.getByRole('button',{name:'Focus',exact:true}).click();
  await expect(page.getByRole('button',{name:'Exit focus'})).toBeVisible();
  await expect(app.locator('#bridge-state')).toContainText('Connected');
  const measurement=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  expect(measurement.scroll).toBeLessThanOrEqual(measurement.width);
  await shot('focus');
  const newTab=page.getByRole('link',{name:'New tab'});
  await expect(newTab).toHaveAttribute('href',/view=control-center&revision=sha256/);
  await page.getByRole('button',{name:'Exit focus'}).click();
  await expect(app.locator('#bridge-state')).toContainText('Connected');
});

test('normal browser APIs work on the isolated app origin', async ({page}) => {
  await invoiceApp(page);
  await page.route('https://control-center.e2e.test/probe.json',route=>route.fulfill({json:{ok:true}}));
  await page.route('https://control-center.e2e.test/worker.js',route=>route.fulfill({contentType:'text/javascript',body:'onmessage=()=>postMessage("worker-ok")'}));
  await page.route('https://control-center.e2e.test/events',route=>route.fulfill({contentType:'text/event-stream',body:'data: ready\n\n'}));
  await page.routeWebSocket('wss://control-center.e2e.test/echo',ws=>ws.onMessage(message=>ws.send(message)));
  const app=page.frames().find(frame=>frame.url().startsWith(CONTROL_CENTER_APP_URL))!;
  const result=await app.evaluate(async()=>{
    const fetched=await fetch('/probe.json').then(r=>r.json());
    const xhr=await new Promise(resolve=>{const request=new XMLHttpRequest();request.open('GET','/probe.json');request.onload=()=>resolve(JSON.parse(request.responseText).ok);request.send()});
    localStorage.setItem('control-probe','yes');sessionStorage.setItem('control-probe','yes');
    const worker=await new Promise(resolve=>{const w=new Worker('/worker.js');w.onmessage=e=>{resolve(e.data);w.terminate()};w.postMessage('run')});
    const websocket=await new Promise(resolve=>{const w=new WebSocket('wss://control-center.e2e.test/echo');w.onopen=()=>w.send('echo');w.onmessage=e=>{resolve(e.data);w.close()}});
    const sse=await new Promise(resolve=>{const stream=new EventSource('/events');stream.onmessage=e=>{resolve(e.data);stream.close()}});
    const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d')!;ctx.fillStyle='red';ctx.fillRect(0,0,1,1);
    const webgl=document.createElement('canvas').getContext('webgl2');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','20');svg.setAttribute('height','20');document.body.append(svg);
    const svgWidth=svg.getBoundingClientRect().width;svg.remove();
    const indexedDBWorks=await new Promise(resolve=>{const open=indexedDB.open('control-probe',1);open.onupgradeneeded=()=>open.result.createObjectStore('probe');open.onsuccess=()=>{const db=open.result;const tx=db.transaction('probe','readwrite');tx.objectStore('probe').put('yes','key');tx.oncomplete=()=>{const read=db.transaction('probe').objectStore('probe').get('key');read.onsuccess=()=>{resolve(read.result==='yes');db.close()}}}});
    const wasm=await WebAssembly.instantiate(new Uint8Array([0,97,115,109,1,0,0,0]));
    return {webgl:!!webgl,svgWidth,indexedDB:indexedDBWorks,fetch:fetched.ok,xhr,storage:localStorage.getItem('control-probe')==='yes'&&sessionStorage.getItem('control-probe')==='yes',worker,websocket,sse,canvas:ctx.getImageData(0,0,1,1).data[0],wasm:!!wasm.instance};
  });
  expect(result).toEqual({webgl:true,svgWidth:20,indexedDB:true,fetch:true,xhr:true,storage:true,worker:'worker-ok',websocket:'echo',sse:'ready',canvas:255,wasm:true});
});


test('code, diff, update findings, history and rollback use the parent Host controls', async ({page,shot}) => {
  await invoiceApp(page);
  await page.getByRole('button',{name:'Code',exact:true}).click();
  await expect(page.getByLabel('Control Center source')).toContainText('<h1>Reviewed invoice</h1>');
  await page.getByLabel('Compare revision').selectOption('sha256:'+'e'.repeat(64));
  await expect(page.getByLabel('Control Center source')).toContainText('-<h1>Previous</h1>');
  await page.getByRole('button',{name:'Preview',exact:true}).click();
  await page.getByRole('button',{name:'Updates',exact:true}).click();
  await page.getByLabel('Enable automatic updates').check();
  await page.getByRole('button',{name:'Save update settings'}).click();
  await expect.poll(()=>transports.get(page)!.sent('CONTROL_CENTER_COMMAND').at(-1)).toMatchObject({action:'configure',payload:{payload:{enabled:true}}});
  await page.getByRole('button',{name:'Updates',exact:true}).click();
  await page.getByRole('button',{name:'Updates',exact:true}).click();
  await expect(page.getByLabel('Enable automatic updates')).toBeChecked();
  await page.getByRole('button',{name:'Updates',exact:true}).click();
  await page.getByRole('button',{name:'Update app',exact:true}).click();
  await expect(page.getByText('Remove the unreviewed external script.',{exact:false})).toBeVisible();
  await expect(page.frameLocator('iframe').getByRole('heading',{name:'Northwind Studio'})).toBeVisible();
  await shot('blocked-keeps-approved-app');
  await page.getByRole('button',{name:'History',exact:true}).click();
  await page.getByRole('button',{name:'Restore',exact:true}).click();
  await expect.poll(()=>transports.get(page)!.sent('CONTROL_CENTER_COMMAND').at(-1)).toMatchObject({action:'rollback',payload:{payload:{revision:'sha256:'+'e'.repeat(64)}}});
  await expect(page.locator('iframe')).toHaveAttribute('src',new RegExp('co-revision=sha256%3A'+'e'.repeat(64)));

});


for (const transport of ['relay','fallback'] as const) {
  test(`${transport} preserves app actions without a direct Agent endpoint`,async({page})=>{
    const frame=await invoiceApp(page,transport);
    await frame.getByRole('button',{name:'Generate invoice'}).click();
    await expect(pane(page).getByText('You said: /generate-invoice invoice 1042',{exact:false})).toBeVisible();
    await expect.poll(()=>transports.get(page)!.sent('INPUT').length).toBe(1);
    expect(transports.get(page)!.sent('INPUT')[0].to).toBe(AGENT_ADDRESS);
  });
}


test('a new-tab session shell restores its conversation and approved app, then survives reload',async({page,context,shot})=>{
  const frame=await invoiceApp(page);
  await frame.getByRole('button',{name:'Generate invoice'}).click();
  await expect(pane(page).getByText('You said: /generate-invoice invoice 1042',{exact:false})).toBeVisible();
  const href=await page.getByRole('link',{name:'New tab'}).getAttribute('href');
  expect(href).toContain('view=control-center');
  const tab=await context.newPage();
  await invoiceApp(tab,'direct',href!);
  await expect(tab.getByRole('button',{name:'Exit focus'})).toBeVisible();
  await expect.poll(()=>transports.get(tab)!.sent('CONNECT').some(frame=>frame.session_id===new URL(page.url()).pathname.split('/').pop())).toBe(true);
  await tab.reload();
  const app=tab.frameLocator('iframe[title="Agent Control Center app"]');
  await expect(app.locator('#bridge-state')).toContainText('Connected');
  await tab.getByRole('button',{name:'Exit focus'}).click();
  await expect(pane(tab).getByText('You said: /generate-invoice invoice 1042',{exact:false})).toBeVisible();
  await app.getByRole('button',{name:'Ask Agent to explain'}).click();
  await expect(pane(tab).getByText('You said: Control Center: Explain invoice 1042 and check the GST calculation.')).toBeVisible();
  await tab.close();
  await shot('original-session-remains');
});
