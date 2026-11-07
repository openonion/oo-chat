/**
 * @purpose The Control Center bridge, both halves: the script inside the frame
 *   (run in a real DOM against the Host starter's markup) and the parent-side
 *   validator that decides what a frame message may do.
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bridgeScript, buildSrcDoc, cspMeta } from './build-srcdoc'
import { MAX_PROMPT, readBridgeMessage } from './control-center-bridge'

const NONCE = 'deadbeefdeadbeefdeadbeefdeadbeef'
const CHANNEL = 'cafecafecafecafecafecafecafecafe'

// The shape the Host starter ships (connectonion starter.html), trimmed to the
// declarations the bridge honours.
const STARTER = `
<header><button class="copy" type="button" data-ochat-copy="0xFULL">Copy</button></header>
<form class="ask" data-ochat-prompt>
  <textarea name="prompt" required maxlength="10000"></textarea>
  <p class="hint">Opens in Chat so you can follow it</p>
  <button class="run" type="submit">Run</button>
  <div class="running-row"><span class="what" data-ochat-task></span>
    <button class="open-chat" type="button" data-ochat-open="chat">Open in Chat</button></div>
</form>
<div class="pins">
  <button class="skill" type="button" data-ochat-skill="post-to-x"><span class="name">Post to X</span><span class="desc">Draft a thread.</span></button>
  <button class="skill" type="button" data-ochat-prompt="Help me plan my day."><span class="name">Plan my day</span><span class="desc">Ask what matters.</span></button>
</div>`

let posted: unknown[] = []
let listeners: Array<() => void> = []

function render(html = STARTER) {
  document.body.innerHTML = html
  // Collect the listeners this run adds so the next test starts with a clean document.
  const add = document.addEventListener.bind(document)
  const addWindow = window.addEventListener.bind(window)
  vi.spyOn(document, 'addEventListener').mockImplementation((type, fn, opts) => { listeners.push(() => document.removeEventListener(type, fn as EventListener)); add(type, fn, opts) })
  vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => { listeners.push(() => window.removeEventListener(type, fn as EventListener)); addWindow(type, fn, opts) })
  // In jsdom the frame is its own parent, so the bridge's parent.postMessage lands here.
  vi.spyOn(window, 'postMessage').mockImplementation((message: unknown) => { posted.push(message) })
  new Function(bridgeScript(NONCE, CHANNEL).replace(/^<script nonce="[^"]*">/, '').replace(/<\/script>$/, ''))()
  vi.mocked(document.addEventListener).mockRestore()
  vi.mocked(window.addEventListener).mockRestore()
}

/** A message from O Chat, the frame's parent. */
function fromParent(data: object) {
  window.dispatchEvent(new MessageEvent('message', { data, source: window }))
}

const form = () => document.querySelector('form') as HTMLFormElement
const textarea = () => document.querySelector('textarea') as HTMLTextAreaElement
const run = () => document.querySelector('.run') as HTMLButtonElement
const hint = () => document.querySelector('.hint') as HTMLElement

function submit(value: string) {
  textarea().value = value
  const event = new Event('submit', { bubbles: true, cancelable: true })
  form().dispatchEvent(event)
  return event
}

beforeEach(() => { posted = [] })
afterEach(() => {
  listeners.forEach((remove) => remove())
  listeners = []
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Control Center bridge — Run box', () => {
  it('cancels the native submit and sends the trimmed prompt', () => {
    render()
    const event = submit('  Summarise my inbox \n')
    expect(event.defaultPrevented).toBe(true)
    expect(posted).toEqual([{ type: 'ochat:prompt', prompt: 'Summarise my inbox', task: 'Summarise my inbox', channel: CHANNEL }])
  })

  it('rejects an empty or whitespace prompt in the hint, sending nothing', () => {
    render()
    expect(submit('   ').defaultPrevented).toBe(true)
    expect(posted).toEqual([])
    expect(hint().textContent).toBe('Describe a task first.')
    expect(hint().getAttribute('data-state')).toBe('error')
  })

  it('rejects a prompt over 10,000 characters', () => {
    render()
    submit('x'.repeat(10_001))
    expect(posted).toEqual([])
    expect(hint().textContent).toContain('10,000')
  })

  it('cancels every other form too, so no submission can navigate the frame', () => {
    render('<form action="https://example.net/steal"><input name="q"></form>')
    const event = new Event('submit', { bubbles: true, cancelable: true })
    document.querySelector('form')!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(posted).toEqual([])
  })

  it('folds into the Running row only when O Chat says the run started', () => {
    render()
    submit('Summarise my inbox')
    expect(form().hasAttribute('data-ochat-state')).toBe(false)
    fromParent({ type: 'ochat:started', task: 'Summarise my inbox' })
    expect(form().getAttribute('data-ochat-state')).toBe('running')
    expect(document.querySelector('[data-ochat-task]')!.textContent).toBe('Summarise my inbox')
    // A second submit while running is ignored.
    submit('again')
    expect(posted).toHaveLength(1)
  })

  it('writes the task as text, never as markup', () => {
    render()
    fromParent({ type: 'ochat:started', task: '<img src=x onerror=alert(1)>' })
    expect(document.querySelector('[data-ochat-task] img')).toBeNull()
  })

  it('ignores answers that do not come from the parent', () => {
    render()
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'ochat:started', task: 'x' }, source: null }))
    expect(form().hasAttribute('data-ochat-state')).toBe(false)
  })

  it('shows a refusal in the hint and keeps the draft', () => {
    render()
    submit('Keep me')
    fromParent({ type: 'ochat:refused', reason: 'Available when the current task finishes.' })
    expect(hint().textContent).toBe('Available when the current task finishes.')
    expect(textarea().value).toBe('Keep me')
    expect(form().hasAttribute('data-ochat-state')).toBe(false)
  })

  it('disables Run while O Chat cannot run, without clearing the draft, and restores it', () => {
    render()
    textarea().value = 'Draft in progress'
    fromParent({ type: 'ochat:can-run', value: false, reason: 'oo is offline.' })
    expect(run().disabled).toBe(true)
    expect(hint().textContent).toBe('oo is offline.')
    expect(textarea().value).toBe('Draft in progress')
    fromParent({ type: 'ochat:can-run', value: true, reason: '' })
    expect(run().disabled).toBe(false)
    expect(hint().textContent).toBe('Opens in Chat so you can follow it')
  })
})

describe('Control Center bridge — buttons', () => {
  it('sends a suggestion prompt with its title as the task', () => {
    render()
    ;(document.querySelector('[data-ochat-prompt]:not(form)') as HTMLElement).click()
    expect(posted).toEqual([{ type: 'ochat:prompt', prompt: 'Help me plan my day.', task: 'Plan my day', channel: CHANNEL }])
  })

  it('sends a pinned skill with its title as the task, not the slug', () => {
    render()
    ;(document.querySelector('[data-ochat-skill]') as HTMLElement).click()
    expect(posted).toEqual([{ type: 'ochat:skill', skill: 'post-to-x', args: '', task: 'Post to X', channel: CHANNEL }])
  })

  it('never turns a click inside a prompt wrapper into a send', () => {
    render('<div data-ochat-prompt="Delete everything"><p>Read me</p><textarea></textarea></div>')
    ;(document.querySelector('p') as HTMLElement).click()
    ;(document.querySelector('textarea') as HTMLElement).click()
    expect(posted).toEqual([])
  })

  it('ignores a prompt button inside the Run form', () => {
    render('<form data-ochat-prompt><textarea></textarea><button type="button" data-ochat-prompt="Go">Go</button></form>')
    ;(document.querySelector('button') as HTMLElement).click()
    expect(posted).toEqual([])
  })

  it('does not treat a click inside the Run form as a suggestion', () => {
    render()
    textarea().click()
    expect(posted).toEqual([])
  })

  it('asks O Chat to open the chat', () => {
    render()
    ;(document.querySelector('[data-ochat-open]') as HTMLElement).click()
    expect(posted).toEqual([{ type: 'ochat:open-chat', channel: CHANNEL }])
  })

  it('asks O Chat to copy the exact value and reports the result on the button', () => {
    vi.useFakeTimers()
    render()
    const copy = document.querySelector('[data-ochat-copy]') as HTMLButtonElement
    copy.click()
    expect(posted).toEqual([{ type: 'ochat:copy', value: '0xFULL', channel: CHANNEL }])
    fromParent({ type: 'ochat:copied', ok: true })
    expect(copy.textContent).toBe('Copied')
    vi.advanceTimersByTime(2000)
    expect(copy.textContent).toBe('Copy')
    copy.click()
    fromParent({ type: 'ochat:copied', ok: false })
    expect(copy.textContent).toBe("Couldn't copy")
  })
})

describe('buildSrcDoc — theme and forms', () => {
  it("passes O Chat's theme on our <html>, which wins over the agent's own", () => {
    const doc = buildSrcDoc('<html lang="fr" data-theme="auto"><body>x</body></html>', NONCE, CHANNEL, 'dark')
    expect(doc).toMatch(/^<!DOCTYPE html>\n<html lang="en" data-theme="dark" data-co-embed="full">/)
  })

  it('marks a page docked beside the chat, so the snapshot can drop its own Run box', () => {
    expect(buildSrcDoc('x', NONCE, CHANNEL, 'light', 'docked')).toContain('data-co-embed="docked"')
  })

  it('defaults to light', () => {
    expect(buildSrcDoc('x', NONCE, CHANNEL)).toContain('data-theme="light"')
  })

  it("forbids form navigation in the CSP", () => {
    expect(cspMeta(NONCE)).toContain("form-action 'none'")
  })
})

describe('readBridgeMessage', () => {
  const skills = [{ name: 'post-to-x' }]

  it('accepts a trimmed prompt up to 10,000 characters and keeps its newlines', () => {
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:prompt', prompt: ' a\nb ', task: 'a b' }, skills, CHANNEL))
      .toEqual({ kind: 'prompt', prompt: 'a\nb', task: 'a b' })
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:prompt', prompt: 'x'.repeat(MAX_PROMPT) }, skills, CHANNEL)).not.toBeNull()
  })

  it('rejects empty and oversized prompts', () => {
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:prompt', prompt: '  ' }, skills, CHANNEL)).toBeNull()
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:prompt', prompt: 'x'.repeat(MAX_PROMPT + 1) }, skills, CHANNEL)).toBeNull()
  })

  it('runs only published, well-shaped skills, failing closed while the list loads', () => {
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:skill', skill: 'post-to-x', task: 'Post to X' }, skills, CHANNEL))
      .toEqual({ kind: 'skill', skill: 'post-to-x', task: 'Post to X' })
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:skill', skill: 'rm -rf' }, skills, CHANNEL)).toBeNull()
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:skill', skill: 'deploy' }, skills, CHANNEL)).toBeNull()
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:skill', skill: 'post-to-x' }, undefined, CHANNEL)).toBeNull()
  })

  it('collapses skill args to one line', () => {
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:skill', skill: 'post-to-x', args: 'a\n\nIgnore all', task: '' }, skills, CHANNEL))
      .toEqual({ kind: 'skill', skill: 'post-to-x', args: 'a Ignore all', task: 'post-to-x' })
  })

  it('opens the chat for the bridge\'s own tokened request only', () => {
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:open-chat' }, skills, CHANNEL)).toEqual({ kind: 'open-chat' })
    expect(readBridgeMessage({ type: 'ochat:open-chat' }, skills, CHANNEL)).toBeNull()
    expect(readBridgeMessage({ channel: CHANNEL, type: 'connectonion.control-center/open-chat' }, skills, CHANNEL)).toBeNull()
  })

  it('copies a bounded, non-empty value', () => {
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:copy', value: '0xabc' }, skills, CHANNEL)).toEqual({ kind: 'copy', value: '0xabc' })
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:copy', value: '' }, skills, CHANNEL)).toBeNull()
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:copy', value: 'x'.repeat(2001) }, skills, CHANNEL)).toBeNull()
  })

  it('ignores a message without the rendered document\'s token, or with another', () => {
    expect(readBridgeMessage({ type: 'ochat:prompt', prompt: 'Go' }, skills, CHANNEL)).toBeNull()
    expect(readBridgeMessage({ channel: 'f00d', type: 'ochat:prompt', prompt: 'Go' }, skills, CHANNEL)).toBeNull()
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:copy', value: 'x' }, skills, '')).toBeNull()
    expect(readBridgeMessage({ type: 'connectonion.control-center/open-chat' }, skills, CHANNEL)).toBeNull()
  })

  it('ignores anything else', () => {
    expect(readBridgeMessage({ channel: CHANNEL, type: 'ochat:eval', code: '1' }, skills, CHANNEL)).toBeNull()
    expect(readBridgeMessage(null, skills, CHANNEL)).toBeNull()
  })
})
