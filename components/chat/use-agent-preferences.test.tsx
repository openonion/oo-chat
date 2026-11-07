/** @vitest-environment jsdom */
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import type { UI } from './types'
import { useAgentSDK } from './use-agent-sdk'
import { useChatStore } from '../../store/chat-store'
import { useAgentConnection } from '../../store/agent-connection'
import { useAgentInfo } from '../../hooks/use-agent-info'

const sdk = vi.hoisted(() => ({
  status: 'idle', connectionState: 'connected', isProcessing: false,
  ui: [] as UI[], mode: 'auto', availableModes: [{ id: 'read-only', name: 'Read Only' }, { id: 'auto', name: 'Auto' }],
  reconnect: vi.fn(), setSessionMode: vi.fn(async () => undefined), input: vi.fn(),
}))
const fetchInfo = vi.hoisted(() => vi.fn(async () => ({ name: 'oo', online: false })))
vi.mock('@connectonion/react', () => ({ useAgentForHuman: () => sdk, fetchAgentInfo: fetchInfo }))
let state: ReturnType<typeof useAgentSDK>
let info: ReturnType<typeof useAgentInfo>
let session = 'draft-one'
function View() {
  const agent = useAgentSDK({ agentAddress: '0xagent', sessionId: session })
  const agentInfo = useAgentInfo(['0xagent'])
  useEffect(() => { state = agent; info = agentInfo })
  return null
}
let root: ReturnType<typeof createRoot>
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } })
})
beforeEach(() => {
  sdk.connectionState = 'connected'
  sdk.mode = 'auto'
  sdk.ui = []
  fetchInfo.mockResolvedValue({ name: 'oo', online: false })
})
afterEach(() => {
  act(() => root?.unmount())
  vi.clearAllMocks()
})
it('raises stale directory presence when connected and revalidates on reconnect', async () => {
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<View />))
  expect(info['0xagent'].online).toBe(true)
  for (const connection of ['disconnected', 'reconnecting']) {
    sdk.connectionState = connection
    await act(async () => root.render(<View />))
    expect(info['0xagent'].online).toBe(true)
  }
  const fetches = fetchInfo.mock.calls.length
  sdk.connectionState = 'connected'
  await act(async () => root.render(<View />))
  expect(info['0xagent'].online).toBe(true)
  expect(fetchInfo.mock.calls.length).toBeGreaterThan(fetches)
})
it('restores the per-agent mode for a new draft through a Host transaction', async () => {
  useChatStore.getState().setAgentMode('0xagent', 'read-only')
  session = 'new-mode-draft'
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<View />))
  expect(sdk.setSessionMode).toHaveBeenCalledWith('read-only')
  await act(async () => state.setSessionMode('auto'))
  expect(useChatStore.getState().agentModes['0xagent']).toBe('auto')
})


it('keeps input blocked during restoration and retries a timeout after reconnect', async () => {
  sdk.setSessionMode.mockRejectedValueOnce(new Error('Connection timed out'))
  useChatStore.getState().setAgentMode('0xagent', 'read-only')
  session = 'timeout-draft'
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<View />))
  expect(state.modeChangeError).toContain('timed out')
  act(() => state.send('do not send in Auto'))
  expect(sdk.input).not.toHaveBeenCalled()
  await act(async () => state.retryModeChange())
  expect(sdk.reconnect).toHaveBeenCalledOnce()
  expect(sdk.setSessionMode).toHaveBeenCalledTimes(2)
  sdk.mode = 'read-only'
  await act(async () => root.render(<View />))
  expect(state.modeChangePending).toBe(false)
  act(() => state.send('safe to send now'))
  expect(sdk.input).toHaveBeenCalledWith('safe to send now', expect.anything())
})


it('restores saved permissions after onboarding events and before the first prompt', async () => {
  sdk.mode = 'auto'
  sdk.ui = [{ id: 'onboarded', type: 'onboard_success', level: 'contact', message: 'You can now chat.' }]
  useChatStore.getState().setAgentMode('0xagent', 'read-only')
  session = 'onboarded-draft'
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<View />))
  expect(sdk.setSessionMode).toHaveBeenCalledWith('read-only')
  act(() => state.send('wait for the saved permissions'))
  expect(sdk.input).not.toHaveBeenCalled()
})

it.each(['disconnected', 'reconnecting'])('preserves directory presence during initial %s', async connection => {
  sdk.connectionState = connection
  fetchInfo.mockResolvedValue({ name: 'oo', online: true })
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<View />))
  expect(info['0xagent'].online).toBe(true)
  sdk.connectionState = 'connected'
})

it('retains positive presence when mounting into an existing connection and directory fetch fails', async () => {
  sdk.connectionState = 'disconnected'
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<View />))
  expect(info['0xagent'].online).toBe(false)
  act(() => root.unmount())
  const connection = { agentAddress: '0xagent', sessionId: 'existing' }
  useAgentConnection.getState().setConnection({ ...connection, state: 'connected' })
  fetchInfo.mockRejectedValue(new Error('Directory unavailable'))
  function InfoOnly() {
    const current = useAgentInfo(['0xagent'])
    useEffect(() => { info = current })
    return null
  }
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<InfoOnly />))
  expect(info['0xagent'].online).toBe(true)
  await act(async () => useAgentConnection.getState().setConnection({ ...connection, state: 'reconnecting' }))
  expect(info['0xagent'].online).toBe(true)
  act(() => useAgentConnection.getState().setConnection(null))
})
