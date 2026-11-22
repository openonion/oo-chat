/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest'

import { bridgeScript, componentStyles } from './build-srcdoc'

const NONCE = 'deadbeefdeadbeefdeadbeefdeadbeef'

function render(markup: string) {
  document.head.innerHTML = componentStyles()
  document.body.innerHTML = markup
  const source = bridgeScript(NONCE)
    .replace(/^<script nonce="[^"]*">/, '')
    .replace(/<\/script>$/, '')
  new Function(source)()
}

describe('<co-chart>', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it.each(['bar', 'line', 'donut'])('renders a bounded %s chart with a data table', (type) => {
    render(`<co-chart type="${type}" title="Release health"
      data='[{"label":"Passed","value":42},{"label":"Failed","value":2}]'></co-chart>`)

    expect(document.querySelector(`[data-ochat-chart="${type}"]`)).not.toBeNull()
    expect(document.querySelector('figcaption')?.textContent).toBe('Release health')
    expect(Array.from(document.querySelectorAll('tbody tr')).map((row) => row.textContent)).toEqual([
      'Passed42',
      'Failed2',
    ])
    expect(document.querySelector('summary')?.textContent).toBe('Data table')
  })

  it.each([
    'not json',
    '[]',
    '[{"label":"negative","value":-1}]',
    '[{"label":"script","value":"alert(1)"}]',
  ])('fails malformed data honestly without rendering a visual: %s', (data) => {
    render(`<co-chart data='${data}'></co-chart>`)

    expect(document.querySelector('[data-ochat-chart]')).toBeNull()
    expect(document.querySelector('[data-ochat-chart-error]')?.textContent).toContain('Chart unavailable')
  })

  it('treats labels and titles as text rather than markup', () => {
    render(`<co-chart title="&lt;img src=x onerror=alert(1)&gt;"
      data='[{"label":"&lt;script&gt;bad&lt;/script&gt;","value":1}]'></co-chart>`)

    expect(document.querySelector('co-chart img')).toBeNull()
    expect(document.querySelector('co-chart script')).toBeNull()
    expect(document.querySelector('figcaption')?.textContent).toContain('<img')
    expect(document.querySelector('tbody')?.textContent).toContain('<script>')
  })

  it('rejects oversized data before parsing', () => {
    const oversized = JSON.stringify([{ label: 'x'.repeat(8_200), value: 1 }])
    render(`<co-chart data='${oversized}'></co-chart>`)

    expect(document.querySelector('[data-ochat-chart-error]')).not.toBeNull()
  })
})
