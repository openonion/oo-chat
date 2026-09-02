import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE_URL = process.env.E2E_BASE_URL || 'https://chat.openonion.ai'
const AGENT_ADDRESS = process.env.E2E_AGENT_ADDRESS
const SHOTS_DIR = process.env.E2E_SHOTS_DIR
const STAGGER_MS = Number(process.env.E2E_STAGGER_MS || 0)
const MNEMONIC = process.env.E2E_MNEMONIC
const FIXED_NOW_MS = Math.floor(Date.now() / 1000) * 1000

if (!MNEMONIC) throw new Error('E2E_MNEMONIC must name a disposable test identity, never a real user identity')
if (!AGENT_ADDRESS) throw new Error('E2E_AGENT_ADDRESS is required')
if (!SHOTS_DIR) throw new Error('E2E_SHOTS_DIR is required')
fs.mkdirSync(SHOTS_DIR, { recursive: true })

const evidence = {
  baseUrl: BASE_URL,
  agentAddress: AGENT_ADDRESS,
  startedAt: new Date().toISOString(),
  fixedBrowserTimestamp: Math.floor(FIXED_NOW_MS / 1000),
  browser: {},
  protocolFrames: { stationA: [], stationB: [] },
  consoleErrors: { stationA: [], stationB: [] },
  checks: {},
}

function frameSummary(direction, payload) {
  if (typeof payload !== 'string') return null
  try {
    const parsed = JSON.parse(payload)
    const frame = { direction, type: parsed.type || 'unknown' }
    if (typeof parsed.request_id === 'string') frame.requestId = parsed.request_id
    if (typeof parsed.session_id === 'string') frame.sessionId = parsed.session_id
    if (parsed.protocol && typeof parsed.protocol === 'object') frame.protocol = parsed.protocol
    if (parsed.payload?.extensions && typeof parsed.payload.extensions === 'object') {
      frame.requestedExtensions = parsed.payload.extensions
    }
    if (parsed.payload?.session_sync_only === 1) frame.sessionSyncOnly = true
    if (typeof parsed.payload?.timestamp === 'number') frame.connectTimestamp = parsed.payload.timestamp
    if (typeof parsed.payload?.nonce === 'string') frame.connectNonce = parsed.payload.nonce
    if (typeof parsed.status === 'string') frame.status = parsed.status
    if (parsed.type === 'ERROR' && typeof parsed.message === 'string') frame.message = parsed.message
    if (parsed.type === 'ERROR' && typeof parsed.error === 'string') frame.message = parsed.error
    return frame
  } catch {
    return null
  }
}

function observe(page, station) {
  page.on('console', message => {
    if (message.type() === 'error') evidence.consoleErrors[station].push(message.text())
  })
  page.on('pageerror', error => evidence.consoleErrors[station].push(error.message))
  page.on('websocket', socket => {
    socket.on('framesent', event => {
      const summary = frameSummary('sent', event.payload)
      if (summary) evidence.protocolFrames[station].push(summary)
    })
    socket.on('framereceived', event => {
      const summary = frameSummary('received', event.payload)
      if (summary) evidence.protocolFrames[station].push(summary)
    })
  })
}

async function identityAddress(page) {
  const candidate = page.locator('main div.font-mono').filter({ hasText: /^0x[0-9a-f]{64}$/ }).first()
  await candidate.waitFor({ state: 'visible', timeout: 20_000 })
  return (await candidate.innerText()).trim()
}

async function importSharedIdentity(page) {
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Settings' }).waitFor({ timeout: 30_000 })

  const recoveryModal = page.getByRole('heading', { name: 'Secure Your Recovery Phrase' })
  if (await recoveryModal.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await page.getByRole('button', { name: "I've Stored It Safely" }).click()
  }

  const before = await identityAddress(page)
  await page.getByRole('button', { name: 'Import Key' }).click()
  await page.getByPlaceholder('Paste your 12-word recovery phrase...').fill(MNEMONIC)
  await page.getByRole('button', { name: 'Import Now' }).click()
  await page.getByPlaceholder('Paste your 12-word recovery phrase...').waitFor({ state: 'hidden' })
  const after = await identityAddress(page)
  if (before === after) throw new Error('Identity import did not replace the fresh identity')
  return after
}

async function storedConversations(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('oo-chat-storage')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return parsed?.state?.conversations || []
  })
}

async function waitFor(condition, description, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const value = await condition()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ''}`)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  evidence.browser.version = browser.version()
  const contextA = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const contextB = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await Promise.all([
    contextA.addInitScript(fixedNow => { Date.now = () => fixedNow }, FIXED_NOW_MS),
    contextB.addInitScript(fixedNow => { Date.now = () => fixedNow }, FIXED_NOW_MS),
  ])
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()
  observe(pageA, 'stationA')
  observe(pageB, 'stationB')

  try {
    const identityA = await importSharedIdentity(pageA)
    const identityB = await importSharedIdentity(pageB)
    evidence.identityAddress = identityA
    evidence.checks.sameIdentityAcrossIsolatedContexts = identityA === identityB
    if (identityA !== identityB) throw new Error('The two isolated browser contexts have different identities')

    if (STAGGER_MS > 0) {
      await pageB.goto(`${BASE_URL}/${AGENT_ADDRESS}`, { waitUntil: 'domcontentloaded' })
      await pageB.getByRole('heading', { name: 'Session Sync E2E', exact: true }).waitFor({ timeout: 30_000 })
      await new Promise(resolve => setTimeout(resolve, STAGGER_MS))
      await pageA.goto(`${BASE_URL}/${AGENT_ADDRESS}`, { waitUntil: 'domcontentloaded' })
      await pageA.getByRole('heading', { name: 'Session Sync E2E', exact: true }).waitFor({ timeout: 30_000 })
    } else {
      await Promise.all([
        pageA.goto(`${BASE_URL}/${AGENT_ADDRESS}`, { waitUntil: 'domcontentloaded' }),
        pageB.goto(`${BASE_URL}/${AGENT_ADDRESS}`, { waitUntil: 'domcontentloaded' }),
      ])
      await Promise.all([
        pageA.getByRole('heading', { name: 'Session Sync E2E', exact: true }).waitFor({ timeout: 30_000 }),
        pageB.getByRole('heading', { name: 'Session Sync E2E', exact: true }).waitFor({ timeout: 30_000 }),
      ])
    }

    const beforeB = await storedConversations(pageB)
    evidence.checks.stationBInitiallyEmpty = beforeB.length === 0
    if (beforeB.length !== 0) throw new Error(`Station B unexpectedly had ${beforeB.length} local conversations`)

    await pageA.getByRole('button', { name: 'What can you do?' }).click()
    await pageA.getByText('E2E echo: What can you do?').waitFor({ state: 'visible', timeout: 30_000 })
    await pageA.screenshot({ path: path.join(SHOTS_DIR, '01-station-a-created-desktop.png'), fullPage: true })

    const sessionMatch = pageA.url().match(new RegExp(`${AGENT_ADDRESS}/([^/?#]+)`))
    if (!sessionMatch) throw new Error(`Station A did not navigate to a session URL: ${pageA.url()}`)
    evidence.sessionId = sessionMatch[1]

    const syncStarted = Date.now()
    const remoteB = await waitFor(async () => {
      const conversations = await storedConversations(pageB)
      return conversations.find(item => item.sessionId === evidence.sessionId && item.remoteRevision > 0)
    }, 'Station B remote Recent Chat entry', 35_000)
    evidence.checks.stationBAutoSyncLatencyMs = Date.now() - syncStarted
    evidence.checks.stationBRemoteRevision = remoteB.remoteRevision
    evidence.checks.stationBTitle = remoteB.title
    const syncedConversationsB = await storedConversations(pageB)
    evidence.checks.stationBRemoteConversationCount = syncedConversationsB.length
    evidence.checks.noBlankRemoteConversations = syncedConversationsB.every(item =>
      typeof item.title === 'string' && item.title.trim() && item.title !== 'Untitled chat')
    if (syncedConversationsB.length !== 1 || !evidence.checks.noBlankRemoteConversations) {
      throw new Error(`Station B received non-chat history: ${JSON.stringify(syncedConversationsB)}`)
    }

    await pageB.getByRole('button', { name: 'Open menu' }).click()
    const syncedLinkB = pageB.getByRole('link', { name: remoteB.title, exact: true })
    await syncedLinkB.waitFor({ state: 'visible', timeout: 10_000 })
    await pageB.screenshot({ path: path.join(SHOTS_DIR, '02-station-b-auto-synced-mobile.png'), fullPage: true })
    await syncedLinkB.click()

    await pageB.getByText('What can you do?', { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 })
    await pageB.getByText('E2E echo: What can you do?').waitFor({ state: 'visible', timeout: 30_000 })
    evidence.checks.stationBLoadedRemoteTranscript = true
    evidence.checks.remoteComposerReadOnly = await pageB.locator('textarea').isDisabled()
    if (!evidence.checks.remoteComposerReadOnly) throw new Error('Remote snapshot composer unexpectedly allows input')

    const followUp = 'Cross-device follow-up'
    await pageA.locator('textarea').fill(followUp)
    await pageA.getByRole('button', { name: 'Send message', exact: true }).click()
    await pageA.getByText(`E2E echo: ${followUp}`, { exact: true }).waitFor({ state: 'visible', timeout: 30_000 })
    const updateStarted = Date.now()
    await pageB.getByText(`E2E echo: ${followUp}`, { exact: true }).waitFor({ state: 'visible', timeout: 35_000 })
    evidence.checks.stationBTranscriptAutoUpdateLatencyMs = Date.now() - updateStarted
    evidence.checks.stationBTranscriptUpdatedWithoutReload = true
    await pageB.reload({ waitUntil: 'domcontentloaded' })
    await pageB.getByText(`E2E echo: ${followUp}`, { exact: true }).waitFor({ state: 'visible', timeout: 30_000 })
    evidence.checks.remoteTranscriptSurvivesReload = true
    const expectedMessages = ['What can you do?', 'E2E echo: What can you do?', followUp, `E2E echo: ${followUp}`]
    evidence.checks.remoteTranscriptHasNoDuplicates = (await Promise.all(expectedMessages.map(text =>
      pageB.locator('main').getByText(text, { exact: true }).count()))).every(count => count === 1)
    if (!evidence.checks.remoteTranscriptHasNoDuplicates) throw new Error('Remote transcript duplicated a retained message after reload')
    if (await pageB.getByText(/Session is already attached|Error: Agent error/).count()) {
      throw new Error('Remote transcript renders a live-session attachment error after reload')
    }
    await pageB.screenshot({ path: path.join(SHOTS_DIR, '03-station-b-remote-transcript-mobile.png'), fullPage: true })
    await pageB.setViewportSize({ width: 1280, height: 800 })
    await pageB.screenshot({ path: path.join(SHOTS_DIR, '03b-station-b-remote-transcript-desktop.png'), fullPage: true })
    await pageB.setViewportSize({ width: 390, height: 844 })

    await pageB.getByRole('button', { name: 'Open menu' }).click()
    const rowB = pageB.getByRole('link', { name: remoteB.title, exact: true }).locator('..')
    await rowB.getByRole('button', { name: 'Archive chat' }).click()
    const dialog = pageB.getByRole('alertdialog')
    await dialog.getByText('Archive this chat?').waitFor({ state: 'visible' })
    await pageB.waitForTimeout(500)
    await pageB.screenshot({ path: path.join(SHOTS_DIR, '04-station-b-archive-confirm-mobile.png'), fullPage: true })
    await dialog.getByRole('button', { name: 'Archive', exact: true }).click()

    await waitFor(async () => !(await storedConversations(pageB)).some(item => item.sessionId === evidence.sessionId), 'Station B archive removal')
    const archiveStarted = Date.now()
    await waitFor(async () => !(await storedConversations(pageA)).some(item => item.sessionId === evidence.sessionId), 'Station A archive propagation', 35_000)
    evidence.checks.stationAArchivePropagationLatencyMs = Date.now() - archiveStarted
    evidence.checks.archivePropagatedBackToStationA = true
    await pageA.screenshot({ path: path.join(SHOTS_DIR, '05-station-a-archive-propagated-desktop.png'), fullPage: true })

    const allFrames = [...evidence.protocolFrames.stationA, ...evidence.protocolFrames.stationB]
    const indexConnectA = evidence.protocolFrames.stationA.find(frame =>
      frame.direction === 'sent' && frame.type === 'CONNECT' && frame.sessionSyncOnly === true)
    const indexConnectB = evidence.protocolFrames.stationB.find(frame =>
      frame.direction === 'sent' && frame.type === 'CONNECT' && frame.sessionSyncOnly === true)
    evidence.checks.indexConnectsShareFrozenTimestamp = Boolean(
      indexConnectA?.connectTimestamp
      && indexConnectA.connectTimestamp === indexConnectB?.connectTimestamp
      && indexConnectA.connectTimestamp === evidence.fixedBrowserTimestamp)
    evidence.checks.indexConnectNoncesAreDistinct = Boolean(
      indexConnectA?.connectNonce
      && indexConnectB?.connectNonce
      && indexConnectA.connectNonce !== indexConnectB.connectNonce)
    evidence.checks.bothIndexConnectionsAccepted = ['stationA', 'stationB'].every(station =>
      evidence.protocolFrames[station].some(frame =>
        frame.direction === 'received' && frame.type === 'CONNECTED' && frame.status === 'index'))
    evidence.checks.noReplayOrResumeErrors = !allFrames.some(frame =>
      frame.type === 'ERROR'
      && /replay|session_sync_only cannot resume/i.test(frame.message || ''))
    evidence.checks.noProtocolErrors = !allFrames.some(frame => frame.type === 'ERROR')
    evidence.checks.stationBNeverClaimsLiveSession = !evidence.protocolFrames.stationB.some(frame =>
      frame.direction === 'sent' && frame.type === 'CONNECT'
      && frame.sessionId === evidence.sessionId && frame.sessionSyncOnly !== true)
    evidence.checks.protocolNegotiatedSessionSync = allFrames.some(frame =>
      frame.type === 'CONNECT'
      && frame.sessionSyncOnly === true
      && frame.requestedExtensions?.['session-sync']?.includes?.('0.1'))
    evidence.checks.sawSessionSyncResult = allFrames.some(frame => frame.type === 'SESSION_SYNC_RESULT')
    evidence.checks.sawSessionGetResult = allFrames.some(frame => frame.type === 'SESSION_SNAPSHOT')
    evidence.checks.sawSessionUpdateResult = allFrames.some(frame => frame.type === 'SESSION_UPDATED')

    for (const [name, passed] of Object.entries({
      sameIdentityAcrossIsolatedContexts: evidence.checks.sameIdentityAcrossIsolatedContexts,
      stationBInitiallyEmpty: evidence.checks.stationBInitiallyEmpty,
      stationBLoadedRemoteTranscript: evidence.checks.stationBLoadedRemoteTranscript,
      stationBTranscriptUpdatedWithoutReload: evidence.checks.stationBTranscriptUpdatedWithoutReload,
      remoteTranscriptSurvivesReload: evidence.checks.remoteTranscriptSurvivesReload,
      remoteTranscriptHasNoDuplicates: evidence.checks.remoteTranscriptHasNoDuplicates,
      remoteComposerReadOnly: evidence.checks.remoteComposerReadOnly,
      noBlankRemoteConversations: evidence.checks.noBlankRemoteConversations,
      archivePropagatedBackToStationA: evidence.checks.archivePropagatedBackToStationA,
      indexConnectsShareFrozenTimestamp: evidence.checks.indexConnectsShareFrozenTimestamp,
      indexConnectNoncesAreDistinct: evidence.checks.indexConnectNoncesAreDistinct,
      bothIndexConnectionsAccepted: evidence.checks.bothIndexConnectionsAccepted,
      noReplayOrResumeErrors: evidence.checks.noReplayOrResumeErrors,
      noProtocolErrors: evidence.checks.noProtocolErrors,
      stationBNeverClaimsLiveSession: evidence.checks.stationBNeverClaimsLiveSession,
      protocolNegotiatedSessionSync: evidence.checks.protocolNegotiatedSessionSync,
      sawSessionSyncResult: evidence.checks.sawSessionSyncResult,
      sawSessionGetResult: evidence.checks.sawSessionGetResult,
      sawSessionUpdateResult: evidence.checks.sawSessionUpdateResult,
    })) {
      if (!passed) throw new Error(`Required acceptance check failed: ${name}`)
    }
    if (Object.values(evidence.consoleErrors).some(errors => errors.length)) {
      throw new Error('A browser reported console or page errors; inspect evidence.json')
    }
    evidence.status = 'passed'
  } catch (error) {
    evidence.status = 'failed'
    evidence.error = error.stack || error.message
    await pageA.screenshot({ path: path.join(SHOTS_DIR, 'failure-station-a.png'), fullPage: true }).catch(() => {})
    await pageB.screenshot({ path: path.join(SHOTS_DIR, 'failure-station-b.png'), fullPage: true }).catch(() => {})
    throw error
  } finally {
    evidence.finishedAt = new Date().toISOString()
    fs.writeFileSync(path.join(SHOTS_DIR, 'evidence.json'), JSON.stringify(evidence, null, 2))
    await contextA.close()
    await contextB.close()
    await browser.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
