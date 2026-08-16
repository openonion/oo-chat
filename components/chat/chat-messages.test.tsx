/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ChatItem } from '@connectonion/react'
import { ChatMessages } from './chat-messages'
import type { PendingApproval } from './types'

// The message barrel pulls in every specialised tool renderer, including modules
// whose Next.js path alias is not configured in Vitest. This suite is about the
// decision placement in ChatMessages, so keep unrelated renderers outside it.
vi.mock('./messages', () => {
  const EmptyMessage = () => null
  const ToolCall = ({ pendingApproval }: { pendingApproval?: PendingApproval }) => (
    pendingApproval ? <button type="button">Allow once</button> : null
  )
  const CodingAgentCard = ({ pendingApproval }: { pendingApproval?: PendingApproval | null }) => (
    pendingApproval ? <button type="button">Allow Codex once</button> : <span>Codex card</span>
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

function buttonNamed(element: HTMLElement, name: string) {
  return Array.from(element.querySelectorAll('button')).find(button =>
    button.textContent?.replace(/\s+/g, ' ').trim().startsWith(name),
  )
}

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

const approval: PendingApproval = {
  tool: 'write',
  arguments: { path: 'release.txt' },
  description: 'Write the release marker',
}

const approvalItem: ChatItem = {
  id: 'approval-1',
  type: 'approval_needed',
  ...approval,
}

describe('ChatMessages permission decisions', () => {
  it('renders every decision for a normalized permission without a tool update', () => {
    const { element } = render([approvalItem], approval)

    expect(element.querySelector('[aria-label="Approval required for write"]')).not.toBeNull()
    expect(element.querySelector('[data-pending-decision]')).not.toBeNull()
    expect(element.textContent).toContain('release.txt')
    expect(buttonNamed(element, 'Allow once')).toBeDefined()
    expect(buttonNamed(element, 'Trust write')).toBeDefined()
    expect(buttonNamed(element, 'Reject')).toBeDefined()
    expect(buttonNamed(element, 'Stop')).toBeDefined()
    expect(buttonNamed(element, 'Explain')).toBeDefined()

  })

  it.each([
    ['Allow once', true, 'once', undefined],
    ['Trust write', true, 'session', undefined],
    ['Reject', false, 'once', 'reject_soft'],
    ['Stop', false, 'once', 'reject_hard'],
    ['Explain', false, 'once', 'reject_explain'],
  ] as const)('routes %s through the typed approval callback', (label, approved, scope, mode) => {
    const { element, onApprovalResponse } = render([approvalItem], approval)

    act(() => buttonNamed(element, label)!.click())

    expect(onApprovalResponse).toHaveBeenCalledOnce()
    expect(onApprovalResponse).toHaveBeenCalledWith(approved, scope, mode)
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

    expect(element.querySelector('[aria-label="Approval required for write"]')).toBeNull()
    const allowOnceButtons = Array.from(element.querySelectorAll('button')).filter(button =>
      button.textContent?.includes('Allow once'),
    )
    expect(allowOnceButtons).toHaveLength(1)
    expect(element.querySelectorAll('[data-pending-decision]')).toHaveLength(1)
  })

  it('attaches a correlated native approval to its exact provider card, not a generic codex tool', () => {
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
      id: 'generic-codex', type: 'tool_call', name: 'codex', status: 'running',
    }
    const correlated: PendingApproval = {
      id: 'approval-codex',
      tool: 'codex',
      arguments: { action: 'Run pytest' },
      provider: 'codex',
      providerInvocationId: 'codex:outer',
      parentToolCallId: 'outer',
    }

    const { element } = render([genericCodexTool, provider], correlated)

    expect(element.textContent).toContain('Allow Codex once')
    expect(element.querySelectorAll('[data-pending-decision]')).toHaveLength(1)
  })
})
