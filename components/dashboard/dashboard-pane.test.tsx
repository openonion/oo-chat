/**
 * @purpose DashboardPane answers the Control Center bridge: prompts and skills
 *   become chat sends only from its own frame and only when a run may start;
 *   Open in Chat brings the chat forward; the running fold is never re-applied.
 *
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPane } from './dashboard-pane'
import { WorkspaceShell } from './workspace-shell'

let container: HTMLDivElement
let root: Root
const onSendPrompt = vi.fn()
const onRunSkill = vi.fn()

function pane(props: { html?: string; runBlockedReason?: string | null } = {}) {
  return (
    <DashboardPane html={props.html ?? '<form data-ochat-prompt></form>'} skills={[{ name: 'post-to-x' }]}
      onRunSkill={onRunSkill} onSendPrompt={onSendPrompt} runBlockedReason={props.runBlockedReason ?? null}
      agentName="Maren" />
  )
}

function render(node: React.ReactNode) {
  act(() => root.render(node))
}

function frame() {
  return container.querySelector('iframe')!.contentWindow!
}

/** The token the pane minted for the document it rendered (see bridgeScript). */
function channel() {
  return container.querySelector('iframe')!.getAttribute('srcdoc')!.match(/message\.channel = '([0-9a-f]+)'/)![1]
}

function fromFrame(data: object, source: Window | null = frame(), token: string | null = channel()) {
  const message = token === null ? data : { ...data, channel: token }
  act(() => { window.dispatchEvent(new MessageEvent('message', { data: message, source })) })
}

function repliesOf(target: Window) {
  return vi.spyOn(target, 'postMessage').mockImplementation(() => {})
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  onSendPrompt.mockReset()
  onRunSkill.mockReset()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

describe('DashboardPane — Control Center bridge', () => {
  it('names the frame for the agent, carries the theme and allows forms but not navigation', () => {
    render(pane())
    const iframe = container.querySelector('iframe')!
    expect(iframe.title).toBe('Maren Control Center')
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-forms')
    expect(iframe.getAttribute('srcdoc')).toContain('data-theme="light"')
    expect(iframe.getAttribute('srcdoc')).toContain("form-action 'none'")
  })

  it('keeps the frame when the agent name resolves, so a Run-box draft survives', () => {
    render(pane())
    const before = container.querySelector('iframe')!.getAttribute('srcdoc')
    render(<DashboardPane html="<form data-ochat-prompt></form>" skills={[{ name: 'post-to-x' }]}
      onRunSkill={onRunSkill} onSendPrompt={onSendPrompt} agentName="oo" />)
    expect(container.querySelector('iframe')!.getAttribute('srcdoc')).toBe(before)
    expect(container.querySelector('iframe')!.title).toBe('oo Control Center')
  })

  it('marks the page docked while it sits open beside the chat, and hides the status banner', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} })
    Object.defineProperty(window, 'localStorage', { value: { getItem: () => null, setItem() {} }, configurable: true })
    render(<WorkspaceShell hasDashboard chat={<div />} dashboard={pane()} dashboardStatus={<p data-banner="">Needs approval</p>} />)
    expect(container.querySelector('iframe')!.getAttribute('srcdoc')).toContain('data-co-embed="docked"')
    expect(container.querySelector('[data-banner]')).toBeNull()
  })

  it('is a full page, banner included, when not beside the chat (the phone tab)', () => {
    Object.defineProperty(window, 'localStorage', { value: { getItem: () => null, setItem() {} }, configurable: true })
    render(<WorkspaceShell hasDashboard chat={<div />} dashboard={pane()} dashboardStatus={<p data-banner="">Needs approval</p>} />)
    expect(container.querySelector('iframe')!.getAttribute('srcdoc')).toContain('data-co-embed="full"')
    expect(container.querySelector('[data-banner]')).not.toBeNull()
  })

  it('follows a dark app theme', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} })
    render(pane())
    expect(container.querySelector('iframe')!.getAttribute('srcdoc')).toContain('data-theme="dark"')
  })

  it('sends a Run-box prompt through the normal path and tells the frame it started', () => {
    render(pane())
    const replies = repliesOf(frame())
    fromFrame({ type: 'ochat:prompt', prompt: ' Summarise my inbox ', task: 'Summarise my inbox' })
    expect(onSendPrompt).toHaveBeenCalledWith('Summarise my inbox')
    expect(replies).toHaveBeenCalledWith({ type: 'ochat:started', task: 'Summarise my inbox' }, '*')
  })

  it('runs a pinned skill and labels the run with its title', () => {
    render(pane())
    const replies = repliesOf(frame())
    fromFrame({ type: 'ochat:skill', skill: 'post-to-x', args: '', task: 'Post to X' })
    expect(onRunSkill).toHaveBeenCalledWith('post-to-x', undefined)
    expect(replies).toHaveBeenCalledWith({ type: 'ochat:started', task: 'Post to X' }, '*')
  })

  it('refuses while busy or offline, sending nothing', () => {
    render(pane({ runBlockedReason: 'Available when the current task finishes.' }))
    const replies = repliesOf(frame())
    fromFrame({ type: 'ochat:prompt', prompt: 'Go', task: 'Go' })
    fromFrame({ type: 'ochat:skill', skill: 'post-to-x', task: 'Post to X' })
    expect(onSendPrompt).not.toHaveBeenCalled()
    expect(onRunSkill).not.toHaveBeenCalled()
    expect(replies).toHaveBeenCalledWith({ type: 'ochat:refused', reason: 'Available when the current task finishes.' }, '*')
  })

  it('tells the frame when Run must wait and when it may run again', () => {
    render(pane())
    const replies = repliesOf(frame())
    render(pane({ runBlockedReason: 'Maren is offline.' }))
    expect(replies).toHaveBeenLastCalledWith({ type: 'ochat:can-run', value: false, reason: 'Maren is offline.' }, '*')
    render(pane({ runBlockedReason: null }))
    expect(replies).toHaveBeenLastCalledWith({ type: 'ochat:can-run', value: true, reason: '' }, '*')
  })

  it('ignores a frame message without this document\'s token, so a navigated page cannot send', () => {
    render(pane())
    fromFrame({ type: 'ochat:prompt', prompt: 'Go', task: 'Go' }, frame(), null)
    fromFrame({ type: 'ochat:prompt', prompt: 'Go', task: 'Go' }, frame(), 'deadbeef')
    expect(onSendPrompt).not.toHaveBeenCalled()
    fromFrame({ type: 'ochat:prompt', prompt: 'Go', task: 'Go' })
    expect(onSendPrompt).toHaveBeenCalledWith('Go')
  })

  it('mints a new token for each rendered document', () => {
    render(pane())
    const first = channel()
    render(pane({ html: '<form data-ochat-prompt></form><p>next</p>' }))
    expect(channel()).not.toBe(first)
    fromFrame({ type: 'ochat:prompt', prompt: 'Go', task: 'Go' }, frame(), first)
    expect(onSendPrompt).not.toHaveBeenCalled()
  })

  it('ignores messages from any window but its own frame', () => {
    render(pane())
    fromFrame({ type: 'ochat:prompt', prompt: 'Go', task: 'Go' }, window)
    expect(onSendPrompt).not.toHaveBeenCalled()
  })

  it('never re-applies the running state to a new snapshot', () => {
    render(pane())
    const first = repliesOf(frame())
    fromFrame({ type: 'ochat:prompt', prompt: 'Go', task: 'Go' })
    expect(first).toHaveBeenCalledWith({ type: 'ochat:started', task: 'Go' }, '*')
    first.mockClear()
    render(pane({ html: '<form data-ochat-prompt></form><section>Now: Go</section>' }))
    const second = repliesOf(frame())
    act(() => { container.querySelector('iframe')!.dispatchEvent(new Event('load')) })
    const types = [...first.mock.calls, ...second.mock.calls].map(([message]) => (message as { type: string }).type)
    expect(types).toContain('ochat:can-run')
    expect(types).not.toContain('ochat:started')
  })

  it('copies the exact value and reports success to the frame', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(pane())
    const replies = repliesOf(frame())
    fromFrame({ type: 'ochat:copy', value: '0xFULL' })
    await act(async () => {})
    expect(writeText).toHaveBeenCalledWith('0xFULL')
    expect(replies).toHaveBeenCalledWith({ type: 'ochat:copied', ok: true }, '*')
  })

  it('Open in Chat brings the chat forward on a phone', () => {
    Object.defineProperty(window, 'localStorage', { value: { getItem: () => null, setItem() {} }, configurable: true })
    render(
      <WorkspaceShell hasDashboard defaultMobileView="home" chat={<div data-testid="chat" />} dashboard={pane()} />,
    )
    const chatPane = () => container.querySelector('[data-testid="chat"]')!.parentElement!
    expect(chatPane().className).toContain('hidden')
    fromFrame({ type: 'ochat:open-chat' })
    expect(chatPane().className).not.toMatch(/(^| )hidden( |$)/)
  })
})
