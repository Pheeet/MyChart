#!/usr/bin/env python3
"""Export ChartFeed files (read-only) to JSON and publish site + data to the gh-pages branch of Pheeet/MyChart.

Each run builds a fresh tree, and if the data changed since the last push it force-pushes a single orphan
commit to gh-pages (deploy output only; main is never touched). A GitHub Actions workflow in that commit
deploys it to GitHub Pages. Account login / server are never exported.
"""
import hashlib, json, os, shutil, subprocess, sys, tempfile, time
from pathlib import Path

FEED = Path.home() / ".mt5chart/drive_c/Program Files/MT5 Chart/MQL5/Files/ChartFeed"
HERE = Path(__file__).resolve().parent
STATE = HERE / "state"
REMOTE = "https://github.com/Pheeet/MyChart.git"
GH = str(Path.home() / ".local/bin/gh")
TFS = ("M1", "M15")
FIELDS = ("state", "id", "symbol", "dir", "lots", "open_t", "open_px", "close_t", "close_px",
          "sl", "tp", "net", "magic", "comment", "reason", "digits")
LOCAL = HERE / "local_secrets.txt"  # gitignored list of account logins that must never be published


def secrets():
    s = ["Exness-MT5", "gho_", "ghp_", "github_pat_", "BEGIN OPENSSH", "PRIVATE KEY"]
    if LOCAL.exists():
        s += [x.strip() for x in LOCAL.read_text().split() if x.strip()]
    p = (FEED / "account.txt").read_text(encoding="ascii", errors="ignore").split("|")
    s += [x for x in p[:2] if x]  # current login + server
    return s

WORKFLOW = """name: deploy-pages
on:
  push:
    branches: [gh-pages]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.d.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: d
        uses: actions/deploy-pages@v4
"""


def bar(s):
    t, o, h, l, c, v = s.split(",")
    return [int(t), float(o), float(h), float(l), float(c), int(v)]


def read_live():
    out = {}
    for line in (FEED / "live.txt").read_text(encoding="ascii", errors="ignore").splitlines():
        p = line.strip().split("|")
        if len(p) != 4:
            continue
        try:
            out[f"{p[0]}|{p[1]}"] = {"digits": int(p[2]), "bars": [bar(b) for b in p[3].split(";")]}
        except ValueError:
            continue
    return out


def read_trades():
    trades = []
    for line in (FEED / "trades.txt").read_text(encoding="ascii", errors="replace").splitlines():
        p = line.split("|")
        if len(p) != len(FIELDS):
            continue
        t = dict(zip(FIELDS, p))
        try:
            for k in ("open_t", "close_t", "magic", "digits", "dir"):
                t[k] = int(t[k])
            for k in ("lots", "open_px", "close_px", "sl", "tp", "net"):
                t[k] = float(t[k])
        except ValueError:
            continue
        t["state"] = {"O": "open", "P": "pending"}.get(t["state"], "closed")
        trades.append(t)
    trades.sort(key=lambda t: (t["state"] != "closed", t["open_t"] if t["state"] != "closed" else t["close_t"]), reverse=True)
    return trades


def read_account():
    # login|server|?|balance|equity|?|time  -> only balance / equity are exported
    p = (FEED / "account.txt").read_text(encoding="ascii", errors="ignore").strip().split("|")
    try:
        return {"balance": float(p[3]), "equity": float(p[4])}
    except (IndexError, ValueError):
        return None


def build(out: Path):
    live = read_live()
    syms = sorted({k.split("|")[0] for k in live})
    feed_time = int((FEED / "live.txt").stat().st_mtime)
    files = {}
    files["symbols.json"] = {"symbols": syms}
    closed = [t for t in read_trades() if t["state"] == "closed"]  # open / pending never published
    files["trades.json"] = {"trades": closed, "age": 0}
    for s in syms:
        for tf in TFS:
            f = FEED / f"{s}_{tf}.csv"
            if f.exists():
                bars = [bar(x) for x in f.read_text(encoding="ascii").split() if x.count(",") == 5]
                files[f"bars/{s}_{tf}.json"] = {"digits": live.get(f"{s}|{tf}", {}).get("digits", 5), "bars": bars}
    acct = read_account()
    files["live.json"] = {"series": live, "account": {"balance": acct["balance"]} if acct else None,
                          "feed_time": feed_time, "updated_at": int(time.time()),
                          "last_close": max((t["close_t"] for t in closed), default=0)}
    (out / "data/bars").mkdir(parents=True)
    for name, obj in files.items():
        (out / "data" / name).write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")
    shutil.copy(HERE / "site/index.html", out / "index.html")
    (out / ".nojekyll").write_text("")
    (out / ".github/workflows").mkdir(parents=True)
    (out / ".github/workflows/pages.yml").write_text(WORKFLOW)
    # publish only when the set of closed trades changes (or the page / workflow changes)
    h = hashlib.sha256()
    h.update(json.dumps(sorted(str(t["id"]) for t in closed)).encode())
    h.update((HERE / "site/index.html").read_bytes()); h.update(WORKFLOW.encode())
    return h.hexdigest()


def scan(out: Path):
    for f in out.rglob("*"):
        if f.is_file():
            text = f.read_text(encoding="utf-8", errors="ignore")
            for s in secrets():
                if s in text:
                    raise SystemExit(f"refusing to publish: {s!r} found in {f.relative_to(out)}")


def git(cwd, *args):
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0")
    r = subprocess.run(["git", "-c", "credential.helper=", "-c", f"credential.helper=!{GH} auth git-credential", *args],
                       cwd=cwd, env=env, capture_output=True, text=True, timeout=120)
    if r.returncode:
        raise SystemExit(f"git {args[0]} failed: {(r.stderr or r.stdout).strip()[:500]}")
    return r.stdout


def main():
    STATE.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="mychart-") as tmp:
        out = Path(tmp)
        digest = build(out)
        scan(out)
        if "--dry" in sys.argv:
            dst = HERE / "state/dry"
            shutil.rmtree(dst, ignore_errors=True)
            shutil.copytree(out, dst)
            print("dry build in", dst)
            return
        last = STATE / "last_hash"
        if last.exists() and last.read_text().strip() == digest and "--force" not in sys.argv:
            print("unchanged, skip push")
            return
        git(out, "init", "-q", "-b", "gh-pages")
        git(out, "add", "-A")
        git(out, "-c", "user.name=MyChart publisher", "-c", "user.email=publisher@users.noreply.github.com",
            "commit", "-q", "-m", f"data {time.strftime('%Y-%m-%d %H:%M:%S %z')}")
        git(out, "push", "-q", "-f", REMOTE, "gh-pages:gh-pages")
        last.write_text(digest)
        print("published", digest[:12])


if __name__ == "__main__":
    main()
