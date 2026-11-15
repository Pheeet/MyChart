#!/usr/bin/env python3
"""Apply the Find My theme to site/index.html (idempotent). Revert: git checkout pre-findmy-20261115 -- site/index.html"""
import re, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; SITE = HERE.parent / "site/index.html"
s = SITE.read_text(encoding="utf-8")
css = (HERE / "findmy.css").read_text(); js = (HERE / "findmy.js").read_text()
s = re.sub(r"\n?<style id=\"findmy\">.*?</style>", "", s, flags=re.S)
s = re.sub(r"\n?<script id=\"findmy-js\">.*?</script>", "", s, flags=re.S)
# system font stack instead of web fonts
s = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com/css2\?family=Space\+Grotesk[^"]*">', "", s)
# Apple-style chart colours (canvas)
OLD_C = re.compile(r'const C = \{ bg: "[^"]*", grid: "[^"]*", border: "[^"]*", fg: "[^"]*", muted: "[^"]*", up: "[^"]*", down: "[^"]*" \};')
NEW_C = 'const C = { bg: "rgba(0,0,0,0)", grid: "rgba(255,255,255,0.045)", border: "rgba(255,255,255,0.10)", fg: "#f5f5f7", muted: "#8e8e93", up: "#30d158", down: "#ff453a" };'
s, n = OLD_C.subn(NEW_C, s)
if n != 1: sys.exit("chart colour line not found")
s = s.replace('fontFamily: "IBM Plex Mono, monospace", fontSize: 11', 'fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, sans-serif", fontSize: 11')
s = s.replace('rightPriceScale: { borderColor: C.border },\n  crosshair:', 'rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.16, bottom: 0.10 } },\n  crosshair:')
s = s.replace('<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#0b0b0d">')
s = s.replace("</style>\n</head>", "</style>\n<style id=\"findmy\">\n" + css + "</style>\n</head>", 1)
s = s.replace("</body>", "<script id=\"findmy-js\">\n" + js + "</script>\n</body>", 1)
assert 'id="findmy"' in s and 'id="findmy-js"' in s
# dialog chart keeps a solid background (transparent canvas looks odd inside the modal)
s = re.sub(r'(createChart\(\$\("d-chart"\), \{\s*autoSize: true,\s*layout: \{ background: \{ color: )C\.bg', r'\1"#121214"', s, count=1)

# v3: click the focused trade again to unfocus (back to the normal view)
OLD_CLICK = '$("trades").onclick = (e) => {\n  const b = e.target.closest(".trade");\n  if (b) focusTrade(tradeById(b.dataset.id));\n};'
NEW_CLICK = '$("trades").onclick = (e) => {\n  const b = e.target.closest(".trade");\n  if (!b) return;\n  if (focusedId != null && String(b.dataset.id) === String(focusedId)) { focusedId = null; renderTrades(); applyTradeOverlays(); viewForTrades(); return; }  // findmy-unfocus\n  focusTrade(tradeById(b.dataset.id));\n};'
if "findmy-unfocus" not in s:
    if OLD_CLICK not in s: sys.exit("trade click handler not found")
    s = s.replace(OLD_CLICK, NEW_CLICK, 1)

# v4 (2026-11-16): page shows the REAL cent account ···530 (Diamond Rider v1.07R), amounts in USC, badge REAL.
REAL_PATCHES = [
    ('const fmtUsd = (v) => (v >= 0 ? "+$" : "-$") + Math.abs(v).toFixed(2);',
     'const fmtUsd = (v) => (v >= 0 ? "+" : "-") + Math.abs(v).toFixed(2) + " USC";  // findmy-real'),
    ('fmtUsd(net) : "$0.00"', 'fmtUsd(net) : "0.00 USC"'),
    ('fmtUsd(gp) : "$0.00"', 'fmtUsd(gp) : "0.00 USC"'),
    ('fmtUsd(gl) : "$0.00"', 'fmtUsd(gl) : "0.00 USC"'),
    ('<span class="acct mono" id="acct">Exness · Demo</span>', '<span class="acct mono" id="acct">Real · v1.07</span>'),
    ('$("acct").textContent = `Exness · Demo · Balance ${',
     '$("acct").textContent = `Real · v1.07 · Balance ${'),
    ('maximumFractionDigits: 2 })}`;', 'maximumFractionDigits: 2 })} USC`;'),
    ('<span class="psum-badge">DEMO</span>', '<span class="psum-badge fm-real">REAL</span>'),
    ('const BOTS = { ', 'const BOTS = { 2026111503: "Rider v1.07R", '),
]
if "findmy-real" not in s:
    for a, b in REAL_PATCHES:
        if a not in s: sys.exit("real patch target not found: " + a[:60])
        s = s.replace(a, b, 1)

# v5 (2026-11-16): header without broker / account type / account number (pages built before v5)
for a, b in [('id="acct">Exness · Real · Cent · v1.07</span>', 'id="acct">Real · v1.07</span>'),
             ('`Exness · Real · Cent · v1.07 · ···530 · Balance ${', '`Real · v1.07 · Balance ${')]:
    s = s.replace(a, b)
SITE.write_text(s, encoding="utf-8"); print("themed", len(s))
