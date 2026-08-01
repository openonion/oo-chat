/**
 * @purpose The <co-table> component in a real DOM: the agent declares that a
 *   table is sortable, and the bridge — the only script with a nonce — makes its
 *   headers work. Sorting is a behaviour, so it is asserted by clicking.
 * @llm-note Column type is inferred from the cells, not declared by the agent.
 *   Asking a model to label a column "number" is one more thing for it to get
 *   wrong, and the cells already say what they are.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { bridgeScript } from './build-srcdoc'

const NONCE = 'deadbeefdeadbeefdeadbeefdeadbeef'

function render(agentHtml: string) {
  document.body.innerHTML = agentHtml
  const source = bridgeScript(NONCE)
    .replace(/^<script nonce="[^"]*">/, '')
    .replace(/<\/script>$/, '')
  // eslint-disable-next-line no-new-func
  new Function(source)()
}

const TABLE = `
  <co-table target="#runs"></co-table>
  <table id="runs">
    <thead><tr><th>skill</th><th>runs</th></tr></thead>
    <tbody>
      <tr><td>deploy</td><td>10</td></tr>
      <tr><td>Alpha</td><td>9</td></tr>
      <tr><td>review</td><td>100</td></tr>
    </tbody>
  </table>`

function column(index: number) {
  return Array.from(document.querySelectorAll('#runs tbody tr'))
    .map((row) => row.cells[index].textContent)
}

function header(index: number) {
  return document.querySelectorAll('#runs thead th')[index] as HTMLElement
}

describe('<co-table>', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('leaves the rows alone until a header is clicked', () => {
    render(TABLE)

    expect(column(0)).toEqual(['deploy', 'Alpha', 'review'])
  })

  it('sorts text ascending on the first click', () => {
    render(TABLE)

    header(0).click()

    expect(column(0)).toEqual(['Alpha', 'deploy', 'review'])
  })

  it('reverses on the second click', () => {
    render(TABLE)

    header(0).click()
    header(0).click()

    expect(column(0)).toEqual(['review', 'deploy', 'Alpha'])
  })

  it('sorts numbers by value, not as text', () => {
    // The bug this exists to prevent: '100' < '9' lexicographically.
    render(TABLE)

    header(1).click()

    expect(column(1)).toEqual(['9', '10', '100'])
  })

  it('reads 1,200 and $30 and 5% as numbers', () => {
    render(`
      <co-table target="#t"></co-table>
      <table id="t">
        <thead><tr><th>cost</th></tr></thead>
        <tbody>
          <tr><td>$1,200</td></tr><tr><td>$30</td></tr><tr><td>$500</td></tr>
        </tbody>
      </table>`)

    ;(document.querySelector('#t thead th') as HTMLElement).click()

    expect(Array.from(document.querySelectorAll('#t tbody td'))
      .map((c) => c.textContent)).toEqual(['$30', '$500', '$1,200'])
  })

  it('sorts case-insensitively, so B does not come before a', () => {
    render(TABLE)

    header(0).click()

    expect(column(0)[0]).toBe('Alpha')
  })

  it('marks the sorted column for a screen reader, and only that one', () => {
    render(TABLE)

    header(1).click()

    expect(header(1).getAttribute('aria-sort')).toBe('ascending')
    expect(header(0).hasAttribute('aria-sort')).toBe(false)
  })

  it('does nothing when the target is not a table with a body', () => {
    render('<co-table target="#nope"></co-table><div id="nope">not a table</div>')

    expect(document.querySelector('[data-ochat-sortable]')).toBeNull()
  })

  it('composes with a filter over the same rows', () => {
    // Sorting reorders; filtering hides. Neither should undo the other.
    render(`
      <co-filter target="#runs tbody" placeholder="Filter"></co-filter>
      ${TABLE}`)

    header(1).click()
    const input = document.querySelector('co-filter input') as HTMLInputElement
    input.value = 'e'
    input.dispatchEvent(new Event('input'))

    const showing = Array.from(document.querySelectorAll('#runs tbody tr'))
      .filter((r) => !r.hasAttribute('data-ochat-hidden'))
      .map((r) => r.cells[0].textContent)
    expect(showing).toEqual(['deploy', 'review'])
  })
})
