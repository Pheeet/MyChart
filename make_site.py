#!/usr/bin/env python3
"""One-off: derive the static GitHub Pages copy (site/index.html) from ~/apps/chartfeed/index.html (read-only).
Removes AI buttons/actions, masks the account number, swaps /api/* calls for data/*.json files."""
import re, sys
from pathlib import Path
src = (Path.home() / "apps/chartfeed/index.html").read_text(encoding="utf-8")

def sub(old, new, count=1):
    global src
    if old not in src:
        sys.exit(f"pattern not found: {old[:60]!r}")
    src = src.replace(old, new, count)

src, n = re.subn(r'<span class="acct mono">Exness · Demo · MT5 #\d+</span>', '<span class="acct mono" id="acct">Exness · Demo</span>', src)
if n != 1:
    sys.exit("account header not found")
# the old AI confirm text names the account; it is removed with startJob below
# drop the hidden AI buttons
src = re.sub(r'<!-- AI analyze buttons.*?</div>\n', '', src, count=1, flags=re.S)
sub('<p>ผลวิเคราะห์ของสัญลักษณ์ที่เปิดอยู่ · ปุ่มอยู่เหนือกราฟ</p>', '<p></p>')
sub('<div id="ai"><div class="empty">กดปุ่มวิเคราะห์เหนือกราฟเพื่ออ่านกราฟ M15 ตอนนี้</div></div>', '<div id="ai"></div>')

SHIM = r'''<script>
// ---- Static GitHub Pages build: /api/* is served from data/*.json (published every 2 min from the server) ----
const DATA_BASE = "data/";
const _fetch = window.fetch.bind(window);
const _bust = () => "?t=" + Math.floor(Date.now() / 30000);
const _json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
window.fetch = async (url, opts) => {
  const u = new URL(url, location.href);
  if (!u.pathname.includes("/api/")) return _fetch(url, opts);
  if (opts && opts.method && opts.method !== "GET") return _json({ error: "read-only" }, 405);
  const ep = u.pathname.split("/api/")[1];
  const get = (f) => _fetch(DATA_BASE + f + _bust(), { cache: "no-store" });
  if (ep === "symbols") return get("symbols.json");
  if (ep === "trades") return get("trades.json");
  if (ep === "bars") {
    const r = await get(`bars/${u.searchParams.get("sym")}_${u.searchParams.get("tf")}.json`);
    if (!r.ok) return r;
    const j = await r.json();
    return _json({ digits: j.digits, bars: j.bars.map(([t, o, h, l, c, v]) => ({ time: t, open: o, high: h, low: l, close: c, volume: v })) });
  }
  return _json({ error: "not available on the static site" }, 404);
};
</script>
<script>'''
sub('<script>\nconst TH = 7 * 3600;', SHIM + '\nconst TH = 7 * 3600;')

# live updates: poll data/live.json instead of the SSE stream
NEW_STREAM = r'''function stream() {
  const tick = async () => {
    let d;
    try { d = await (await _fetch(DATA_BASE + "live.json" + _bust(), { cache: "no-store" })).json(); } catch { $("status").className = "stale"; $("status").textContent = "โหลดข้อมูลไม่ได้"; return; }
    const at = d.updated_at || d.feed_time;
    const thai = (x) => new Date(x * 1000).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    $("status").className = "ok";
    $("status").textContent = `อัปเดตทุก 2 นาที · ล่าสุด ${thai(at)} น. เวลาไทย`;
    if (d.account) $("acct").textContent = `Exness · Demo · Balance ${d.account.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (!sym) return;
    const cur = d.series[`${sym}|${tf}`];
    if (cur) for (const [t, o, h, l, c] of cur.bars) if (t >= lastTime) { series.update(toBar({ time: t, open: o, high: h, low: l, close: c })); lastTime = t; }
    const m1 = d.series[`${sym}|M1`];
    if (m1) {
      const [, o, , , c] = m1.bars[m1.bars.length - 1];
      livePrice = c;
      const p = c.toLocaleString("en-US", { minimumFractionDigits: m1.digits, maximumFractionDigits: m1.digits });
      $("price").textContent = p;
      $("price").className = c >= o ? "up" : "down";
      document.title = `${sym} ${p} · Pheeet`;
    }
  };
  tick();
  setInterval(tick, 60000);
}'''
src = re.sub(r'function stream\(\) \{\n  const es = new EventSource.*?\n\}\n', NEW_STREAM + "\n", src, count=1, flags=re.S)
if "EventSource" in src:
    sys.exit("stream not replaced")

# AI: no analysis / jobs on the static site
src = re.sub(r'async function refreshAnalysis\(\) \{.*?\n\}\n', 'async function refreshAnalysis() {}\n', src, count=1, flags=re.S)
src = re.sub(r'async function startJob\(kind\) \{.*?\n\}\n', '', src, count=1, flags=re.S)
sub('$("ai-review-btn").onclick = () => startJob("review");\n', '')
sub('$("ai-trade-btn").onclick = () => startJob("trade");\n', '')
sub('const buy = t.dir === 0, d = t.digits, mine = t.magic === 2026102901;', 'const buy = t.dir === 0, d = t.digits, mine = false;  // read-only site')
sub('setInterval(loadTrades, 10000);', 'setInterval(loadTrades, 60000);')
LOCAL = Path(__file__).with_name("local_secrets.txt")  # gitignored: account logins that must never appear
bad_list = [x.strip() for x in LOCAL.read_text().split() if x.strip()] if LOCAL.exists() else []
if re.search(r"\b\d{9}\b", re.sub(r"\b20261\d{4}\b", "", src)):
    sys.exit("9-digit number (possible login) left in page")
# closed orders only; all times Thai (เพชร 2026-11-14)
src = src.replace("↑ Buy &nbsp; ↓ Sell &nbsp; ○ ออก +กำไร / −ขาดทุน &nbsp;· แตะไม้ทางขวาเพื่อซูม", "↑ Buy &nbsp; ↓ Sell &nbsp; ○ ออก +กำไร / −ขาดทุน &nbsp;· เฉพาะไม้ที่ปิดแล้ว &nbsp;· เวลาไทย (UTC+7)")
if "เวลาไทย (UTC+7)" not in src:
    sys.exit("legend not found")
sub("let lastTime = 0,", "const _onlyClosed = (a) => (a || []).filter((t) => t.state === \"closed\");\nlet lastTime = 0,")
sub("    trades = j.trades;", "    trades = _onlyClosed(j.trades);")
for bad in bad_list + ["ai-review-btn\").onclick", "startJob"]:
    if bad in src:
        sys.exit(f"still contains {bad}")
Path(__file__).with_name("site").joinpath("index.html").write_text(src, encoding="utf-8")
print("site/index.html", len(src))
