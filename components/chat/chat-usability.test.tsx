/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { Chat } from './chat'
import { ModeStatusBar } from './mode-indicator'
import { ChatInput } from './chat-input'
import { Sidebar } from '../sidebar'
import { useChatStore } from '../../store/chat-store'

const fixture = vi.hoisted(() => ({
  pathname: '/agent/first-chat',
  onTranscribed: undefined as undefined | ((text: string) => void),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => fixture.pathname,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('../../hooks/use-recent-chat-sync', () => ({ useRecentChatSync: () => ({ archiveConversation: vi.fn() }) }))
vi.mock('@connectonion/react', () => ({
  fetchAgentInfo: async () => ({ name: 'oo', online: true }),
  useVoiceInput: (options: { onTranscribed?: (text: string) => void }) => {
    fixture.onTranscribed = options.onTranscribed
    return { status: 'idle', isRecording: false, isTranscribing: false, error: null, cancelRecording: vi.fn() }
  },
}))
let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => null, setItem: vi.fn(), removeItem: vi.fn(),
  } })
})
afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
})
it.each([undefined, 'New chat', 'New conversation'])('uses the first user message for placeholder title %s', sessionTitle => {
  const title = 'Investigate why the saved Read only permission disappears after reconnect'
  const html = renderToStaticMarkup(<Chat sessionState="connected" agentAddress="0xagent" sessionTitle={sessionTitle} hideComposer onSend={vi.fn()} ui={[
    { id: 'request', type: 'user', content: title },
  ]} />)
  const dom = document.createElement('div')
  dom.innerHTML = html
  expect(dom.querySelector('header p')?.textContent).toBe(title)
})
it('clears the draft when navigating to New chat', () => {
  container = document.createElement('div')
  root = createRoot(container)
  act(() => root.render(<ChatInput onSend={vi.fn()} />))
  act(() => fixture.onTranscribed?.('Unfinished message for the previous chat'))
  expect(container.querySelector('textarea')?.value).toContain('Unfinished message')
  fixture.pathname = '/agent'
  act(() => root.render(<ChatInput onSend={vi.fn()} />))
  expect(container.querySelector('textarea')?.value).toBe('')
})
it('disambiguates duplicate agent names with their short addresses', async () => {
  const addresses = ['0xabcd' + '0'.repeat(56) + '1234', '0xdef0' + '0'.repeat(56) + '5678', '0xbeef' + '0'.repeat(56) + '9012']
  useChatStore.setState({ agents: addresses, conversations: [] })
  container = document.createElement('div')
  root = createRoot(container)
  await act(async () => root.render(<Sidebar isOpen={false} onClose={vi.fn()} returnFocusRef={{ current: null }} />))
  for (const address of addresses) {
    const row = container.querySelector(`[data-agent-address="${address}"]`)!
    expect(row.textContent).toContain('oo')
    expect(row.textContent).toContain(`${address.slice(0, 6)}…${address.slice(-4)}`)
  }
  expect(container.textContent).toContain('O Chat')
  expect(container.textContent).toContain('Online')
})

it('sends on the first Send click while the mode menu is open', () => {
  const onSend = vi.fn()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<ChatInput onSend={onSend} statusBar={<ModeStatusBar mode="auto" onModeChange={vi.fn()} availableModes={[{ id: 'auto', name: 'Auto' }]} />} />))
  act(() => container.querySelector<HTMLButtonElement>('[aria-label="Mode: Auto"]')!.click())
  expect(container.querySelector('[role="menu"]')).not.toBeNull()
  const input = container.querySelector('textarea')!
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'send this')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const send = container.querySelector<HTMLButtonElement>('[aria-label="Send message"]')!
  act(() => send.dispatchEvent(new Event('pointerdown', { bubbles: true })))
  act(() => send.click())
  expect(onSend).toHaveBeenCalledWith('send this', undefined, undefined)
  expect(container.querySelector('[role="menu"]')).toBeNull()
})
