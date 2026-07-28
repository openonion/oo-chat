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
 *
 *   **A dashboard is one self-contained page — it does not link out.** The bridge
 *   cancels any click on an `<a href>` that isn't a same-page fragment. This is a
 *   deliberate product constraint, not just hardening: everything a dashboard shows
 *   is inlined (the CSP already blocks external subresources), and its only action
 *   is running a skill, so there is nothing legitimate to navigate to.
 *
 *   It also closes a real hole. Neither the CSP nor the sandbox stops a frame from
 *   navigating *itself* — `frame-src` governs nested frames, and browsers never
 *   shipped `navigate-to`. A link would replace Home with a document running under
 *   its own CSP, where scripts and network are allowed again; it stays sandboxed
 *   (opaque origin, no forms, no popups, no top navigation) so it can't reach
 *   OChat's storage or keys, but it could render a convincing fake and exfiltrate
 *   whatever the user typed into it. DashboardPane keeps a backstop for navigation
 *   this can't intercept, such as a `<meta http-equiv="refresh">`.
 *
 *   If dashboards ever need to link out, this is the contract to revisit — and it
 *   is not a one-line change. Allowing navigation means deciding what the frame may
 *   navigate to, and either keeping the destination inside the sandbox (where it
 *   still can't be trusted) or opening it in a real tab via `allow-popups` plus a
 *   `target="_blank"` rel-safe path. Loosening the click handler alone would just
 *   re-open the hole above.
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
  var t = e.target;
  var el = t && t.closest ? t.closest('[data-ochat-skill]') : null;
  if (el) {
    e.preventDefault();
    parent.postMessage({
      type: 'ochat:skill',
      skill: el.getAttribute('data-ochat-skill'),
      args: el.getAttribute('data-ochat-args') || ''
    }, '*');
    return;
  }
  var a = t && t.closest ? t.closest('a[href]') : null;
  if (a && (a.getAttribute('href') || '').charAt(0) !== '#') e.preventDefault();
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
