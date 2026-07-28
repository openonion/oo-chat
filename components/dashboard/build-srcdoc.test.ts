/**
 * @purpose Guard the dashboard sandbox boundary: the CSP and the click bridge must
 *   survive any agent-authored HTML, since that HTML is untrusted input.
 * @llm-note These cases are the regression suite for the original regex-injection
 *   approach, which located <head>/</body> by matching the raw string — a stray
 *   `<head>` in a comment moved the CSP meta inside that comment and dropped the
 *   policy entirely. Anything asserting "the CSP is present and authoritative
 *   regardless of what the agent wrote" belongs here.
 */

import { describe, it, expect } from 'vitest'
import { buildSrcDoc, cspMeta, bridgeScript, generateNonce } from './build-srcdoc'

const NONCE = 'deadbeefdeadbeefdeadbeefdeadbeef'

/** Everything before the agent's content — the part the agent must not be able to reach. */
function ourHead(doc: string): string {
  return doc.slice(0, doc.indexOf('<body>'))
}

describe('buildSrcDoc — CSP is authoritative', () => {
  const hostile = [
    ['a <head> inside a comment', '<!-- <head> --><html><head><title>T</title></head><body>hi</body></html>'],
    ['a <head> in text content', '<html><body><p>put &lt;head&gt; here</p><head></head></body></html>'],
    ['a </body> inside a comment', '<html><body><!-- </body> --><p>hi</p></body></html>'],
    ['no head at all', '<html><body>hi</body></html>'],
    ['no html or body', '<div>just a fragment</div>'],
    ['its own CSP meta first', '<html><head><meta http-equiv="Content-Security-Policy" content="default-src *"></head><body>hi</body></html>'],
    ['an unterminated attribute', '<html><body><div title="oops'],
    ['an unterminated comment', '<html><body><p>hi</p><!-- never closed'],
    ['an unterminated script tag', '<html><body><script nonce="'],
    ['an empty document', ''],
  ] as const

  it.each(hostile)('keeps the CSP ahead of the agent content: %s', (_label, html) => {
    const doc = buildSrcDoc(html, NONCE)
    const head = ourHead(doc)

    // Present, in *our* head, before a single agent byte is parsed.
    expect(head).toContain(cspMeta(NONCE))
    if (html) expect(head).not.toContain(html.slice(0, 20))
    // Not commented out: no comment opens before the meta.
    expect(head.slice(0, head.indexOf(cspMeta(NONCE)))).not.toContain('<!--')
  })

  it.each(hostile)('keeps the bridge ahead of the agent content: %s', (_label, html) => {
    const doc = buildSrcDoc(html, NONCE)
    expect(ourHead(doc)).toContain(bridgeScript(NONCE))
  })

  it('never rewrites the agent HTML', () => {
    const html = '<html><head><style>body{color:red}</style></head><body><h1>Hi</h1></body></html>'
    expect(buildSrcDoc(html, NONCE)).toContain(html)
  })

  it('locks down every fetch class an agent could use to phone home', () => {
    const csp = cspMeta(NONCE)
    expect(csp).toContain("default-src 'none'")   // covers connect/frame/script fallbacks
    expect(csp).toContain('img-src data:')        // no remote pixels
    expect(csp).toContain('font-src data:')
    expect(csp).not.toMatch(/script-src[^;"]*'unsafe-inline'/)  // agent inline scripts blocked
  })

  it('admits only the nonced bridge script', () => {
    const doc = buildSrcDoc('<body><script>alert(1)</script></body>', NONCE)
    const nonced = doc.match(/<script[^>]*>/g) || []
    expect(nonced.filter((tag) => tag.includes(`nonce="${NONCE}"`))).toHaveLength(1)
    expect(nonced).toHaveLength(2)  // ours + the agent's, which the CSP refuses to run
  })
})

describe('buildSrcDoc — the wrapper document', () => {
  it('sets charset and viewport itself, since the agent copies land in body', () => {
    const head = ourHead(buildSrcDoc('<html><head><meta charset="utf-16"></head><body>hi</body></html>', NONCE))
    expect(head).toContain('<meta charset="utf-8">')
    expect(head).toContain('name="viewport"')
  })

  it('carries the agent content in the body', () => {
    expect(buildSrcDoc('<h1>Home</h1>', NONCE)).toContain('<body>\n<h1>Home</h1>\n</body>')
  })
})

describe('bridgeScript', () => {
  it('posts the skill and args from the clicked element, and nothing else', () => {
    const src = bridgeScript(NONCE)
    expect(src).toContain("'ochat:skill'")
    expect(src).toContain('data-ochat-skill')
    expect(src).toContain('data-ochat-args')
    // One-way: it reads the frame's own DOM and posts out. It must never read from
    // the parent or accept messages back in.
    expect(src).not.toMatch(/addEventListener\(\s*'message'/)
    expect(src).not.toContain('parent.document')
  })
})

describe('bridgeScript — a dashboard does not link out', () => {
  // Neither the CSP nor the sandbox stops a frame navigating itself, so a link is
  // the one way agent HTML could replace Home with a page running under its own
  // CSP. A dashboard is one self-contained page, so the bridge cancels them.
  it('cancels clicks on external links but leaves same-page fragments alone', () => {
    const src = bridgeScript(NONCE)
    expect(src).toContain("closest('a[href]')")
    expect(src).toContain("charAt(0) !== '#'")
    expect(src).toContain('preventDefault')
  })

  it('cancels the default action on a skill button too, so an <a> button cannot navigate', () => {
    const src = bridgeScript(NONCE)
    // The skill branch must preventDefault before posting, or
    // <a href="..." data-ochat-skill="x"> would run the skill *and* navigate away.
    const skillBranch = src.slice(src.indexOf('data-ochat-skill'), src.indexOf('postMessage'))
    expect(skillBranch).toContain('preventDefault')
  })
})

describe('generateNonce', () => {
  it('is 128 bits of hex', () => {
    expect(generateNonce()).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is fresh per call — a reused nonce would let one dashboard predict the next', () => {
    const nonces = new Set(Array.from({ length: 100 }, generateNonce))
    expect(nonces.size).toBe(100)
  })
})
