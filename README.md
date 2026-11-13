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
