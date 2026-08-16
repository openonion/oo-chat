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

/**
 * Styling for the components the bridge renders. Ours, not the agent's: a
 * dashboard is written by an LLM, and if every agent picked its own look, most
 * of them would be worse. The agent declares *what* to show; how it looks is not
 * a decision we hand out. `style-src 'unsafe-inline'` is already in the CSP.
 */
export function componentStyles(): string {
  return `<style>
/* O Chat owns the Control Center component contract. Agent pages may keep their
   existing layout, while bridge-owned controls share one accessible token set. */
:root {
  color-scheme: light dark;
  --cc-canvas: #f7f8f6;
  --cc-surface: #ffffff;
  --cc-text: #171a17;
  --cc-muted: #505650;
  --cc-border: #d9ddd7;
  --cc-focus: #075985;
  --cc-accent: #14733a;
  --cc-success: #14733a;
  --cc-warning: #8a4b08;
  --cc-danger: #b42318;
  --cc-radius: 10px;
  --cc-space: 12px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --cc-canvas: #111411;
    --cc-surface: #191d19;
    --cc-text: #f1f5f1;
    --cc-muted: #bbc4bb;
    --cc-border: #343b34;
    --cc-focus: #7dd3fc;
    --cc-accent: #62d68a;
    --cc-success: #62d68a;
    --cc-warning: #f7b955;
    --cc-danger: #ff8a80;
  }
}
co-filter { display: block; margin: 0 0 12px; }
co-filter input {
  width: 100%; box-sizing: border-box;
  min-height: 44px; padding: 9px 11px; border: 1px solid var(--cc-border); border-radius: var(--cc-radius);
  font: inherit; color: var(--cc-text); background: var(--cc-surface);
}
co-filter input:focus-visible { outline: 3px solid var(--cc-focus); outline-offset: 2px; }
co-filter [data-ochat-count] { display: block; margin-top: 6px; color: var(--cc-muted); font-size: .85em; }
[data-ochat-hidden] { display: none !important; }

co-chart { display: block; color: var(--cc-text); }
co-chart figure { margin: 0; }
co-chart figcaption { margin-bottom: 10px; font-weight: 700; }
co-chart [data-ochat-chart] { min-height: 140px; }
co-chart [data-ochat-bars] { display: grid; gap: 8px; }
co-chart [data-ochat-bar] { display: grid; grid-template-columns: minmax(70px,.4fr) 1fr auto; gap: 8px; align-items: center; }
co-chart [data-ochat-track] { height: 12px; overflow: hidden; border-radius: 999px; background: var(--cc-border); }
co-chart [data-ochat-fill] { height: 100%; min-width: 2px; border-radius: inherit; background: var(--cc-accent); }
co-chart [data-ochat-donut] { width: 148px; height: 148px; margin: 0 auto; border-radius: 50%; }
co-chart svg { display: block; width: 100%; height: 160px; overflow: visible; }
co-chart details { margin-top: 12px; }
co-chart summary { min-height: 44px; cursor: pointer; color: var(--cc-muted); }
co-chart table { width: 100%; border-collapse: collapse; }
co-chart th, co-chart td { padding: 7px 8px; border-top: 1px solid var(--cc-border); text-align: left; }
co-chart [data-ochat-chart-error] { padding: 12px; border: 1px solid var(--cc-border); border-radius: var(--cc-radius); color: var(--cc-muted); }

co-table { display: none; }
[data-ochat-sortable] th[data-ochat-sort] { cursor: pointer; user-select: none; }
[data-ochat-sortable] th[data-ochat-sort]:focus-visible { outline: 3px solid var(--cc-focus); outline-offset: 2px; }
[data-ochat-sortable] th[data-ochat-sort]::after {
  content: ''; opacity: .35; margin-left: .4em; font-size: .85em;
}
[data-ochat-sortable] th[aria-sort="ascending"]::after { content: '\\2191'; opacity: .9; }
[data-ochat-sortable] th[aria-sort="descending"]::after { content: '\\2193'; opacity: .9; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
</style>`
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

// <co-filter target="#skills" placeholder="Filter skills"> — the agent declares
// that a list is filterable; we render the control and do the filtering. Nothing
// the agent wrote executes, so the self-navigation hole described above never
// opens: there is no agent script in which to write location.href.
function ochatFilter(host) {
  if (host.getAttribute('data-ochat-ready')) return;
  var target = document.querySelector(host.getAttribute('target') || '');
  // A filter with nothing to filter is worse than none: it looks like a working
  // control and does nothing. Render only when the target is real.
  if (!target) return;
  host.setAttribute('data-ochat-ready', '1');

  var input = document.createElement('input');
  input.type = 'search';
  // Set as a property, never as markup: this is agent-authored text.
  input.placeholder = host.getAttribute('placeholder') || 'Filter';
  input.setAttribute('aria-label', input.placeholder);

  var count = document.createElement('span');
  count.setAttribute('data-ochat-count', '1');
  count.setAttribute('aria-live', 'polite');

  host.textContent = '';
  host.appendChild(input);
  host.appendChild(count);

  var items = [];
  for (var i = 0; i < target.children.length; i++) items.push(target.children[i]);

  function apply() {
    var q = input.value.trim().toLowerCase();
    var shown = 0;
    for (var i = 0; i < items.length; i++) {
      var hit = !q || (items[i].textContent || '').toLowerCase().indexOf(q) !== -1;
      if (hit) { items[i].removeAttribute('data-ochat-hidden'); shown++; }
      else { items[i].setAttribute('data-ochat-hidden', '1'); }
    }
    // Silent until something is typed: a count answers a question the user has
    // not asked yet.
    count.textContent = q ? (shown + ' of ' + items.length) : '';
  }

  input.addEventListener('input', apply);
  apply();
}

// <co-table target="#runs"> — the agent declares that a table is sortable; we
// make its headers controls. The column type is inferred rather than declared:
// asking a model to label a column "number" is one more thing for it to get
// wrong, and the cells already say what they are.
function ochatTable(host) {
  if (host.getAttribute('data-ochat-ready')) return;
  var table = document.querySelector(host.getAttribute('target') || '');
  if (!table || !table.tHead || !table.tBodies.length) return;
  host.setAttribute('data-ochat-ready', '1');
  table.setAttribute('data-ochat-sortable', '1');

  var body = table.tBodies[0];
  var headers = table.tHead.rows.length ? table.tHead.rows[0].cells : [];

  function sortBy(index, dir) {
    var rows = [];
    for (var i = 0; i < body.rows.length; i++) rows.push(body.rows[i]);
    // Read every cell once, before sorting: a comparator that re-reads the DOM
    // on each comparison is where a sort of a few hundred rows gets slow.
    var keyed = rows.map(function (row) {
      var cell = row.cells[index];
      return { row: row, text: (cell ? cell.textContent : '') || '' };
    });
    var numeric = keyed.every(function (k) {
      return k.text.trim() === '' || !isNaN(parseFloat(k.text.replace(/[,%$\\s]/g, '')));
    });
    keyed.sort(function (a, b) {
      var cmp;
      if (numeric) {
        cmp = parseFloat(a.text.replace(/[,%$\\s]/g, '') || '0')
            - parseFloat(b.text.replace(/[,%$\\s]/g, '') || '0');
      } else {
        // localeCompare so 'B' sorts after 'a', which is what a reader expects
        // and what a raw < comparison gets wrong.
        cmp = a.text.trim().toLowerCase().localeCompare(b.text.trim().toLowerCase());
      }
      return dir === 'descending' ? -cmp : cmp;
    });
    for (var j = 0; j < keyed.length; j++) body.appendChild(keyed[j].row);

    for (var h = 0; h < headers.length; h++) {
      if (h === index) headers[h].setAttribute('aria-sort', dir);
      else headers[h].removeAttribute('aria-sort');
    }
  }

  for (var c = 0; c < headers.length; c++) {
    (function (index) {
      var th = headers[index];
      th.setAttribute('data-ochat-sort', '1');
      th.setAttribute('tabindex', '0');
      th.setAttribute('role', 'button');
      th.addEventListener('click', function () {
        var next = th.getAttribute('aria-sort') === 'ascending'
          ? 'descending' : 'ascending';
        sortBy(index, next);
      });
    })(c);
  }
}

// <co-chart type="bar" data='[{"label":"Passed","value":42}]'> — bounded,
// inline data only. The visible details table is the accessible equivalent, so
// no result is encoded only by colour, canvas pixels, or hover interaction.
function ochatChart(host) {
  if (host.getAttribute('data-ochat-ready')) return;
  host.setAttribute('data-ochat-ready', '1');
  var raw = host.getAttribute('data') || '';
  var type = host.getAttribute('type') || 'bar';
  var title = (host.getAttribute('title') || 'Chart').slice(0, 120);
  var values;
  try { values = raw.length <= 8192 ? JSON.parse(raw) : null; } catch (_) { values = null; }
  var valid = Array.isArray(values) && values.length > 0 && values.length <= 50
    && (type === 'bar' || type === 'line' || type === 'donut')
    && values.every(function (item) {
      return item && typeof item === 'object' && typeof item.label === 'string'
        && item.label.length > 0 && item.label.length <= 80
        && typeof item.value === 'number' && isFinite(item.value) && item.value >= 0;
    });
  host.textContent = '';
  if (!valid) {
    var error = document.createElement('p');
    error.setAttribute('data-ochat-chart-error', '1');
    error.textContent = 'Chart unavailable: use 1–50 non-negative numeric values.';
    host.appendChild(error);
    return;
  }

  var figure = document.createElement('figure');
  var caption = document.createElement('figcaption');
  caption.textContent = title;
  figure.appendChild(caption);
  var visual = document.createElement('div');
  visual.setAttribute('data-ochat-chart', type);
  visual.setAttribute('aria-hidden', 'true');
  var max = Math.max.apply(null, values.map(function (item) { return item.value; })) || 1;

  if (type === 'bar') {
    var bars = document.createElement('div');
    bars.setAttribute('data-ochat-bars', '1');
    values.forEach(function (item) {
      var row = document.createElement('div');
      row.setAttribute('data-ochat-bar', '1');
      var label = document.createElement('span'); label.textContent = item.label;
      var track = document.createElement('span'); track.setAttribute('data-ochat-track', '1');
      var fill = document.createElement('span'); fill.setAttribute('data-ochat-fill', '1');
      fill.style.width = ((item.value / max) * 100) + '%'; track.appendChild(fill);
      var value = document.createElement('span'); value.textContent = String(item.value);
      row.appendChild(label); row.appendChild(track); row.appendChild(value); bars.appendChild(row);
    });
    visual.appendChild(bars);
  } else if (type === 'line') {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 600 160');
    var points = values.map(function (item, index) {
      var x = values.length === 1 ? 300 : 10 + index * (580 / (values.length - 1));
      var y = 150 - (item.value / max) * 140;
      return x + ',' + y;
    }).join(' ');
    var line = document.createElementNS(ns, 'polyline');
    line.setAttribute('points', points); line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'var(--cc-accent)'); line.setAttribute('stroke-width', '4');
    svg.appendChild(line); visual.appendChild(svg);
  } else {
    var total = values.reduce(function (sum, item) { return sum + item.value; }, 0) || 1;
    var colors = ['#14733a','#2563eb','#8a4b08','#7c3aed','#b42318','#0e7490'];
    var cursor = 0;
    var stops = values.map(function (item, index) {
      var start = cursor; cursor += (item.value / total) * 100;
      return colors[index % colors.length] + ' ' + start + '% ' + cursor + '%';
    });
    var donut = document.createElement('div'); donut.setAttribute('data-ochat-donut', '1');
    donut.style.background = 'conic-gradient(' + stops.join(',') + ')'; visual.appendChild(donut);
  }
  figure.appendChild(visual);

  var details = document.createElement('details');
  var summary = document.createElement('summary'); summary.textContent = 'Data table';
  var table = document.createElement('table');
  var head = document.createElement('thead'); var headRow = document.createElement('tr');
  ['Label', 'Value'].forEach(function (text) { var th = document.createElement('th'); th.textContent = text; headRow.appendChild(th); });
  head.appendChild(headRow); table.appendChild(head);
  var body = document.createElement('tbody');
  values.forEach(function (item) {
    var row = document.createElement('tr');
    var label = document.createElement('td'); label.textContent = item.label;
    var value = document.createElement('td'); value.textContent = String(item.value);
    row.appendChild(label); row.appendChild(value); body.appendChild(row);
  });
  table.appendChild(body); details.appendChild(summary); details.appendChild(table);
  figure.appendChild(details); host.appendChild(figure);
}

function ochatComponents() {
  var filters = document.querySelectorAll('co-filter');
  for (var i = 0; i < filters.length; i++) ochatFilter(filters[i]);
  var tables = document.querySelectorAll('co-table');
  for (var j = 0; j < tables.length; j++) ochatTable(tables[j]);
  var charts = document.querySelectorAll('co-chart');
  for (var k = 0; k < charts.length; k++) ochatChart(charts[k]);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ochatComponents);
} else {
  ochatComponents();
}
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
${componentStyles()}
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
