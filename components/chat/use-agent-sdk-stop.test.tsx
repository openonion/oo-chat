/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { UI } from './types'
import { useAgentSDK } from './use-agent-sdk'

const sdk = vi.hoisted(() => ({
  status: 'working', connectionState: 'connected', isProcessing: true,
  ui: [] as UI[], interrupt: vi.fn(),
  checkSessionStatus: vi.fn(async () => 'idle'),
}))
vi.mock('@connectonion/react', () => ({ useAgentForHuman: () => sdk }))

it('shows optimistic Stop as stopped and preserves the final stopped result after OUTPUT', async () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const tool = { id: 'check', type: 'tool_call', name: 'bash', status: 'running' } as const
  sdk.ui = [tool, { ...tool, id: 'finished', status: 'done' }, { id: 'thought', type: 'thinking', status: 'running' }]
  let state: ReturnType<typeof useAgentSDK>
  function View() {
    state = useAgentSDK({ agentAddress: 'fixture-agent', sessionId: 'fixture-session' })
    return null
  }
  const root = createRoot(document.createElement('div'))
  await act(async () => root.render(<View />))
  await act(async () => state.interrupt())
  expect(state!.ui.map(item => 'status' in item && item.status)).toEqual(['stopped', 'done', 'done'])
  expect(sdk.interrupt).toHaveBeenCalledOnce()

  sdk.ui = [{ ...tool, status: 'stopped' } as UI]
  sdk.status = 'idle'
  sdk.isProcessing = false
  await act(async () => root.render(<View />))
  expect(state!.ui[0]).toMatchObject({ status: 'stopped' })
  act(() => root.unmount())
})
