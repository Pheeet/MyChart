// LuxAlgo "Trendlines with Breaks" (Pine v5) — faithful JS port of ~/dd/luxtl/luxtl.py.
// Default: length=14, mult=1, slope = ATR(length)/length*mult (Wilder / Pine ta.atr).
// Indicator © LuxAlgo, licensed CC BY-NC-SA 4.0 — https://creativecommons.org/licenses/by-nc-sa/4.0/
// This file is a research/display port, not an official LuxAlgo release.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LuxTL = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const LENGTH = 14;
  const MULT = 1.0;
  // Up-trendline (rising from a pivot low) = teal; down-trendline (falling from a pivot high) = red.
  // Matches the real-time (non-backpainted) reading of the indicator, not the Pine input label names.
  const TEAL = "#26A69A";
  const RED = "#EF5350";

  function wilderAtr(h, l, c, n) {
    const m = c.length;
    const atr = new Float64Array(m);
    atr.fill(NaN);
    if (!m) return atr;
    const tr = new Float64Array(m);
    tr[0] = h[0] - l[0];
    for (let i = 1; i < m; i++) {
      tr[i] = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
    }
    if (m < n) return atr;
    let prev = 0;
    for (let i = 0; i < n; i++) prev += tr[i];
    prev /= n;
    atr[n - 1] = prev;
    for (let i = n; i < m; i++) {
      prev = (prev * (n - 1) + tr[i]) / n;
      atr[i] = prev;
    }
    return atr;
  }

  function pivots(h, l, length) {
    const m = h.length;
    const ph = new Float64Array(m);
    const pl = new Float64Array(m);
    ph.fill(NaN);
    pl.fill(NaN);
    const L = length;
    for (let i = 2 * L; i < m; i++) {
      const p = i - L;
      const hp = h[p], lp = l[p];
      let isH = true, isL = true;
      for (let j = 1; j <= L; j++) {
        if (h[p - j] >= hp || h[p + j] >= hp) isH = false;
        if (l[p - j] <= lp || l[p + j] <= lp) isL = false;
        if (!isH && !isL) break;
      }
      if (isH) ph[i] = hp;
      if (isL) pl[i] = lp;
    }
    return { ph, pl };
  }

  function compute(h, l, c, length, mult) {
    if (length == null) length = LENGTH;
    if (mult == null) mult = MULT;
    const m = c.length;
    const atr = wilderAtr(h, l, c, length);
    const { ph, pl } = pivots(h, l, length);
    const slope = new Float64Array(m);
    for (let i = 0; i < m; i++) slope[i] = atr[i] / length * mult;

    const upper = new Float64Array(m); upper.fill(NaN);
    const lower = new Float64Array(m); lower.fill(NaN);
    const slopePh = new Float64Array(m); slopePh.fill(NaN);
    const slopePl = new Float64Array(m); slopePl.fill(NaN);
    const upos = new Int8Array(m);
    const dnos = new Int8Array(m);

    let sph = 0, spl = 0, u = 0, lo = 0;
    let havePh = false, havePl = false, uo = 0, dn = 0;
    for (let i = 0; i < m; i++) {
      const pvh = Number.isFinite(ph[i]);
      const pvl = Number.isFinite(pl[i]);
      const sl = slope[i];
      if (pvh && Number.isFinite(sl)) {
        sph = sl;
        u = ph[i];
        havePh = true;
        uo = 0;
      } else if (havePh) {
        u = u - sph;
      }
      if (pvl && Number.isFinite(sl)) {
        spl = sl;
        lo = pl[i];
        havePl = true;
        dn = 0;
      } else if (havePl) {
        lo = lo + spl;
      }
      if (havePh) {
        upper[i] = u;
        slopePh[i] = sph;
        if (!pvh && c[i] > (u - sph * length)) uo = 1;
      }
      if (havePl) {
        lower[i] = lo;
        slopePl[i] = spl;
        if (!pvl && c[i] < (lo + spl * length)) dn = 1;
      }
      upos[i] = uo;
      dnos[i] = dn;
    }

    const upperRt = new Float64Array(m);
    const lowerRt = new Float64Array(m);
    for (let i = 0; i < m; i++) {
      upperRt[i] = upper[i] - slopePh[i] * length;
      lowerRt[i] = lower[i] + slopePl[i] * length;
    }
    const upBreak = new Array(m).fill(false);
    const dnBreak = new Array(m).fill(false);
    for (let i = 1; i < m; i++) {
      upBreak[i] = upos[i] === 1 && upos[i - 1] === 0;
      dnBreak[i] = dnos[i] === 1 && dnos[i - 1] === 0;
    }
    return {
      atr, ph, pl, upper, lower,
      slope_ph: slopePh, slope_pl: slopePl,
      upper_rt: upperRt, lower_rt: lowerRt,
      upos, dnos, up_break: upBreak, dn_break: dnBreak,
    };
  }

  function finiteArr(a) {
    const out = new Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Number.isFinite(a[i]) ? a[i] : null;
    return out;
  }

  // Pack a render model from OHLC bars: {time, high, low, close} (time already in chart space).
  function model(bars, length, mult) {
    if (length == null) length = LENGTH;
    if (mult == null) mult = MULT;
    const m = bars ? bars.length : 0;
    const empty = { segs: [], faint: [], ext: [], breaks: [] };
    if (!m) return empty;
    const h = new Float64Array(m), l = new Float64Array(m), c = new Float64Array(m), t = new Array(m);
    for (let i = 0; i < m; i++) {
      h[i] = bars[i].high; l[i] = bars[i].low; c[i] = bars[i].close; t[i] = bars[i].time;
    }
    const R = compute(h, l, c, length, mult);

    function segsFrom(values, skip) {
      const segs = [];
      let cur = null;
      for (let i = 0; i < m; i++) {
        if (!Number.isFinite(values[i]) || skip[i]) {
          if (cur && cur.length >= 2) segs.push(cur);
          cur = null;
          continue;
        }
        if (!cur) cur = [];
        cur.push({ t: t[i], p: values[i] });
      }
      if (cur && cur.length >= 2) segs.push(cur);
      return segs;
    }

    const skipU = new Array(m), skipL = new Array(m);
    for (let i = 0; i < m; i++) {
      skipU[i] = Number.isFinite(R.ph[i]);
      skipL[i] = Number.isFinite(R.pl[i]);
    }
    const segs = [];
    for (const s of segsFrom(R.upper_rt, skipU)) segs.push({ color: RED, points: s });
    for (const s of segsFrom(R.lower_rt, skipL)) segs.push({ color: TEAL, points: s });

    const faint = [];
    for (let i = 0; i < m; i++) {
      if (Number.isFinite(R.ph[i]) && i >= length) {
        faint.push({ color: RED, points: [
          { t: t[i - length], p: R.ph[i] },
          { t: t[i], p: R.upper_rt[i] },
        ]});
      }
      if (Number.isFinite(R.pl[i]) && i >= length) {
        faint.push({ color: TEAL, points: [
          { t: t[i - length], p: R.pl[i] },
          { t: t[i], p: R.lower_rt[i] },
        ]});
      }
    }

    const ext = [];
    const dt = m >= 2 ? (t[m - 1] - t[m - 2]) : 0;
    function lastExt(values, slopes, dir, color, skip) {
      for (let i = m - 1; i >= 0; i--) {
        if (Number.isFinite(values[i]) && Number.isFinite(slopes[i])) {
          ext.push({ t: t[i], p: values[i], slope: slopes[i] * dir, dt, color, gap: !!skip[i] });
          return;
        }
      }
    }
    lastExt(R.upper_rt, R.slope_ph, -1, RED, skipU);
    lastExt(R.lower_rt, R.slope_pl, +1, TEAL, skipL);

    const breaks = [];
    for (let i = 0; i < m; i++) {
      if (R.up_break[i]) breaks.push({ t: t[i], p: bars[i].low, dir: "up", color: TEAL });
      if (R.dn_break[i]) breaks.push({ t: t[i], p: bars[i].high, dir: "down", color: RED });
    }
    return { segs, faint, ext, breaks };
  }

  return {
    LENGTH, MULT, TEAL, RED,
    wilderAtr, pivots, compute, model, finiteArr,
  };
});
