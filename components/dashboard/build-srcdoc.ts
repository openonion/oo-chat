/**
 * @purpose Build the sandboxed-iframe srcDoc for agent-authored dashboard HTML:
 *   inject an authoritative CSP <meta> (per-render nonce) and the one-way click
 *   bridge. Pure/no-React so it can be unit- and browser-tested directly.
 * @llm-note Security rests on two browser-enforced layers (no DOMPurify):
 *   the CSP nonce (only the bridge script runs; agent <script>/onclick blocked;
 *   default-src 'none' blocks network) and the caller's sandbox="allow-scripts"
 *   opaque origin (no access to parent/keys). The nonce must be unguessable and
 *   fresh per render.
 */

export function cspMeta(nonce: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; script-src 'nonce-${nonce}'">`
}

export function bridgeScript(nonce: string): string {
  return `<script nonce="${nonce}">
document.addEventListener('click', function (e) {
  var el = e.target && e.target.closest ? e.target.closest('[data-ochat-skill]') : null;
  if (!el) return;
  parent.postMessage({
    type: 'ochat:skill',
    skill: el.getAttribute('data-ochat-skill'),
    args: el.getAttribute('data-ochat-args') || ''
  }, '*');
});
</script>`
}

/** Inject the CSP meta as the first <head> child (authoritative) and the bridge
 *  script at end of <body>. Handles agent HTML with or without head/body. */
export function buildSrcDoc(html: string, nonce: string): string {
  const csp = cspMeta(nonce)
  const bridge = bridgeScript(nonce)

  let out = html
  const headMatch = out.match(/<head[^>]*>/i)
  if (headMatch) {
    const at = headMatch.index! + headMatch[0].length
    out = out.slice(0, at) + csp + out.slice(at)
  } else {
    const htmlMatch = out.match(/<html[^>]*>/i)
    if (htmlMatch) {
      const at = htmlMatch.index! + htmlMatch[0].length
      out = out.slice(0, at) + '<head>' + csp + '</head>' + out.slice(at)
    } else {
      out = '<head>' + csp + '</head>' + out
    }
  }

  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, bridge + '</body>')
  } else {
    out = out + bridge
  }
  return out
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
