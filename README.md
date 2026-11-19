# MyChart

Live dashboard (read-only) for the Exness **demo** account running Diamond Rider / Catcher on BTCUSDm:
candles (M1 / M15), entry/exit markers for every **closed** order (open positions are not shown), Profit Summary (today / yesterday / 7 days / 1 month / year) and Order History.

**Live page:** https://pheeet.github.io/MyChart/

## How it works
- `site/index.html` – static copy of the ChartFeed dashboard. It reads `data/*.json` from the same site and refreshes every 60 s. All times are Thai time (Asia/Bangkok, UTC+7) whatever the viewer's timezone. No AI buttons, no order actions, account number hidden.
- `publish.py` – runs every 2 minutes (systemd user timer) and pushes whenever the data changed (new candles, closed trades, balance). Only **closed** orders are ever published. It reads the ChartFeed EA files (read-only), writes the JSON, and force-pushes one orphan commit to the `gh-pages` branch (deploy output only). The workflow inside that commit deploys it to GitHub Pages.
- `make_site.py` – regenerates `site/index.html` from the ChartFeed page.
- `systemd/` – `mychart-publish.service` + `.timer`.

Balance shown = balance after the last close.

Stop publishing: `systemctl --user disable --now mychart-publish.timer`

## Market regime pill (v7, 2026-11-16)
`regime.py` (called by `publish.py`) adds `regime` to `data/live.json` from closed BTCUSDc M15 bars (H1/H4 built from M15):
- **เงียบ**: H1 ATR14 < 0.6 × median H1 ATR14 of the last 168 h
- **เทรนด์ขึ้น / ลง**: H4 ADX14 ≥ 25 and (H1 ER20 ≥ 0.30 or H1 CHOP14 < 38.2); direction = H4 +DI vs −DI, H4 EMA20 slope must not oppose
- **แกว่ง**: everything else
Shown by `theme/findmy.js`/`findmy.css` under the price bar (re-applied by `theme/apply_findmy.py`). Describes the past, not a forecast.
Revert: `git checkout pre-regime-20261116 -- publish.py theme site README.md && git rm regime.py && python3 theme/apply_findmy.py`

## Trendlines with Breaks (v8, 2026-11-19)
Client-side overlay of LuxAlgo *Trendlines with Breaks* (Pine v5, © LuxAlgo, [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)) on the main chart, for every timeframe the page loads (currently M1 and M15).
- Logic in `theme/luxtl.js` matches the Python port in `~/dd/luxtl` (`node theme/test_luxtl.js` vs `theme/luxtl_fixture.json`).
- Settings: length=14, slope = ATR(14)/14. Lines are the **real-time** values (no backpaint, so they do not repaint). A faint dashed stub marks the confirmed pivot once it is 14 bars old. A dashed extension continues the current lines to the right. Teal "B" under the bar = close broke the down-trendline up; red "B" above = close broke the up-trendline down.
- Toggle labelled "เส้น" (on by default, remembered in `localStorage`). Attribution footnote on the chart.
Drawn by `theme/findmy.js` / `findmy.css` (re-applied by `theme/apply_findmy.py`).
