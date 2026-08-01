/**
 * @purpose The <co-filter> component, exercised in a real DOM rather than as a
 *   string: the point of rendering it ourselves is the behaviour, and a regex
 *   over the bridge source would assert nothing a user can see.
 * @llm-note The agent never executes anything here — it writes a tag, and the
 *   bridge (the only script with a nonce) renders the control. That is what keeps
 *   the self-navigation hole in build-srcdoc.ts closed while dashboards still get
 *   to be interactive.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { bridgeScript, componentStyles } from './build-srcdoc'

const NONCE = 'deadbeefdeadbeefdeadbeefdeadbeef'

/** Run the bridge against a document holding the agent's markup. */
function render(agentHtml: string) {
  document.head.innerHTML = componentStyles()
  document.body.innerHTML = agentHtml
  const source = bridgeScript(NONCE)
    .replace(/^<script nonce="[^"]*">/, '')
    .replace(/<\/script>$/, '')
  // new Function is the point: this test executes the bridge script the way
  // the sandboxed iframe does. no-new-func is not enabled in this config, so a
  // disable directive here would itself be flagged as unused.
  new Function(source)()
}

const SKILLS = `
  <co-filter target="#skills" placeholder="Filter skills"></co-filter>
  <div id="skills">
    <button data-ochat-skill="deploy">deploy to a server</button>
    <button data-ochat-skill="release">cut a release</button>
    <button data-ochat-skill="review">review a PR</button>
  </div>`

function visible() {
  return Array.from(document.querySelectorAll('#skills > *'))
    .filter((el) => !el.hasAttribute('data-ochat-hidden'))
    .map((el) => el.textContent?.trim())
}

function input() {
  return document.querySelector('co-filter input') as HTMLInputElement
}

function type(value: string) {
  input().value = value
  input().dispatchEvent(new Event('input'))
}

describe('<co-filter>', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders a control the agent did not write', () => {
    render(SKILLS)

    expect(input()).not.toBeNull()
    expect(input().placeholder).toBe('Filter skills')
  })

  it('shows everything before anything is typed', () => {
    render(SKILLS)

    expect(visible()).toHaveLength(3)
  })

  it('narrows the list to what matches', () => {
    render(SKILLS)

    type('rele')

    expect(visible()).toEqual(['cut a release'])
  })

  it('matches anywhere in the text, not only the start', () => {
    render(SKILLS)

    type('server')

    expect(visible()).toEqual(['deploy to a server'])
  })

  it('ignores case, because nobody types a skill name exactly', () => {
    render(SKILLS)

    type('PR')

    expect(visible()).toEqual(['review a PR'])
  })

  it('restores the full list when the box is cleared', () => {
    render(SKILLS)
    type('rele')

    type('')

    expect(visible()).toHaveLength(3)
  })

  it('says how many matched, and only once there is a query', () => {
    render(SKILLS)
    const count = () => document.querySelector('[data-ochat-count]')?.textContent

    expect(count()).toBe('')

    type('re')
    expect(count()).toBe('2 of 3')
  })

  it('renders nothing when the target does not exist', () => {
    // A filter that filters nothing looks like a working control and is not one.
    render('<co-filter target="#missing"></co-filter>')

    expect(input()).toBeNull()
  })

  it('treats the placeholder as text, never as markup', () => {
    render(`
      <co-filter target="#skills" placeholder="&lt;img src=x onerror=alert(1)&gt;"></co-filter>
      <div id="skills"><button>one</button></div>`)

    expect(document.querySelector('co-filter img')).toBeNull()
    expect(input().placeholder).toContain('<img')
  })

  it('leaves a second filter on the same page working', () => {
    render(`
      <co-filter target="#a" placeholder="A"></co-filter>
      <div id="a"><p>alpha</p><p>beta</p></div>
      <co-filter target="#b" placeholder="B"></co-filter>
      <div id="b"><p>gamma</p><p>delta</p></div>`)

    const [first, second] = Array.from(
      document.querySelectorAll('co-filter input')) as HTMLInputElement[]
    second.value = 'gam'
    second.dispatchEvent(new Event('input'))

    expect(first.placeholder).toBe('A')
    expect(document.querySelectorAll('#a > *:not([data-ochat-hidden])')).toHaveLength(2)
    expect(document.querySelectorAll('#b > *:not([data-ochat-hidden])')).toHaveLength(1)
  })
})
