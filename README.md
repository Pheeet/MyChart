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
