/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CodingAgentCard } from './coding-agent-card'
import type { PendingApproval, ProviderInvocationUI } from '../types'

beforeAll(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

const rawInstruction = 'Work inside /private/tmp/codex-workroom. Create sort.c and test_sort.c, compile with cc -std=c11 -Wall -Wextra -Werror, run every fixture, inspect command output, and report every internal command.'

const activities: ProviderInvocationUI['activities'] = [
  { id: 'inspect', name: 'Read', status: 'done', sequence: 1, kind: 'inspect', title: 'Inspect the task', summary: 'Reviewed the requested sorting behavior', legacy: false },
  { id: 'create-sort', name: 'Edit', status: 'done', sequence: 2, kind: 'file_change', title: 'Create the sorting program', summary: 'Created the C sorting program', files: ['sort.c'], legacy: false },
  { id: 'create-test', name: 'Edit', status: 'done', sequence: 3, kind: 'file_change', title: 'Add sorting tests', summary: 'Added focused test coverage', files: ['test_sort.c'], legacy: false },
  { id: 'compile', name: 'Bash', status: 'done', sequence: 4, kind: 'command', title: 'Compile the program', summary: 'Compiled the C program with strict checks', legacy: false },
  { id: 'fixture-one', name: 'Bash', status: 'done', sequence: 5, kind: 'command', title: 'Run sorting fixture', summary: 'Verified an unsorted input case', legacy: false },
  { id: 'fixture-two', name: 'Bash', status: 'done', sequence: 6, kind: 'command', title: 'Run duplicate-value fixture', summary: 'Verified duplicate values', legacy: false },
  { id: 'tests', name: 'Bash', status: 'done', sequence: 7, kind: 'command', title: 'Run the test suite', summary: 'All sorting tests passed', legacy: false },
  { id: 'review', name: 'Read', status: 'running', sequence: 8, kind: 'inspect', title: 'Review the final result', summary: 'Checking the finished implementation', legacy: false },
]

const invocation: ProviderInvocationUI = {
  id: 'codex:call-7',
  type: 'provider_invocation',
  parentToolCallId: 'call-7',
  provider: 'codex',
  providerDisplayName: 'Codex',
  taskTitle: 'Build and verify a C sorting program',
  taskSummary: rawInstruction,
  currentSummary: 'Checking the finished implementation',
  status: 'running',
  activities,
}

function render(overrides: Partial<Parameters<typeof CodingAgentCard>[0]> = {}) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const props = { invocation, ...overrides }
  act(() => root!.render(<CodingAgentCard {...props} />))
  return { element: container, props }
}

function buttonNamed(element: ParentNode, label: string) {
  return Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
    .find(button => button.textContent?.replace(/\s+/g, ' ').trim().startsWith(label))
}

function workroom() {
  const room = document.querySelector<HTMLElement>('[role="dialog"]')
  if (!room) throw new Error('Work Room was not opened')
  return room
}

describe('CodingAgentCard', () => {
  it('keeps the transcript to task, status, semantic progress, and one action', () => {
    const { element } = render()

    expect(element.textContent).toContain('Codex · Working')
    expect(element.textContent).toContain('Build and verify a C sorting program')
    expect(element.textContent).toContain('Checking the finished implementation')
    expect(element.textContent).not.toContain(rawInstruction)
    expect(element.textContent).not.toContain('cc -std=c11')
    expect(element.textContent).not.toContain('/private/tmp/codex-workroom')
    expect(element.querySelector('pre')).toBeNull()
    expect(element.querySelector('details')).toBeNull()
    expect(buttonNamed(element, 'Open Work Room')).toBeDefined()
    expect(element.querySelectorAll('button')).toHaveLength(1)
  })

  it('starts in a one-scroll overview with only the latest three semantic steps', () => {
    const { element } = render()
    act(() => buttonNamed(element, 'Open Work Room')!.click())

    const room = workroom()
    expect(room.textContent).toContain('Current progress')
    expect(room.textContent).toContain('7 of 8 steps completed')
    expect(room.textContent).toContain('Review the final result')
    expect(room.textContent).toContain('Run the test suite')
    expect(room.textContent).toContain('Run duplicate-value fixture')
    expect(room.textContent).not.toContain('Inspect the task')
    expect(room.textContent).not.toContain(rawInstruction)
    expect(room.textContent).not.toContain('cc -std=c11')
    expect(room.querySelector('pre')).toBeNull()
    expect(room.querySelector('details')).toBeNull()
    expect(room.querySelector('textarea')).toBeNull()
    expect(buttonNamed(room, 'Chat')).toBeUndefined()
  })

  it('reveals earlier activity explicitly without creating a nested scroll region', () => {
    const { element } = render()
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const room = workroom()

    act(() => buttonNamed(room, 'Activity')!.click())
    const activitySection = room.querySelector<HTMLElement>('[aria-label="All provider activity"]')!
    expect(activitySection.querySelectorAll('li')).toHaveLength(3)
    expect(activitySection.querySelector('ol')?.className).not.toContain('overflow-y-auto')
    expect(buttonNamed(room, 'Show 5 earlier')).toBeDefined()

    act(() => buttonNamed(room, 'Show 5 earlier')!.click())
    expect(activitySection.querySelectorAll('li')).toHaveLength(8)
    expect(activitySection.textContent).toContain('Inspect the task')
    expect(activitySection.textContent).not.toContain('/private/tmp/codex-workroom')
  })

  it('uses the typed activity as the source of truth over a legacy raw duplicate', () => {
    const { element } = render({
      invocation: {
        ...invocation,
        activities: [
          { id: 'compile', name: 'Bash', status: 'done', args: { command: 'cc -std=c11 -Wall -Wextra -Werror sort.c' }, result: 'raw compiler output', legacy: true },
          { id: 'compile', name: 'Bash', status: 'done', sequence: 4, kind: 'command', title: 'Compile the program', summary: 'Compiled the C program with strict checks', legacy: false },
        ],
      },
    })
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const room = workroom()
    act(() => buttonNamed(room, 'Activity')!.click())

    expect(room.textContent).toContain('Compiled the C program with strict checks')
    expect(room.textContent).not.toContain('cc -std=c11')
    expect(room.textContent).not.toContain('raw compiler output')
    expect(room.textContent).not.toContain('Legacy activity')
  })

  it('shows only safe file evidence in the overview when it exists', () => {
    const { element } = render()
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const room = workroom()

    expect(room.textContent).toContain('sort.c')
    expect(room.textContent).toContain('test_sort.c')
    expect(room.textContent).not.toContain('/private/tmp/codex-workroom')
    expect(buttonNamed(room, 'Files')).toBeUndefined()
  })

  it('does not turn a legacy raw path into verified file evidence', () => {
    const { element } = render({
      invocation: {
        ...invocation,
        activities: [{
          id: 'legacy-path', name: 'Bash', status: 'done', legacy: true,
          args: { path: '/private/tmp/codex-workroom/private.c' },
        }],
      },
    })
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const room = workroom()

    expect(room.querySelector('[aria-label="Provider file evidence"]')).toBeNull()
    expect(room.textContent).not.toContain('private.c')
  })

  it('puts a native approval in Work Room with a narrow primary action', () => {
    const onApprovalResponse = vi.fn()
    const approval: PendingApproval = {
      id: 'approval-1',
      tool: 'codex',
      arguments: { command: 'cc -std=c11 -Wall -Wextra -Werror /private/tmp/codex-workroom/sort.c' },
      provider: 'codex',
      providerInvocationId: invocation.id,
      parentToolCallId: invocation.parentToolCallId,
      providerApproval: {
        action: 'Compile the requested C11 program',
        scope: 'This Work Room only',
        reason: 'Compile the requested workspace files before continuing',
        scopeClassification: 'workroom',
        allowOnce: true,
        allowSession: false,
        files: ['sort.c', 'test_sort.c'],
      },
    }
    const { element } = render({ pendingApproval: approval, onApprovalResponse })

    expect(element.textContent).toContain('Your decision is needed in the Work Room.')
    expect(element.textContent).not.toContain('Compile the requested C11 program')
    act(() => buttonNamed(element, 'Review decision')!.click())
    const room = workroom()
    expect(room.textContent).toContain('Compile the requested C11 program')
    expect(room.textContent).toContain('This Work Room only')
    expect(room.textContent).toContain('Compile the requested workspace files before continuing')
    expect(room.textContent).toContain('sort.c, test_sort.c')
    expect(room.textContent).not.toContain('cc -std=c11')
    expect(room.textContent).not.toContain('/private/tmp/codex-workroom')
    expect(buttonNamed(room, 'Allow once')).toBeDefined()
    expect(buttonNamed(room, 'Reject this request')).toBeDefined()
    expect(buttonNamed(room, 'Trust this Work Room for the session')).toBeUndefined()

    act(() => buttonNamed(room, 'Allow once')!.click())
    expect(onApprovalResponse).toHaveBeenCalledWith(true, 'once', undefined)
  })

  it('does not offer an allow action for approval outside the Work Room', () => {
    const { element } = render({
      pendingApproval: {
        tool: 'codex',
        arguments: { cwd: '/outside' },
        provider: 'codex',
        providerInvocationId: invocation.id,
        parentToolCallId: invocation.parentToolCallId,
        providerApproval: {
          action: 'Run an external command',
          scope: 'Outside this Work Room',
          reason: 'The provider requested a broader scope',
          scopeClassification: 'elevated',
          allowOnce: false,
          allowSession: false,
        },
      },
      onApprovalResponse: vi.fn(),
    })

    act(() => buttonNamed(element, 'Review decision')!.click())
    const room = workroom()
    expect(buttonNamed(room, 'Allow once')).toBeUndefined()
    expect(room.textContent).toContain('cannot be allowed here')
  })

  it('fails closed when a native approval has no Core-verified presentation', () => {
    const { element } = render({
      pendingApproval: {
        tool: 'codex',
        arguments: { command: 'private command' },
        provider: 'codex',
        providerInvocationId: invocation.id,
        parentToolCallId: invocation.parentToolCallId,
      },
      onApprovalResponse: vi.fn(),
    })

    act(() => buttonNamed(element, 'Review decision')!.click())
    const room = workroom()
    expect(room.textContent).toContain('Boundary could not be verified')
    expect(buttonNamed(room, 'Allow once')).toBeUndefined()
    expect(room.textContent).not.toContain('private command')
  })

  it('stops only this provider run from inside Work Room', () => {
    const onProviderStop = vi.fn()
    const { element } = render({ onProviderStop })
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const room = workroom()

    const stop = room.querySelector<HTMLButtonElement>('[aria-label="Stop Codex run"]')
    act(() => stop!.click())
    expect(onProviderStop).toHaveBeenCalledWith('codex:call-7')
    expect(room.textContent).toContain('Stopping…')
  })

  it('uses a static stopped marker for a cancelled provider run', () => {
    const { element } = render({
      invocation: {
        ...invocation,
        status: 'cancelled',
        resultSummary: 'The provider stopped',
      },
    })

    expect(element.querySelector('[data-tool-status="stopped"]')).not.toBeNull()
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    expect(workroom().querySelector('[data-tool-status="stopped"]')).not.toBeNull()
  })

  it('shows a terminal outcome instead of stale live progress', () => {
    const { element } = render({
      invocation: {
        ...invocation,
        status: 'completed',
        currentSummary: 'Checking the finished implementation',
        resultSummary: 'The provider completed its run',
      },
    })

    expect(element.textContent).toContain('The provider completed its run')
    expect(element.textContent).not.toContain('Checking the finished implementation')
  })

  it('returns focus to the card trigger when Escape closes Work Room', () => {
    const { element } = render()
    const trigger = buttonNamed(element, 'Open Work Room')!
    trigger.focus()
    act(() => trigger.click())
    expect(workroom()).not.toBeNull()

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
