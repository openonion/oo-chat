/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ToolCallUI } from '../../types'
import { BashCard } from './bash-card'
import { BackgroundCard } from './background-card'
import { BrowserCard } from './browser-card'
import { CompactHeader } from './file-components'
import { GrepCard } from './grep-card'
import { HiOutlineDocument } from 'react-icons/hi'

vi.mock('./approval-buttons', () => ({ ApprovalButtons: () => null }))

beforeAll(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
})

let container: HTMLDivElement | null = null
let root: Root | null = null

function render(element: React.ReactNode) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(element))
  return container
}

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

describe('specialized tool action summaries', () => {
  it.each([
    ['bash', { command: 'cat /tmp/private' }, 'Inspect the release manifest'],
    ['glob', { pattern: '/tmp/private/*' }, 'Check workspace root contents'],
  ])('leads the %s card with its action summary', (name, args, summary) => {
    const toolCall = {
      id: `call-${name}`,
      type: 'tool_call',
      name,
      args,
      summary,
      status: 'done',
      result: '',
    } as ToolCallUI
    const element = render(name === 'bash'
      ? <BashCard toolCall={toolCall} />
      : <GrepCard toolCall={toolCall} />)

    expect(element.textContent).toContain(summary)
    expect(element.textContent).not.toContain('/tmp/private')
  })

  it('lets file cards lead with the action instead of the tool and path', () => {
    const element = render(
      <CompactHeader
        toolName="Write"
        fileName="private.txt"
        actionSummary="Create the release notes"
        Icon={HiOutlineDocument}
        status="done"
        needsApproval={false}
      />,
    )

    expect(element.textContent).toContain('Create the release notes')
    expect(element.textContent).not.toContain('private.txt')
  })

  it('uses summaries for browser and background activity', () => {
    const browser = render(<BrowserCard toolCall={{
      id: 'browser', type: 'tool_call', name: 'go_to',
      args: { url: 'https://private.example' }, summary: 'Open the release dashboard', status: 'done',
    } as ToolCallUI} />)
    expect(browser.textContent).toContain('Open the release dashboard')
    expect(browser.textContent).not.toContain('private.example')

    act(() => root!.unmount())
    container?.remove()
    root = null
    container = null

    const background = render(<BackgroundCard toolCall={{
      id: 'background', type: 'tool_call', name: 'call_omo_agent',
      args: { description: 'raw description' }, summary: 'Review the release diff', status: 'done',
    } as ToolCallUI} />)
    expect(background.textContent).toContain('Review the release diff')
    expect(background.textContent).not.toContain('raw description')
  })
})
