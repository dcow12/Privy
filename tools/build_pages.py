"""Build the GitHub Pages demo into docs/: the real front end, in read-only mode, over the saved runs.

    python tools/build_pages.py            # exports every run in runs/
    python tools/build_pages.py RUN_ID ... # or only the runs you name

The data comes from the app's own API (FastAPI test client), so the demo shows exactly what the
local app shows. API keys never reach docs/: the server isn't given any and key status is blanked.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
for name in [k for k in os.environ if k.endswith(("_API_KEY", "_TOKEN"))]:
    os.environ.pop(name)  # the export must not depend on, or reveal, local credentials

from fastapi.testclient import TestClient  # noqa: E402

import app  # noqa: E402

app.KEYS.clear()
DOCS = ROOT / "docs"
SKIP_WEB = {"style-classic.css", "style-shadcn.css"}
RUN_FILES = (".png", ".json")


def write(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, (dict, list)):
        path.write_text(json.dumps(data))
    elif isinstance(data, str):
        path.write_text(data)
    else:
        path.write_bytes(data)


def main(only):
    client = TestClient(app.app)
    if DOCS.exists():
        shutil.rmtree(DOCS)
    static = DOCS / "static"
    shutil.copytree(ROOT / "web", static, ignore=lambda d, names: [n for n in names if n in SKIP_WEB])

    # Page shell: relative paths (Pages serves under /<repo>/) and the read-only flag.
    html = (ROOT / "web" / "index.html").read_text().replace('"/static/', '"static/')
    html = html.replace('<script src="static/app.js', '<script>window.SNIFFER_STATIC = true;</script>\n  <script src="static/app.js', 1)
    write(DOCS / "index.html", html)
    css = (static / "style.css").read_text().replace('url("/static/fonts/', 'url("fonts/')
    write(static / "style.css", css)
    (static / "index.html").unlink()
    write(DOCS / ".nojekyll", "")

    meta = client.get("/api/meta").json()
    for p in meta["providers"]:
        if p["kind"] != "mock":
            p.update(has_key=False, masked="")
    for k in meta["whitebox_keys"].values():
        k.update(has_key=False, masked="")
    write(DOCS / "data" / "meta.json", meta)

    runs = [r for r in client.get("/api/runs").json()["runs"] if not only or r["id"] in only]
    runs = [r for r in runs if r["status"] in ("done", "cancelled")]
    write(DOCS / "data" / "runs.json", {"runs": runs})
    for r in runs:
        rid, d = r["id"], DOCS / "data" / "runs" / r["id"]
        info = client.get(f"/api/runs/{rid}").json()
        info["logs"] = []
        write(d / "info.json", info)
        if r["kind"] == "agents":
            write(d / "summary.json", client.get(f"/api/runs/{rid}/summary").json())
            write(d / "episodes.json", client.get(f"/api/runs/{rid}/episodes").json())
            for fmt in ("md", "csv", "json"):
                write(d / f"export.{fmt}", client.get(f"/api/runs/{rid}/export/{fmt}").content)
        else:
            for f in sorted((ROOT / "runs" / rid).iterdir()):
                if f.suffix in RUN_FILES and f.name != "run.json":
                    write(d / "files" / f.name, f.read_bytes())
        print(f"  exported {r['kind']:8s} {rid}  {r['name']}")
    size = sum(f.stat().st_size for f in DOCS.rglob("*") if f.is_file()) / 1e6
    print(f"docs/ ready: {len(runs)} runs, {size:.1f} MB")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
