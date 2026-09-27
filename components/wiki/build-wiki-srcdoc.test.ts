/**
 * @purpose Guard the private Wiki's frame boundary: the CSP must be authoritative
 *   whatever the Host's HTML contains, and the Host's errors must map to a state
 *   with a next step rather than a raw string or a blank page.
 */

import { describe, it, expect } from 'vitest'
import { buildWikiSrcDoc, wikiCspMeta, wikiLinkGuard, WIKI_CSP_DIRECTIVES, WIKI_SANDBOX } from './build-wiki-srcdoc'
import { classifyWikiError } from './wiki-state'

const ourHead = (doc: string) => doc.slice(0, doc.indexOf('<body>'))

describe('buildWikiSrcDoc', () => {
  const hostile = [
    ['a <head> inside a comment', '<!-- <head> --><html><head><title>T</title></head><body>hi</body></html>'],
    ['its own looser CSP', '<html><head><meta http-equiv="Content-Security-Policy" content="default-src *"></head></html>'],
    ['an unterminated comment', '<html><body><!-- never closed'],
    ['an empty document', ''],
  ] as const

  it.each(hostile)('puts the CSP and link guard ahead of the Host HTML: %s', (_label, html) => {
    const doc = buildWikiSrcDoc(html)
    expect(ourHead(doc)).toContain(wikiCspMeta())
    expect(ourHead(doc)).toContain(wikiLinkGuard())
    expect(doc.lastIndexOf(html)).toBeGreaterThan(doc.indexOf('<body>'))
  })

  it('never edits the Host HTML', () => {
    const html = '<!doctype html><html><head><title>Wiki</title></head><body><script>const WIKI = {}</script></body></html>'
    expect(buildWikiSrcDoc(html)).toContain(html)
  })

  it('blocks network and forms but lets the reader run its own inline script', () => {
    const csp = WIKI_CSP_DIRECTIVES.join('; ')
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("connect-src 'none'")
    expect(csp).toContain("form-action 'none'")
    expect(csp).toContain("script-src 'unsafe-inline'")
    // A nonce would silently disable 'unsafe-inline' and with it the reader.
    expect(csp).not.toMatch(/nonce-/)
  })

  it('keeps the frame on an opaque origin', () => {
    expect(WIKI_SANDBOX).toContain('allow-scripts')
    expect(WIKI_SANDBOX).not.toContain('allow-same-origin')
    expect(WIKI_SANDBOX).not.toContain('allow-top-navigation')
    expect(WIKI_SANDBOX).not.toContain('allow-forms')
  })
})

describe('classifyWikiError', () => {
  it.each([
    ['Wiki is available only to the Host owner', 'denied'],
    ['Authentication required', 'denied'],
    ['Signed Wiki request required', 'denied'],
    ['Wiki is not available on this Host', 'unavailable'],
    ['Wiki reader exceeds the 16 MiB limit', 'too-large'],
    ['Host does not support OIP session-sync/0.1', 'outdated'],
  ])('%s → %s', (message, kind) => {
    expect(classifyWikiError(new Error(message)).kind).toBe(kind)
  })

  it('keeps an unknown message visible instead of dropping it', () => {
    expect(classifyWikiError(new Error('Session Sync request timed out'))).toEqual({
      kind: 'failed', message: 'Session Sync request timed out',
    })
  })
})
