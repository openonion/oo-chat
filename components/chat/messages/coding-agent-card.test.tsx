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
const screenshot = (
  'data:image/png;base64,'
  + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlRjyoAAAAASUVORK5CYII='
)

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
  taskTitle: 'Build and verify the requested C program',
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
    expect(element.textContent).toContain('Build and verify the requested C program')
    expect(element.textContent).toContain('Checking the finished implementation')
    expect(element.textContent).not.toContain(rawInstruction)
    expect(element.textContent).not.toContain('cc -std=c11')
    expect(element.textContent).not.toContain('/private/tmp/codex-workroom')
    expect(element.querySelector('pre')).toBeNull()
    expect(element.querySelector('details')).toBeNull()
    expect(buttonNamed(element, 'Open Work Room')).toBeDefined()
    expect(element.querySelectorAll('button')).toHaveLength(1)
    expect(element.querySelector('img')).toBeNull()
  })

  it('renders a verified current provider preview without adding another action', () => {
    const { element } = render({
      invocation: {
        ...invocation,
        stateRevision: 8,
        artifact: {
          id: 'screen-8',
          kind: 'screenshot',
          stateRevision: 8,
          thumbnailDataUrl: screenshot,
          alt: 'Latest provider workspace view',
        },
      },
    })

    const preview = element.querySelector<HTMLImageElement>('img[alt="Latest provider workspace view"]')
    expect(preview?.src).toBe(screenshot)
    expect(element.querySelectorAll('button')).toHaveLength(1)
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const workroomPreview = workroom().querySelector<HTMLImageElement>(
      '[aria-label="Latest provider view"] img[alt="Latest provider workspace view"]',
    )
    expect(workroomPreview?.src).toBe(screenshot)
  })

  it('fails closed for a preview from a different provider state revision', () => {
    const { element } = render({
      invocation: {
        ...invocation,
        stateRevision: 8,
        artifact: {
          id: 'stale-screen',
          kind: 'screenshot',
          stateRevision: 7,
          thumbnailDataUrl: screenshot,
          alt: 'Latest provider workspace view',
        },
      },
    })

    expect(element.querySelector('img')).toBeNull()
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    expect(workroom().querySelector('[aria-label="Latest provider view"]')).toBeNull()
  })

  it('does not expose a short legacy prompt as the compact task title', () => {
    const { element } = render({
      invocation: {
        ...invocation,
        taskTitle: 'Run /private/tmp/codex-workroom/private-script --token secret-value',
      },
    })

    expect(element.textContent).toContain('Codex task')
    expect(element.textContent).not.toContain('/private/tmp/codex-workroom')
    expect(element.textContent).not.toContain('secret-value')
  })

  it('uses a static attention state when a provider Stop is not yet confirmed', () => {
    const { element } = render({ providerStopPhase: 'unconfirmed' })

    expect(element.textContent).toContain('Codex · Status needs confirmation')
    expect(element.querySelector('[data-tool-status="error"]')).not.toBeNull()
    expect(element.querySelector('[data-tool-status="running"]')).toBeNull()
  })

  it('does not let a local Stop fallback hide a newer SDK-owned approval', async () => {
    const onProviderStop = vi.fn().mockResolvedValue({
      invocationId: invocation.id,
      stateRevision: 1,
    })
    const approval: PendingApproval = {
      id: 'approval-after-fresh-state',
      tool: 'codex',
      arguments: {},
      provider: 'codex',
      providerInvocationId: invocation.id,
      parentToolCallId: invocation.parentToolCallId,
      providerApproval: {
        action: 'Inspect the workspace',
        scope: 'This Work Room only',
        reason: 'Check the requested workspace result before continuing',
        scopeClassification: 'workroom',
        allowOnce: true,
        allowSession: false,
      },
    }
    const { element } = render({
      invocation: { ...invocation, stateRevision: 1 },
      onProviderStop,
    })

    act(() => buttonNamed(element, 'Open Work Room')!.click())
    await act(async () => {
      workroom().querySelector<HTMLButtonElement>('[aria-label="Stop Codex run"]')!.click()
      await Promise.resolve()
    })
    expect(workroom().textContent).toContain('Stop requested')

    act(() => root!.render(
      <CodingAgentCard
        invocation={{
          ...invocation,
          stateRevision: 2,
          status: 'awaiting_approval',
          currentSummary: 'Waiting for your decision',
        }}
        pendingApproval={approval}
        onApprovalResponse={vi.fn()}
        onProviderStop={onProviderStop}
        providerStopLifecycleOwned
      />,
    ))

    expect(workroom().textContent).toContain('Codex · Needs your decision')
    expect(workroom().querySelector('[aria-label="Approval required"]')).not.toBeNull()
    expect(workroom().querySelector('[aria-label="Stop Codex run"]')).toBeNull()
  })

  it('starts in a one-scroll overview with only the current semantic evidence', () => {
    const { element } = render()
    act(() => buttonNamed(element, 'Open Work Room')!.click())

    const room = workroom()
    expect(room.textContent).toContain('Current progress')
    expect(room.textContent).toContain('7 of 8 steps completed')
    expect(room.textContent).toContain('Checking the finished implementation')
    expect(room.querySelector('[aria-label="Latest completed step"]')?.textContent)
      .toContain('All sorting tests passed')
    expect(room.textContent).not.toContain('Run the test suite')
    expect(room.textContent).not.toContain('Run duplicate-value fixture')
    expect(room.textContent).not.toContain('Inspect the task')
    expect(room.textContent).not.toContain(rawInstruction)
    expect(room.textContent).not.toContain('cc -std=c11')
    expect(room.querySelector('pre')).toBeNull()
    expect(room.querySelector('details')).toBeNull()
    expect(room.querySelector('textarea')).toBeNull()
    expect(buttonNamed(room, 'Chat')).toBeUndefined()
  })

  it('reveals activity history explicitly without creating a nested scroll region', () => {
    const { element } = render()
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const room = workroom()

    expect(room.querySelector('[aria-label="All provider activity"]')).toBeNull()
    act(() => buttonNamed(room, 'Show activity history (8 steps)')!.click())
    const activitySection = room.querySelector<HTMLElement>('[aria-label="All provider activity"]')!
    expect(activitySection.querySelectorAll('li')).toHaveLength(8)
    expect(activitySection.querySelector('ol')?.className).not.toContain('overflow-y-auto')
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

    expect(room.textContent).toContain('Compiled the C program with strict checks')
    expect(room.textContent).not.toContain('cc -std=c11')
    expect(room.textContent).not.toContain('raw compiler output')
    expect(room.textContent).not.toContain('Legacy activity')
  })

  it('keeps safe file names in explicit history while the overview shows one semantic result', () => {
    const { element } = render()
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const room = workroom()

    expect(room.querySelector('[aria-label="Latest completed step"]')?.textContent)
      .toContain('All sorting tests passed')
    expect(room.querySelector('[aria-label="Provider file evidence"]')).toBeNull()
    expect(room.textContent).not.toContain('sort.c')
    expect(room.textContent).not.toContain('test_sort.c')
    expect(room.textContent).not.toContain('/private/tmp/codex-workroom')
    act(() => buttonNamed(room, 'Show activity history (8 steps)')!.click())
    expect(room.textContent).toContain('sort.c')
    expect(room.textContent).toContain('test_sort.c')
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
    const { element } = render({
      invocation: { ...invocation, status: 'awaiting_approval' },
      pendingApproval: approval,
      onApprovalResponse,
    })

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
    const buttonNames = Array.from(room.querySelectorAll('button'))
      .map(button => button.textContent?.replace(/\s+/g, ' ').trim())
    expect(buttonNames.indexOf('Allow once')).toBeLessThan(buttonNames.indexOf('Show activity history (8 steps)'))

    act(() => buttonNamed(room, 'Allow once')!.click())
    expect(onApprovalResponse).toHaveBeenCalledWith(true, 'once', undefined)
  })

  it('does not offer an allow action for approval outside the Work Room', () => {
    const { element } = render({
      invocation: { ...invocation, status: 'awaiting_approval' },
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
      invocation: { ...invocation, status: 'awaiting_approval' },
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

  it('waits for the Host acknowledgement before showing a scoped stop request', async () => {
    const onProviderStop = vi.fn(async () => ({
      invocationId: 'codex:call-7',
      stateRevision: 7,
    }))
    const { element } = render({ onProviderStop })
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const room = workroom()

    const stop = room.querySelector<HTMLButtonElement>('[aria-label="Stop Codex run"]')
    await act(async () => {
      stop!.click()
      await Promise.resolve()
    })
    expect(onProviderStop).toHaveBeenCalledWith('codex:call-7')
    expect(room.textContent).toContain('Stop requested. Waiting for Codex to confirm.')
    expect(stop?.disabled).toBe(true)

    act(() => buttonNamed(room, 'Back')!.click())
    expect(element.textContent).toContain('Codex · Stop requested')
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    expect(workroom().querySelector('[role="alert"]')).toBeNull()
    expect(workroom().textContent).toContain('Stop requested. Waiting for Codex to confirm.')
  })

  it('keeps the scoped Stop visible while Host acknowledgement is pending', async () => {
    let acknowledgeStop: ((value: { invocationId: string, stateRevision: number }) => void) | undefined
    const onProviderStop = vi.fn(() => new Promise<{ invocationId: string, stateRevision: number }>((resolve) => {
      acknowledgeStop = resolve
    }))
    const { element } = render({ onProviderStop })
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const room = workroom()
    const stop = room.querySelector<HTMLButtonElement>('[aria-label="Stop Codex run"]')!

    act(() => stop.click())

    expect(onProviderStop).toHaveBeenCalledWith('codex:call-7')
    expect(stop.textContent).toContain('Requesting stop')
    expect(stop.disabled).toBe(true)
    expect(room.textContent).toContain('Codex · Requesting stop')
    expect(room.querySelector('[role="status"]')?.textContent)
      .toContain('Requesting Host confirmation for the stop.')

    await act(async () => {
      acknowledgeStop!({ invocationId: 'codex:call-7', stateRevision: 7 })
      await Promise.resolve()
    })

    expect(room.querySelector('[role="status"]')?.textContent)
      .toContain('Stop requested. Waiting for Codex to confirm.')
  })

  it('requires confirmation when an acknowledged Stop receives no terminal provider state', async () => {
    vi.useFakeTimers()
    try {
      const { element } = render({ onProviderStop: vi.fn(async () => ({
        invocationId: 'codex:call-7',
        stateRevision: 7,
      })) })
      act(() => buttonNamed(element, 'Open Work Room')!.click())
      const room = workroom()

      await act(async () => {
        room.querySelector<HTMLButtonElement>('[aria-label="Stop Codex run"]')!.click()
        await Promise.resolve()
      })
      expect(room.textContent).toContain('Stop requested. Waiting for Codex to confirm.')

      act(() => buttonNamed(room, 'Back')!.click())

      await act(async () => {
        vi.advanceTimersByTime(15_000)
        await Promise.resolve()
      })

      expect(element.textContent).toContain('Codex · Status needs confirmation')
      act(() => buttonNamed(element, 'Open Work Room')!.click())
      expect(workroom().querySelector('[role="alert"]')?.textContent)
        .toContain('The Host accepted this stop request, but the provider has not confirmed a final state.')
      expect(workroom().querySelector('[aria-label="Stop Codex run"]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('marks state as unconfirmed when the Host rejects a scoped Stop', async () => {
    const onProviderStop = vi.fn(async () => {
      throw new Error('The provider run is no longer active. Try again.')
    })
    const { element } = render({ onProviderStop })
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const room = workroom()
    const stop = room.querySelector<HTMLButtonElement>('[aria-label="Stop Codex run"]')!

    await act(async () => {
      stop.click()
      await Promise.resolve()
    })

    expect(room.querySelector('[role="alert"]')?.textContent).toContain('The Host could not confirm the current provider state.')
    expect(room.textContent).toContain('Codex · Status needs confirmation')
    expect(room.textContent).not.toContain('Waiting for a refreshed provider state')
    expect(buttonNamed(room, 'Return to conversation')).toBeDefined()
    expect(room.textContent).not.toContain('Manual review is required only when the provider asks for it.')
    expect(room.querySelector('[data-tool-status="error"]')).not.toBeNull()
    expect(room.querySelector('[aria-label="Stop Codex run"]')).toBeNull()
  })

  it('keeps an unconfirmed Stop state visible after closing and reopening Work Room', async () => {
    const onProviderStop = vi.fn(async () => {
      throw new Error('The provider run is no longer active.')
    })
    const { element } = render({ onProviderStop })
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const room = workroom()

    await act(async () => {
      room.querySelector<HTMLButtonElement>('[aria-label="Stop Codex run"]')!.click()
      await Promise.resolve()
    })
    act(() => buttonNamed(room, 'Return to conversation')!.click())

    expect(element.textContent).toContain('Codex · Status needs confirmation')
    expect(element.textContent).toContain('Waiting for a refreshed provider state')
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    expect(workroom().querySelector('h1')?.textContent).toContain('Build and verify the requested C program')
    expect(workroom().querySelector('[role="alert"]')?.textContent)
      .toContain('The Host could not confirm the current provider state.')
    expect(workroom().querySelector('[aria-label="Stop Codex run"]')).toBeNull()
  })

  it('does not expose a stale approval while a rejected Stop leaves the provider state unknown', async () => {
    const pendingApproval: PendingApproval = {
      id: 'approval-race',
      tool: 'codex',
      arguments: {},
      provider: 'codex',
      providerInvocationId: invocation.id,
      parentToolCallId: invocation.parentToolCallId,
      providerApproval: {
        action: 'Inspect the workspace',
        scope: 'This Work Room only',
        reason: 'Check the requested workspace result before continuing',
        scopeClassification: 'workroom',
        allowOnce: true,
        allowSession: false,
      },
    }
    const { element } = render({
      pendingApproval,
      onApprovalResponse: vi.fn(),
      onProviderStop: vi.fn(async () => { throw new Error('The provider state is stale.') }),
    })

    expect(buttonNamed(element, 'Review decision')).toBeUndefined()
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const room = workroom()
    await act(async () => {
      room.querySelector<HTMLButtonElement>('[aria-label="Stop Codex run"]')!.click()
      await Promise.resolve()
    })

    expect(room.querySelector('[aria-label="Approval required"]')).toBeNull()
    expect(buttonNamed(room, 'Allow once')).toBeUndefined()
    expect(buttonNamed(room, 'Return to conversation')).toBeDefined()
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

  it('does not leave an approval policy looking like an active task after completion', () => {
    const { element } = render({
      invocation: {
        ...invocation,
        status: 'completed',
        resultSummary: 'The provider completed its run',
      },
    })

    act(() => buttonNamed(element, 'Open Work Room')!.click())
    const room = workroom()
    expect(room.querySelector('[aria-label="Permission boundary"]')?.textContent)
      .toContain('No further action is needed')
    expect(room.textContent).not.toContain('Each request needs your review.')
  })

  it('names the icon-only mobile Back control for assistive technology', () => {
    const { element } = render()
    act(() => buttonNamed(element, 'Open Work Room')!.click())
    expect(workroom().querySelector('[aria-label="Back to conversation"]')).not.toBeNull()
  })

  it('keeps native approval review options in the Work Room keyboard loop', () => {
    const approval: PendingApproval = {
      id: 'approval-focus',
      tool: 'codex',
      arguments: {},
      provider: 'codex',
      providerInvocationId: invocation.id,
      parentToolCallId: invocation.parentToolCallId,
      providerApproval: {
        action: 'Inspect the workspace',
        scope: 'This Work Room only',
        reason: 'Check the requested workspace result before continuing',
        scopeClassification: 'workroom',
        allowOnce: true,
        allowSession: false,
      },
    }
    const { element } = render({
      invocation: { ...invocation, status: 'awaiting_approval', activities: [activities[0]] },
      pendingApproval: approval,
      onApprovalResponse: vi.fn(),
    })
    act(() => buttonNamed(element, 'Review decision')!.click())
    const room = workroom()
    const reviewOptions = room.querySelector<HTMLElement>('summary')!
    const back = room.querySelector<HTMLElement>('[aria-label="Back to conversation"]')!

    reviewOptions.focus()
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
    expect(document.activeElement).toBe(back)
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })))
    expect(document.activeElement).toBe(reviewOptions)
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
