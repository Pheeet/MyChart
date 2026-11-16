"""Market regime for the MyChart page (2026-11-16). Pure Python, computed from the published M15 bars (closed bars only).

Rule (all on closed bars, BTCUSDc):
  1. เงียบ (quiet)  : H1 ATR14 < 0.6 x median H1 ATR14 of the last 168 hours
  2. เทรนด์ขึ้น/ลง  : H4 ADX14 >= 25 AND (H1 ER20 >= 0.30 OR H1 CHOP14 < 38.2);
                       direction = H4 +DI vs -DI, and H4 EMA20 slope (3 bars) must not point the other way
  3. แกว่ง (range)  : everything else (typically CHOP > 61.8 or ADX < 20 with normal ATR)
Also: M15 trend per v1.07 entry rules (close vs EMA20, EMA20 slope over 3 bars, EMA20 vs EMA50).
Describes the PAST, not a forecast. Revert: git checkout pre-regime-20261116 -- publish.py theme/ site/ && rm regime.py
"""
import math, time

def resample(bars, sec, now):
    out = []
    for t, o, h, l, c, *_ in bars:
        k = t // sec * sec
        if out and out[-1][0] == k:
            b = out[-1]; b[2] = max(b[2], h); b[3] = min(b[3], l); b[4] = c
        else:
            out.append([k, o, h, l, c])
    if out and out[-1][0] + sec > now:
        out.pop()  # still forming
    return out

def ema(xs, n):
    a = 2 / (n + 1); e = xs[0]; r = []
    for x in xs:
        e = a * x + (1 - a) * e; r.append(e)
    return r

def tr(b):
    return [b[0][2] - b[0][3]] + [max(b[i][2], b[i - 1][4]) - min(b[i][3], b[i - 1][4]) for i in range(1, len(b))]

def wilder(xs, n):
    if len(xs) < n: return []
    s = sum(xs[:n]) / n; r = [s]
    for x in xs[n:]:
        s = (s * (n - 1) + x) / n; r.append(s)
    return r

def adx(b, n=14):
    if len(b) < 2 * n + 2: return None, None, None
    T = tr(b)[1:]; up = []; dn = []
    for i in range(1, len(b)):
        u = b[i][2] - b[i - 1][2]; d = b[i - 1][3] - b[i][3]
        up.append(u if u > d and u > 0 else 0.0); dn.append(d if d > u and d > 0 else 0.0)
    A, P, M = wilder(T, n), wilder(up, n), wilder(dn, n)
    pdi = [100 * p / a if a else 0 for p, a in zip(P, A)]; mdi = [100 * m / a if a else 0 for m, a in zip(M, A)]
    dx = [100 * abs(p - m) / (p + m) if p + m else 0 for p, m in zip(pdi, mdi)]
    ad = wilder(dx, n)
    return ad[-1], pdi[-1], mdi[-1]

def compute(m15, now=None):
    now = now or time.time()
    m = [b for b in m15 if b[0] + 900 <= now]  # closed M15
    h1, h4 = resample(m, 3600, now), resample(m, 14400, now)
    if len(h1) < 60 or len(h4) < 30 or len(m) < 60: return None
    a4, pdi, mdi = adx(h4); a1, _, _ = adx(h1)
    c1 = [b[4] for b in h1]
    er = abs(c1[-1] - c1[-21]) / (sum(abs(c1[i] - c1[i - 1]) for i in range(-20, 0)) or 1)
    w = h1[-14:]; rng = max(b[2] for b in w) - min(b[3] for b in w)
    chop = 100 * math.log10(sum(tr(h1)[-14:]) / rng) / math.log10(14) if rng else 50.0
    at1 = wilder(tr(h1), 14); med = sorted(at1[-168:])[len(at1[-168:]) // 2]; atr_ratio = at1[-1] / med
    e4 = ema([b[4] for b in h4], 20); at4 = wilder(tr(h4), 14)[-1]
    sl = e4[-1] - e4[-4]; slope = "flat" if abs(sl) < 0.05 * at4 else ("up" if sl > 0 else "down")
    cm = [b[4] for b in m]; e20, e50 = ema(cm, 20), ema(cm, 50)
    m15t = "up" if cm[-1] > e20[-1] and e20[-1] > e20[-4] and e20[-1] > e50[-1] else \
           "down" if cm[-1] < e20[-1] and e20[-1] < e20[-4] and e20[-1] < e50[-1] else "none"
    if atr_ratio < 0.6:
        k = "quiet"
    elif a4 >= 25 and (er >= 0.30 or chop < 38.2):
        k = "up" if pdi > mdi else "down"
        if slope == ("down" if k == "up" else "up"): k = "range"
    else:
        k = "range"
    TH = {"up": "เทรนด์ขึ้น", "down": "เทรนด์ลง", "range": "แกว่ง", "quiet": "เงียบ"}
    r1 = lambda x: round(x, 1)
    return {"k": k, "label": TH[k], "adx_h4": r1(a4), "adx_h1": r1(a1), "pdi": r1(pdi), "mdi": r1(mdi),
            "er": round(er, 2), "chop": r1(chop), "atr_ratio": round(atr_ratio, 2), "ema_slope": slope,
            "m15": m15t, "as_of": h1[-1][0] + 3600}
