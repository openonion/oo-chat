/**
 * @purpose Build the sandboxed-iframe srcDoc for agent-authored dashboard HTML:
 *   a document *we* own, carrying an authoritative CSP (per-render nonce) and the
 *   one-way click bridge, with the agent's HTML as body content. Pure/no-React so
 *   it can be unit- and browser-tested directly.
 * @llm-note Security rests on two browser-enforced layers (no DOMPurify):
 *   the CSP nonce (only the bridge script runs; agent <script>/onclick blocked;
 *   default-src 'none' blocks network) and the caller's sandbox="allow-scripts"
 *   opaque origin (no access to parent/keys). The nonce must be unguessable and
 *   fresh per render.
 *
 *   The agent HTML is *wrapped*, never edited. An earlier version injected the CSP
 *   after the first /<head[^>]*>/i match in the raw string, which agent markup
 *   could defeat: a stray `<!-- <head> -->` earlier in the file put the meta inside
 *   a comment and dropped the CSP entirely, leaving sandbox="allow-scripts" as the
 *   only layer — which re-enables the agent's own <script> and network egress.
 *   Matching text to find HTML structure can't be made safe, so we don't: our head
 *   is emitted before any agent byte is parsed, where nothing in the agent's
 *   document can reach it. Browsers drop a nested <html>/<head>/<body> and keep the
 *   children, so a full agent document renders unchanged inside the wrapper — and
 *   its own <meta http-equiv="Content-Security-Policy">, if it has one, can only
 *   intersect with ours, never loosen it.
 *
 *   The bridge is emitted in <head> ahead of the agent HTML for the same reason:
 *   appended after it, unterminated agent markup (an unclosed attribute or comment)
 *   could swallow the script tag and silently kill every button. It binds a
 *   delegated listener on `document`, so it needs no DOM to exist yet.
 */

const CSP_DIRECTIVES = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  'font-src data:',
]

export function cspMeta(nonce: string): string {
  const content = [...CSP_DIRECTIVES, `script-src 'nonce-${nonce}'`].join('; ')
  return `<meta http-equiv="Content-Security-Policy" content="${content}">`
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

/**
 * Wrap agent HTML in a document we control: our <head> (charset, viewport, CSP,
 * bridge) followed by the agent's markup verbatim as body content.
 *
 * The agent HTML is never rewritten — no regex, no parsing, nothing a hand-crafted
 * string can steer. charset and viewport are ours because the agent's own copies
 * land in <body>, where a browser may ignore them.
 */
export function buildSrcDoc(html: string, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${cspMeta(nonce)}
${bridgeScript(nonce)}
</head>
<body>
${html}
</body>
</html>`
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
