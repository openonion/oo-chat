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
    OnboardRequired: EmptyMessage,
    OnboardSuccess: EmptyMessage,
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
  it('renders a standalone generic approval with no raw arguments or broad trust action', () => {
    const { element } = render([approvalItem], approval)

    expect(element.querySelector('[aria-label="Approval required"]')).not.toBeNull()
    expect(element.querySelector('[data-pending-decision]')).not.toBeNull()
    expect(element.textContent).toContain('Needs your decision')
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
    ['Reject this request', 'reject_soft'],
    ['Reject and ask for an explanation', 'reject_explain'],
  ] as const)('routes %s through the typed approval callback', (label, mode) => {
    const { element, onApprovalResponse } = render([approvalItem], approval)
    if (label !== 'Reject this request') revealMoreOptions(element)
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
