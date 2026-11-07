/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ChatItem } from '@connectonion/react'
import { ChatMessages } from './chat-messages'
import type { PendingApproval } from './types'

// This suite checks where a decision is placed. Keep unrelated specialised tool
// renderers out of the DOM; the real approval surface is intentionally retained.
vi.mock('./messages', () => {
  const EmptyMessage = () => null
  const ToolCall = ({ pendingApproval }: { pendingApproval?: PendingApproval }) => (
    pendingApproval ? <button type="button">Inline allow once</button> : null
  )
  const CodingAgentCard = ({
    invocation,
    pendingApproval,
  }: {
    invocation: { id: string }
    pendingApproval?: PendingApproval | null
  }) => (
    <div data-provider-card={invocation.id}>
      {pendingApproval ? <span data-native-decision="">Native decision</span> : <span>Provider card</span>}
    </div>
  )
  return {
    User: EmptyMessage,
    Agent: EmptyMessage,
    Thinking: EmptyMessage,
    ToolCall,
    CodingAgentCard,
    AskUser: EmptyMessage,
    OnboardRequired: () => <span data-onboard-required="">Verification required</span>,
    OnboardSuccess: () => <span data-onboard-success="">Verified — Continuing your request</span>,
    Intent: EmptyMessage,
    Eval: EmptyMessage,
    Compact: EmptyMessage,
    ToolBlocked: EmptyMessage,
    FilesReceived: EmptyMessage,
  }
})

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

beforeAll(() => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
})

let container: HTMLDivElement | null = null
let root: Root | null = null

function render(ui: ChatItem[], pendingApproval: PendingApproval, onApprovalResponse = vi.fn()) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(
    <ChatMessages
      ui={ui}
      pendingApproval={pendingApproval}
      onApprovalResponse={onApprovalResponse}
    />,
  ))
  return { element: container, onApprovalResponse }
}

function buttonNamed(element: ParentNode, name: string) {
  return Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(button =>
    button.textContent?.replace(/\s+/g, ' ').trim().startsWith(name),
  )
}

function revealMoreOptions(element: ParentNode) {
  const more = element.querySelector<HTMLElement>('summary')
  if (!more) throw new Error('More options was not rendered')
  act(() => more.click())
}

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

const approval: PendingApproval = {
  tool: 'write',
  arguments: { path: '/private/tmp/release.txt', command: 'echo release > release.txt' },
  description: 'Write the release marker',
}

const approvalItem: ChatItem = {
  id: 'approval-1',
  type: 'approval_needed',
  ...approval,
}

describe('ChatMessages permission decisions', () => {
  it('renders one success treatment after invite verification', () => {
    const required = { id: 'onboard-required', type: 'onboard_required', methods: ['invite_code'] } as ChatItem
    const success = { id: 'onboard-success', type: 'onboard_success', message: 'Invite code verified.' } as ChatItem
    const { element } = render([required, success], null as unknown as PendingApproval)

    expect(element.querySelector('[data-onboard-success]')).not.toBeNull()
    expect(element.querySelector('[data-onboard-required]')).toBeNull()
    expect(element.textContent).not.toContain('Verification completed')
  })

  it('renders a standalone generic approval with no raw arguments or broad trust action', () => {
    const { element } = render([approvalItem], approval)

    expect(element.querySelector('[aria-label="Approval required"]')).not.toBeNull()
    expect(element.querySelector('[data-pending-decision]')).not.toBeNull()
    expect(element.textContent).toContain('Decision needed')
    expect(element.textContent).not.toContain('/private/tmp/release.txt')
    expect(element.textContent).not.toContain('echo release')
    expect(buttonNamed(element, 'Allow once')).toBeDefined()
    expect(buttonNamed(element, 'Trust write')).toBeUndefined()
    expect(buttonNamed(element, 'Stop')).toBeUndefined()
  })

  it('routes Allow once through the typed approval callback', () => {
    const { element, onApprovalResponse } = render([approvalItem], approval)
    act(() => buttonNamed(element, 'Allow once')!.click())
    expect(onApprovalResponse).toHaveBeenCalledWith(true, 'once', undefined)
  })

  it.each([
    ['Decline', 'reject_soft'],
    ['Decline and ask why', 'reject_explain'],
  ] as const)('routes %s through the typed approval callback', (label, mode) => {
    const { element, onApprovalResponse } = render([approvalItem], approval)
    if (label !== 'Decline') revealMoreOptions(element)
    act(() => buttonNamed(element, label)!.click())
    expect(onApprovalResponse).toHaveBeenCalledWith(false, 'once', mode)
  })

  it('keeps approval inline when a matching running tool card exists', () => {
    const toolItem: ChatItem = {
      id: 'tool-1',
      type: 'tool_call',
      name: 'write',
      args: { path: 'release.txt' },
      status: 'running',
    }
    const { element } = render([toolItem, approvalItem], approval)

    expect(element.querySelector('[aria-label="Approval required"]')).toBeNull()
    expect(buttonNamed(element, 'Inline allow once')).toBeDefined()
    expect(element.querySelectorAll('[data-pending-decision]')).toHaveLength(1)
  })

  it('attaches a native approval only to its exact provider invocation', () => {
    const provider = {
      id: 'codex:outer',
      type: 'provider_invocation',
      parentToolCallId: 'outer',
      provider: 'codex',
      providerDisplayName: 'Codex',
      status: 'awaiting_approval',
      activities: [],
    } as ChatItem
    const genericCodexTool: ChatItem = {
      id: 'generic-codex', type: 'tool_call', name: 'codex', status: 'running', args: {},
    }
    const correlated: PendingApproval = {
      id: 'approval-codex',
      tool: 'codex',
      arguments: {},
      provider: 'codex',
      providerInvocationId: 'codex:outer',
      parentToolCallId: 'outer',
    }

    const { element } = render([genericCodexTool, provider], correlated)
    const card = element.querySelector<HTMLElement>('[data-provider-card="codex:outer"]')!
    expect(card.querySelector('[data-native-decision]')).not.toBeNull()
    expect(buttonNamed(element, 'Inline allow once')).toBeUndefined()
    expect(element.querySelectorAll('[data-pending-decision]')).toHaveLength(1)
  })

  it('does not merge separate provider runs merely because their session is the same', () => {
    const first = {
      id: 'codex:first', type: 'provider_invocation', parentToolCallId: 'first',
      provider: 'codex', providerDisplayName: 'Codex', status: 'completed',
      sessionId: 'shared-native-session', activities: [],
    } as ChatItem
    const second = {
      id: 'codex:second', type: 'provider_invocation', parentToolCallId: 'second',
      provider: 'codex', providerDisplayName: 'Codex', status: 'running',
      sessionId: 'shared-native-session', activities: [],
    } as ChatItem

    const { element } = render([first, second], approval)
    expect(element.querySelectorAll('[data-provider-card]')).toHaveLength(2)
    expect(element.querySelector('[data-provider-card="codex:first"]')).not.toBeNull()
    expect(element.querySelector('[data-provider-card="codex:second"]')).not.toBeNull()
  })
})

describe('a turn with grouped steps', () => {
  const done = (id: string) => ({ type: 'tool_call', id, name: 'bash', args: {}, status: 'done' }) as unknown as ChatItem
  const steps = [
    { type: 'user', id: 'u1', content: 'Fix the failing date test' } as unknown as ChatItem,
    done('t1'), done('t2'), done('t3'),
    { type: 'agent', id: 'a1', content: "I'll fix that one line." } as unknown as ChatItem,
  ]

  function renderTurn(ui: ChatItem[], props: { isLoading?: boolean; pendingApproval?: PendingApproval }) {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root!.render(<ChatMessages ui={ui} onApprovalResponse={vi.fn()} {...props} />))
    return container
  }

  it('while it waits on approval, shows no Result and counts its steps honestly', () => {
    const editing = { type: 'tool_call', id: 't4', name: 'edit', args: {}, status: 'running' } as unknown as ChatItem
    const element = renderTurn([...steps, editing], {
      isLoading: true,
      pendingApproval: { id: 'ap1', tool: 'edit', arguments: {} } as PendingApproval,
    })
    expect(Array.from(element.querySelectorAll('h2')).map(h => h.textContent)).not.toContain('Result')
    const details = element.querySelector('details')!
    expect(details.querySelector('summary')!.textContent).toBe('3 steps done, 1 needs approval')
    expect(details.open).toBe(true)
  })

  it('once it ends, puts Result on its last message and folds the steps', () => {
    const element = renderTurn([...steps, done('t4'),
      { type: 'agent', id: 'a2', content: 'Fixed. The date tests pass.' } as unknown as ChatItem], {})
    const headings = Array.from(element.querySelectorAll('h2')).filter(h => h.textContent === 'Result')
    expect(headings).toHaveLength(1)
    expect(headings[0].closest('[data-completed-result]')?.getAttribute('data-completed-result')).toBe('a2')
    const details = element.querySelector('details')!
    expect(details.querySelector('summary')!.textContent).toBe('Task details 3 steps')
    expect(details.open).toBe(false)
  })
})
