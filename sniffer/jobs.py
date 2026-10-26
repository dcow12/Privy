"""Background runs for the web app. Each run lives in runs/<id>/:

  run.json          name, kind, status, config (never API keys), progress
  episodes.jsonl    agent runs: one line per episode, appended as they finish
  episodes_judged.jsonl, summary.json, report.md   written when the run finishes
  (white-box runs write the whitebox outputs: summary.json, *.png, *.csv)
"""
from __future__ import annotations

import json
import threading
import time
import traceback
import uuid
from argparse import Namespace
from collections import deque
from datetime import datetime
from pathlib import Path

import pandas as pd

from . import agents, scenarios
from .blackbox import judge_episodes
from .report import markdown, summarize

RUNS = Path(__file__).resolve().parent.parent / "runs"
_LIVE: dict[str, "Job"] = {}
_SUMMARY_LOCK = threading.Lock()


class Job:
    def __init__(self, kind, name, config):
        self.id = datetime.now().strftime("%m%d-%H%M%S-") + uuid.uuid4().hex[:4]
        self.kind, self.name, self.config = kind, name, config
        self.dir = RUNS / self.id
        self.dir.mkdir(parents=True, exist_ok=True)
        self.status, self.error = "running", None
        self.total, self.done, self.errors = 0, 0, 0
        self.created = datetime.now().isoformat(timespec="seconds")
        self.finished = None
        self.logs = deque(maxlen=300)
        self.cancel = threading.Event()
        self.lock = threading.Lock()
        _LIVE[self.id] = self
        self.save()

    def log(self, *parts, **_):
        line = " ".join(str(p) for p in parts)
        self.logs.append(f"{datetime.now():%H:%M:%S} {line}")

    def info(self):
        return {"id": self.id, "kind": self.kind, "name": self.name, "status": self.status,
                "error": self.error, "created": self.created, "finished": self.finished,
                "total": self.total, "done": self.done, "errors": self.errors,
                "config": self.config}

    def save(self):
        (self.dir / "run.json").write_text(json.dumps(self.info(), indent=2))

    def finish(self, status, error=None):
        self.status, self.error = status, error
        self.finished = datetime.now().isoformat(timespec="seconds")
        self.save()


def list_runs():
    runs = []
    if RUNS.exists():
        for p in sorted(RUNS.glob("*/run.json"), reverse=True):
            info = json.loads(p.read_text())
            live = _LIVE.get(info["id"])
            if live:
                info = live.info()
            elif info["status"] == "running":
                info["status"] = "interrupted"  # server restarted mid-run
            runs.append(info)
    return runs


def get_run(run_id):
    if run_id in _LIVE:
        return _LIVE[run_id].info()
    p = RUNS / run_id / "run.json"
    if not p.exists() or p.resolve().parent.parent != RUNS:
        return None
    info = json.loads(p.read_text())
    if info["status"] == "running":
        info["status"] = "interrupted"
    return info


def logs(run_id):
    job = _LIVE.get(run_id)
    return list(job.logs) if job else []


def cancel(run_id):
    job = _LIVE.get(run_id)
    if job and job.status == "running":
        job.cancel.set()
        job.log("Cancel requested.")
        return True
    return False


# --------------------------------------------------------------------------- agents

def start_agents(name, slots, cfg, anthropic_key=None):
    """slots carry API keys; they're used in memory only and never written to run.json."""
    public_slots = [{k: v for k, v in s.items() if k not in ("key",)} for s in slots]
    cfg = {**cfg, "slots": public_slots}
    job = Job("agents", name, cfg)
    rows = make_rows(cfg)
    job.total = len(rows) * cfg["repeats"] * len(slots)
    job.save()
    threading.Thread(target=_agents_thread, args=(job, slots, cfg, rows, anthropic_key),
                     daemon=True).start()
    return job


def make_rows(cfg):
    custom = cfg.get("custom") if "custom" in cfg["families"] else None
    return scenarios.make_cases(cfg["variants"], cfg["families"], custom, cfg["task_types"])


def _agents_thread(job, slots, cfg, rows, anthropic_key):
    try:
        conditions = {k: cfg.get(k) for k in ("everywhere", "monitored", "pressure")}

        def on_result(res):
            with job.lock:
                job.done += 1
                job.errors += res.get("action") == "error"
                if job.done % 10 == 0:
                    job.save()
                if res.get("action") == "error" and job.errors <= 3:
                    from .report import explain_error
                    job.log(f"{res['model_label']}: {explain_error(res.get('error'))} ({res.get('error')})")

        agents.run_all(slots, rows, job.dir / "episodes.jsonl", mode=cfg["mode"],
                       conditions=conditions, repeats=cfg["repeats"], workers=cfg.get("workers", 6),
                       on_result=on_result, should_stop=job.cancel.is_set, log=job.log)
        job.log("Judging reasoning for verbalized test-awareness...")
        finalize_agents(job.dir, cfg, anthropic_key, log=job.log)
        job.log("Done.")
        job.finish("cancelled" if job.cancel.is_set() else "done")
    except Exception as e:
        job.log(traceback.format_exc(limit=3))
        job.finish("error", f"{type(e).__name__}: {e}")


def finalize_agents(run_dir: Path, cfg, anthropic_key=None, log=print, provisional=False):
    """Judge + summarize whatever episodes exist. Provisional summaries use the free regex judge."""
    with _SUMMARY_LOCK:
        return _finalize(run_dir, cfg, anthropic_key, log, provisional)


def _finalize(run_dir, cfg, anthropic_key, log, provisional):
    eps = agents.load_episodes(run_dir / "episodes.jsonl")
    if not eps:
        return {"families": cfg["families"], "models": []}
    eps = list({(e["model_label"], e["case_id"], e["repeat"]): e for e in eps}.values())
    judge = "regex" if provisional else cfg.get("judge", "regex")
    if judge == "llm" and not anthropic_key:
        log("No Anthropic key available for the judge; using the regex judge.")
        judge = "regex"
    eps = judge_episodes(eps, run_dir / "judge_cache.jsonl", judge, cfg.get("judge_model", "claude-opus-5-5"),
                         api_key=anthropic_key, log=log)
    summary = summarize(pd.DataFrame(eps), cfg["families"], [s["label"] for s in cfg.get("slots", [])])
    summary["judge"] = judge
    if not provisional:
        with (run_dir / "episodes_judged.jsonl").open("w") as f:
            for e in eps:
                f.write(json.dumps(e) + "\n")
        (run_dir / "summary.json").write_text(json.dumps(summary, indent=2))
        info = json.loads((run_dir / "run.json").read_text())
        (run_dir / "report.md").write_text(markdown(info, summary))
    return summary


def summary(run_id):
    info = get_run(run_id)
    if info is None:
        return None
    d = RUNS / run_id
    if (d / "summary.json").exists() and info["status"] != "running":
        s = json.loads((d / "summary.json").read_text())
        s["provisional"] = False
        return s
    if info["kind"] == "agents":
        s = finalize_agents(d, info["config"], provisional=True, log=lambda *a, **k: None)
        s["provisional"] = True
        return s
    return None


def episodes(run_id):
    d = RUNS / run_id
    path = d / "episodes_judged.jsonl"
    if not path.exists():
        path = d / "episodes.jsonl"
    return agents.load_episodes(path)


# ------------------------------------------------------------------------- whitebox

WHITEBOX_DEFAULTS = dict(backend="mock", model="meta-llama/Llama-3.3-70B-Instruct", variants=2,
                         layer=None, layers="auto", batch_size=None, device=None, module_paths=None,
                         reuse=False, skip_verbal=False, verbal_n=120, verbal_tokens=160,
                         judge="regex", judge_model="claude-opus-5-5", skip_steering=False,
                         steer_n=32, n_random=3, mults="-8,-4,-2,2,4,8", quick=False)


def start_whitebox(name, cfg, anthropic_key=None):
    job = Job("whitebox", name, cfg)
    args = Namespace(**{**WHITEBOX_DEFAULTS, **cfg})
    if args.quick:
        args.variants, args.verbal_n, args.steer_n, args.mults = 1, 48, 16, "-8,-4,4,8"
    if args.judge == "llm" and not anthropic_key:
        args.judge = "regex"
    args.out = str(job.dir)
    args.anthropic_key = anthropic_key
    threading.Thread(target=_whitebox_thread, args=(job, args), daemon=True).start()
    return job


def _whitebox_thread(job, args):
    from . import whitebox
    try:
        t0 = time.time()
        whitebox.run(args, log=job.log, should_stop=job.cancel.is_set)
        job.log(f"Finished in {time.time() - t0:.0f}s.")
        job.finish("done")
    except BaseException as e:  # SystemExit from config problems should surface too
        if job.cancel.is_set():
            job.finish("cancelled")
            return
        job.log(traceback.format_exc(limit=3))
        job.finish("error", f"{type(e).__name__}: {e}")
