/**
 * @purpose Build the sandboxed-iframe srcDoc for the Host-rendered private Wiki
 *   reader (connectonion#1637): a document *we* own, carrying a restrictive CSP
 *   and a link guard, with the Host's HTML as body content.
 * @llm-note Same wrapping rule as components/dashboard/build-srcdoc.ts, for the
 *   same reason: the Host HTML is never edited. The first version of this route
 *   inserted the CSP with `html.replace('<head>', …)`, which a `<head>` inside a
 *   comment or a note defeats, silently dropping the CSP. Our head is parsed
 *   before any Host byte; browsers drop the nested <html>/<head>/<body> tags and
 *   keep their children, so the reader renders unchanged and a CSP it carries
 *   can only intersect with ours.
 *
 *   Differences from the dashboard, and why:
 *   - `script-src 'unsafe-inline'`, not a nonce. The reader *is* a script — its
 *     navigation, search and markdown rendering run from inline <script> in the
 *     Host's template — and a nonce in the policy disables 'unsafe-inline'. What
 *     keeps it contained is everything else: an opaque origin (sandbox without
 *     allow-same-origin, so no O Chat storage or keys), `default-src 'none'` and
 *     `connect-src 'none'` (no network: notes cannot be sent anywhere by fetch,
 *     images or fonts), and no forms.
 *   - External links in notes open in a new tab. The reader marks them
 *     `target="_blank" rel="noopener noreferrer"`; the frame carries
 *     allow-popups so a click on one works instead of doing nothing. Any other
 *     non-fragment link would navigate the frame itself, away from this CSP, so
 *     the guard cancels it. Internal navigation is all `#r=…` fragments, which the
 *     guard applies with `location.hash`: an <a href="#…"> in a srcdoc document
 *     resolves against the parent page's URL, so left alone the click loads
 *     O Chat itself into the frame.
 *     WikiView keeps the dashboard's backstop for navigation a click guard
 *     cannot see (a second iframe load means the reader was replaced).
 */

export const WIKI_CSP_DIRECTIVES = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  'font-src data:',
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
]

/** The iframe's sandbox. No allow-same-origin: the frame must stay opaque. */
export const WIKI_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox'

export function wikiCspMeta(): string {
  return `<meta http-equiv="Content-Security-Policy" content="${WIKI_CSP_DIRECTIVES.join('; ')}">`
}

/** Emitted before the Host HTML so unterminated markup there cannot swallow it. */
export function wikiLinkGuard(): string {
  return `<script>
document.addEventListener('click', function (e) {
  var t = e.target;
  var a = t && t.closest ? t.closest('a[href]') : null;
  if (!a) return;
  var href = a.getAttribute('href') || '';
  if (href.charAt(0) === '#') {
    // A srcdoc document resolves links against the *parent's* URL, so a plain
    // click on href="#r=…" loads O Chat's own page into the frame. Setting the
    // hash is the same-document navigation the reader's hashchange expects.
    e.preventDefault();
    location.hash = href.slice(1);
    return;
  }
  if (a.getAttribute('target') === '_blank' && /^(https?:|mailto:)/i.test(href)) return;
  e.preventDefault();
}, true);
// Says each load of this document to WikiFrame, which treats any other load
// (a document that replaced this one) as navigating away (frame-watch.ts).
window.addEventListener('load', function () { parent.postMessage('oo-wiki-ready', '*'); });
</script>`
}

export function buildWikiSrcDoc(html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${wikiCspMeta()}
${wikiLinkGuard()}
</head>
<body>
${html}
</body>
</html>`
}
