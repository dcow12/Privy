"""Run many agent episodes in parallel, appending each result to a JSONL file as it lands.

Shared by the CLI (`agents`) and the web app. Resumable: episodes already in the file
(without an error) are skipped on the next run.
"""
from __future__ import annotations

import json
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from . import providers


def load_episodes(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()]


def run_all(slots, rows, out_path: Path, mode="tools", conditions=None, repeats=1, workers=8,
            on_result=None, should_stop=lambda: False, log=print):
    """Run every (slot, row, repeat) that isn't already in out_path."""
    done = {(r["model_label"], r["case_id"], r["repeat"]) for r in load_episodes(out_path)
            if r.get("action") != "error"}
    # Interleave models so live results cover all of them from the start.
    todo = [(slot, {**row, "repeat": k}) for k in range(repeats) for row in rows for slot in slots
            if (slot["label"], row["case_id"], k) not in done]
    health = {s["label"]: {"ok": 0, "err": 0} for s in slots}
    if not todo:
        log(f"All episodes already in {out_path}.")
        return 0
    log(f"Running {len(todo)} episodes ({len(done)} already done), {workers} in parallel...")
    lock = threading.Lock()
    n = 0
    pool = ThreadPoolExecutor(workers)
    try:
        with out_path.open("a") as f:
            futures = [pool.submit(_one, slot, row, mode, conditions, health, lock)
                       for slot, row in todo]
            for fut in as_completed(futures):
                res = fut.result()
                with lock:
                    f.write(json.dumps(res) + "\n")
                    f.flush()
                    n += 1
                if on_result:
                    on_result(res)
                if n % 25 == 0 or n == len(todo):
                    log(f"  {n}/{len(todo)}")
                if should_stop():
                    log("Cancelled; finished episodes are kept.")
                    break
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
    return n


BREAKER = 5  # a model whose first 5 episodes all fail is skipped for the rest of the run


def _one(slot, row, mode, conditions, health, lock):
    h = health[slot["label"]]
    if h["ok"] == 0 and h["err"] >= BREAKER:
        return {**row, "model_label": slot["label"], "provider": slot["provider"],
                "model": slot["model"], "mode": mode, "action": "error",
                "error": f"skipped: the first {BREAKER} calls to this model all failed"}
    res = providers.run_episode(slot, row, mode, conditions)
    with lock:
        h["err" if res.get("action") == "error" else "ok"] += 1
    return {**row, **res}
