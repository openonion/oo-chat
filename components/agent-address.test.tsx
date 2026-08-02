/**
 * @purpose Pin the top-up link's query parameter, because getting it wrong fails
 *   silently: the purchase page reads `?key=`, ignores anything else, and renders
 *   an empty form. Nothing throws, nothing is typed wrong, and the payer just sees
 *   a blank field where the agent's address should be. That is exactly how the
 *   previous `?agent=` link shipped and stayed broken.
 * @llm-note The address in the URL is the whole payload — the checkout endpoint
 *   takes an address and no auth ("anyone can pay for any address"), so the link
 *   working is the entire feature.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { AgentAddress, TopUp } from './agent-address'

const ADDRESS = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

let container: HTMLDivElement | null = null

function render(node: React.ReactElement) {
  container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(node))
  return container
}

afterEach(() => {
  container?.remove()
  container = null
})

describe('TopUp', () => {
  it('addresses the purchase page with ?key=, the only parameter it reads', () => {
    const link = render(<TopUp address={ADDRESS} balanceUsd={1.5} />).querySelector('a')
    expect(link?.getAttribute('href')).toBe(
      `https://o.openonion.ai/purchase?key=${ADDRESS}`
    )
  })

  it('carries the full address, not a truncated one', () => {
    const link = render(<TopUp address={ADDRESS} balanceUsd={1.5} />).querySelector('a')
    expect(new URL(link!.href).searchParams.get('key')).toBe(ADDRESS)
  })

  it('shows the balance so the reader knows whether topping up is needed', () => {
    expect(render(<TopUp address={ADDRESS} balanceUsd={0.4} />).textContent).toContain('$0.40')
  })

  it('opens in a new tab without handing the opener to the payment page', () => {
    const link = render(<TopUp address={ADDRESS} balanceUsd={1} />).querySelector('a')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toContain('noopener')
  })
})

describe('AgentAddress', () => {
  it('abbreviates by default but keeps the full address reachable', () => {
    const el = render(<AgentAddress address={ADDRESS} />)
    expect(el.textContent).not.toContain(ADDRESS)
    expect(el.querySelector('button')?.getAttribute('title')).toBe(ADDRESS)
  })

  it('shows the whole address once expanded — a payer has to be able to check it', () => {
    const el = render(<AgentAddress address={ADDRESS} />)
    act(() => el.querySelector('button')!.click())
    expect(el.textContent).toContain(ADDRESS)
  })
})
