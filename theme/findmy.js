// ===== Find My theme helpers (2026-11-15): segmented period control + bottom sheet. Uses the existing menu, no data changes. =====
(() => {
  const $ = (id) => document.getElementById(id);
  const menu = $("psum-dd-menu"), per = document.querySelector(".psum-period");
  if (!menu || !per) return;
  const LBL = { today: "Today", yesterday: "Yesterday", "7d": "7D", "30d": "1M", year: "Year" };
  const seg = document.createElement("div"); seg.className = "fm-seg"; seg.setAttribute("role", "tablist"); seg.setAttribute("aria-label", "ช่วงเวลา");
  for (const b of menu.querySelectorAll("[data-period]")) {
    const s = document.createElement("button"); s.type = "button"; s.setAttribute("role", "tab");
    s.dataset.period = b.dataset.period; s.textContent = LBL[b.dataset.period] || b.textContent; s.title = b.textContent.trim();
    s.onclick = (e) => { e.stopPropagation(); b.click(); sync(); };
    seg.appendChild(s);
  }
  const lab = document.createElement("span"); lab.className = "fm-period-label";
  per.appendChild(seg); per.appendChild(lab);
  function sync() {
    for (const s of seg.children) {
      const src = menu.querySelector(`[data-period="${s.dataset.period}"]`);
      s.setAttribute("aria-selected", src && src.getAttribute("aria-selected") === "true" ? "true" : "false");
    }
    lab.textContent = $("psum-dd-btn")?.title || "";
  }
  new MutationObserver(sync).observe(menu, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
  new MutationObserver(sync).observe($("psum-dd-btn"), { attributes: true, attributeFilter: ["title"] });
  sync();
  // bottom sheet: tap the grabber area to cycle sizes (phone/tablet only)
  const aside = document.querySelector("aside");
  aside.addEventListener("click", (e) => {
    if (innerWidth >= 1024) return;
    const r = aside.getBoundingClientRect();
    if (e.clientY - r.top > 22) return;
    if (aside.classList.contains("fm-min")) aside.classList.remove("fm-min");
    else if (aside.classList.contains("fm-max")) { aside.classList.remove("fm-max"); aside.classList.add("fm-min"); }
    else aside.classList.add("fm-max");
  });
})();
// ===== v3 (2026-11-15): sliding spring pill for segmented controls (Motion = Framer Motion for vanilla JS) + period fade =====
(() => {
  let animate = null;
  import("https://cdn.jsdelivr.net/npm/motion@14.14.0/+esm").then((m) => { animate = m.animate; document.documentElement.classList.add("fm-motion"); }).catch(() => {});
  const SPRING = { type: "spring", stiffness: 520, damping: 38, mass: 0.9 };
  function pillify(box, sel, isOn) {
    if (!box) return;
    const pill = document.createElement("span"); pill.className = "fm-pill"; box.prepend(pill); box.classList.add("fm-has-pill");
    let first = true, last = null;
    const place = () => {
      const on = [...box.querySelectorAll(sel)].find(isOn); if (!on) { pill.style.opacity = "0"; return; }
      const x = on.offsetLeft, w = on.offsetWidth, h = on.offsetHeight, y = on.offsetTop;
      const key = `${x}|${w}|${h}`; if (key === last) return; last = key;
      pill.style.opacity = "1"; pill.style.height = h + "px"; pill.style.top = y + "px";
      if (first || !animate) { pill.style.transform = `translateX(${x}px)`; pill.style.width = w + "px"; first = false; return; }
      animate(pill, { transform: `translateX(${x}px)`, width: `${w}px` }, SPRING);
    };
    new MutationObserver(() => requestAnimationFrame(place)).observe(box, { subtree: true, attributes: true, attributeFilter: ["aria-selected", "aria-pressed"] });
    addEventListener("resize", () => { first = true; last = null; place(); });
    requestAnimationFrame(place); setTimeout(place, 300);
  }
  pillify(document.querySelector(".fm-seg"), "button", (b) => b.getAttribute("aria-selected") === "true");
  pillify(document.querySelector(".toolbar"), ".tf", (b) => b.getAttribute("aria-pressed") === "true");
  // soft spring-in of numbers and rows when the period changes
  const menu = document.getElementById("psum-dd-menu"); let prev = null;
  if (menu) new MutationObserver(() => {
    const cur = menu.querySelector('[aria-selected="true"]')?.dataset.period;
    if (!cur || cur === prev) return; const firstRun = prev === null; prev = cur; if (firstRun || !animate) return;
    const els = [document.getElementById("psum-net-card"), document.querySelector(".psum-split"), document.querySelector(".psum-foot")].filter(Boolean);
    animate(els, { opacity: [0.35, 1], transform: ["translateY(5px)", "translateY(0px)"] }, { duration: 0.28, ease: [0.22, 1, 0.36, 1] });
    const rows = [...document.querySelectorAll("#trades .trade")].slice(0, 12);
    rows.forEach((r, i) => animate(r, { opacity: [0, 1], transform: ["translateY(6px)", "translateY(0px)"] }, { duration: 0.26, delay: i * 0.018, ease: [0.22, 1, 0.36, 1] }));
  }).observe(menu, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
})();
// ===== v7 (2026-11-16): market regime pill under the price bar (data/live.json -> regime, computed by regime.py) =====
(() => {
  const el = document.createElement("div"); el.id = "fm-regime"; el.className = "glass"; el.hidden = true;
  el.innerHTML = '<span class="rg-dot"></span><span class="rg-main"><b class="rg-label"></b><span class="rg-nums"></span></span><span class="rg-sub"></span>';
  document.body.appendChild(el);
  const ARW = { up: "↑", down: "↓", flat: "→", none: "–" };
  const COL = { up: "up", down: "down", range: "range", quiet: "quiet" };
  const thai = (x) => new Date(x * 1000).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
  const q = (s) => el.querySelector(s);
  async function tick() {
    let r;
    try { r = (await (await fetch("data/live.json?t=" + Math.floor(Date.now() / 30000), { cache: "no-store" })).json()).regime; } catch { return; }
    if (!r) { el.hidden = true; return; }
    el.hidden = false; el.dataset.k = COL[r.k] || "range";
    q(".rg-label").textContent = r.label;
    q(".rg-nums").textContent = `ADX ${Math.round(r.adx_h4)} · ER ${r.er.toFixed(2)} · CHOP ${Math.round(r.chop)}`;
    q(".rg-sub").textContent = `H4 ${ARW[r.ema_slope] || "–"} · M15 ${ARW[r.m15] || "–"} · อ้างอิงอดีต ไม่ใช่การทำนาย`;
    el.title = `สภาพตลาด (แท่ง H1 ปิด ${thai(r.as_of)} น.)\n` +
      `ADX14 H4 ${r.adx_h4} (+DI ${r.pdi} / −DI ${r.mdi}) · ADX14 H1 ${r.adx_h1}\n` +
      `ER20 H1 ${r.er} · CHOP14 H1 ${r.chop} · ATR H1 / ค่ากลาง 7 วัน ${r.atr_ratio}\n` +
      `เทรนด์: ADX H4 ≥ 25 และ (ER ≥ 0.30 หรือ CHOP < 38.2) · เงียบ: ATR < 0.6× ค่ากลาง · นอกนั้น = แกว่ง`;
  }
  el.addEventListener("click", () => el.classList.toggle("open"));
  tick(); setInterval(tick, 60000);
})();

// ===== v8 (2026-11-19): LuxAlgo Trendlines with Breaks, real-time (no backpaint), on the main chart =====
(() => {
  if (typeof series === "undefined" || typeof chart === "undefined" || typeof LuxTL === "undefined") return;

  const KEY = "mychart-tl";
  const CREDIT = "Trendlines with Breaks © LuxAlgo · CC BY-NC-SA 4.0";
  const shown = () => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
  const save = (on) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch {} };

  const prim = {
    model: { segs: [], faint: [], ext: [], breaks: [] },
    visible: shown(),
    series: null, chart: null, req: null,
    attached(p) { this.chart = p.chart; this.series = p.series; this.req = p.requestUpdate; },
    detached() { this.chart = this.series = this.req = null; },
    set(model) { this.model = model || { segs: [], faint: [], ext: [], breaks: [] }; this.req && this.req(); },
    updateAllViews() {},
    paneViews() {
      const self = this;
      return [
        { zOrder: () => "normal", renderer: () => ({ draw(target) { self._drawLines(target); } }) },
        { zOrder: () => "top", renderer: () => ({ draw(target) { self._drawBreaks(target); } }) },
      ];
    },
    _xy(ts, t, p) {
      const x = ts.timeToCoordinate(t), y = this.series.priceToCoordinate(p);
      return [x, y];
    },
    _stroke(ctx, hr, vr, points, color, width, dash, alpha) {
      const ts = this.chart.timeScale();
      const pts = [];
      for (const q of points) {
        const [x, y] = this._xy(ts, q.t, q.p);
        if (x == null || y == null) continue;
        pts.push([x * hr, y * vr]);
      }
      if (pts.length < 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(1, width * hr);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.setLineDash(dash ? dash.map((d) => d * hr) : []);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      ctx.restore();
    },
    _drawLines(target) {
      if (!this.visible || !this.chart || !this.series) return;
      target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, horizontalPixelRatio: hr, verticalPixelRatio: vr }) => {
        const ts = this.chart.timeScale();
        for (const s of this.model.faint || []) this._stroke(ctx, hr, vr, s.points, s.color, 1, [5, 5], 0.32);
        for (const s of this.model.segs || []) this._stroke(ctx, hr, vr, s.points, s.color, 1.7, null, 0.95);
        const mediaW = bitmapSize.width / hr;
        for (const e of this.model.ext || []) {
          const [x0, y0] = this._xy(ts, e.t, e.p);
          if (x0 == null || y0 == null) continue;
          let barW = 0;
          if (e.dt) {
            const x1 = ts.timeToCoordinate(e.t + e.dt);
            if (x1 != null) barW = x1 - x0;
          }
          if (!(barW > 0.2)) barW = 8;
          const xR = mediaW + 2;
          if (xR <= x0 + 1) continue;
          const nBars = (xR - x0) / barW;
          const pR = e.p + e.slope * nBars;
          const yR = this.series.priceToCoordinate(pR);
          if (yR == null) continue;
          ctx.save();
          ctx.strokeStyle = e.color;
          ctx.globalAlpha = 0.8;
          ctx.lineWidth = Math.max(1, 1.3 * hr);
          ctx.setLineDash([6 * hr, 5 * hr]);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x0 * hr, y0 * vr);
          ctx.lineTo(xR * hr, yR * vr);
          ctx.stroke();
          ctx.restore();
        }
      });
    },
    _drawBreaks(target) {
      if (!this.visible || !this.chart || !this.series) return;
      target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, horizontalPixelRatio: hr, verticalPixelRatio: vr }) => {
        const ts = this.chart.timeScale();
        const mediaW = bitmapSize.width / hr, mediaH = bitmapSize.height / vr;
        ctx.font = `700 ${11 * vr}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const b of this.model.breaks || []) {
          const [x, y] = this._xy(ts, b.t, b.p);
          if (x == null || y == null) continue;
          if (x < -20 || x > mediaW + 20) continue;
          const up = b.dir === "up";
          const tw = ctx.measureText("B").width;
          const padX = 4.5 * hr, padY = 2.2 * vr;
          const w = tw + padX * 2, h = 11 * vr + padY * 2;
          const cx = x * hr;
          let top = up ? (y * vr + 7 * vr) : (y * vr - 7 * vr - h);
          let left = cx - w / 2;
          left = Math.max(2 * hr, Math.min(left, bitmapSize.width - w - 2 * hr));
          if (top < 2 * vr) top = 2 * vr;
          if (top + h > bitmapSize.height - 2 * vr) top = bitmapSize.height - h - 2 * vr;
          const r = 3 * Math.max(hr, vr);
          ctx.beginPath();
          const x0 = left, y0 = top, x1 = left + w, y1 = top + h;
          ctx.moveTo(x0 + r, y0); ctx.lineTo(x1 - r, y0); ctx.quadraticCurveTo(x1, y0, x1, y0 + r);
          ctx.lineTo(x1, y1 - r); ctx.quadraticCurveTo(x1, y1, x1 - r, y1);
          ctx.lineTo(x0 + r, y1); ctx.quadraticCurveTo(x0, y1, x0, y1 - r);
          ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
          ctx.closePath();
          ctx.fillStyle = b.color;
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.fillText("B", x0 + w / 2, y0 + h / 2 + 0.3 * vr);
        }
      });
    },
  };
  series.attachPrimitive(prim);

  let bars = [];
  const origSet = series.setData.bind(series);
  const origUpd = series.update.bind(series);
  function refresh() {
    prim.set(LuxTL.model(bars));
  }
  series.setData = (data) => {
    bars = Array.isArray(data) ? data.map((b) => ({ time: b.time, high: b.high, low: b.low, close: b.close })) : [];
    origSet(data);
    refresh();
  };
  series.update = (bar) => {
    if (bar && bar.time != null) {
      const last = bars.length ? bars[bars.length - 1] : null;
      if (last && last.time === bar.time) bars[bars.length - 1] = { time: bar.time, high: bar.high, low: bar.low, close: bar.close };
      else if (!last || bar.time > last.time) bars.push({ time: bar.time, high: bar.high, low: bar.low, close: bar.close });
    }
    origUpd(bar);
    refresh();
  };

  const tb = document.querySelector(".toolbar");
  const btn = document.createElement("button");
  btn.id = "fm-tl-toggle";
  btn.type = "button";
  btn.className = "glass";
  btn.title = CREDIT + " — เส้นจริง ไม่วาดย้อนหลัง (ป้าย B = ราคาปิดทะลุเส้น)";
  btn.setAttribute("aria-label", "แสดงหรือซ่อนเส้นแนวโน้ม LuxAlgo");
  btn.innerHTML = '<span class="fm-tl-swatch" aria-hidden="true"></span><span>เส้น</span>';
  const note = document.createElement("div");
  note.id = "fm-tl-note";
  note.textContent = CREDIT;
  const syncUi = () => {
    const on = prim.visible;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    note.hidden = !on;
  };
  btn.onclick = () => { prim.visible = !prim.visible; save(prim.visible); syncUi(); prim.req && prim.req(); };
  (tb && tb.parentNode ? tb.parentNode : document.body).appendChild(btn);
  document.body.appendChild(note);
  const place = () => {
    if (!tb) return;
    const r = tb.getBoundingClientRect();
    btn.style.top = r.top + "px";
    btn.style.left = (r.right + 8) + "px";
    btn.style.height = r.height + "px";
  };
  addEventListener("resize", place);
  new MutationObserver(place).observe(tb || document.body, { attributes: true, attributeFilter: ["class", "style"] });
  place();
  requestAnimationFrame(place);
  setTimeout(place, 300);
  syncUi();
})();
