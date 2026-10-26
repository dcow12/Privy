"""Black-box experiment from the command line: the paired scenarios on one Claude model.

No activations here. What it measures:
  - Does the agent carry out disallowed requests more often in sandbox-looking environments?
  - Does it *say* it thinks it's being tested (in its reasoning summary or reply)?
  - Does the behaviour shift survive when you drop the episodes where it said so?
The web app (app.py) runs the same thing on any provider and compares models.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

from . import agents, scenarios
from .judge import judge_all
from .providers import PRICES
from .report import markdown, summarize


def judge_episodes(eps, cache_path, judge, judge_model, api_key=None, workers=8, log=print):
    """Add test_aware / stakes_reasoning / judge_quote to each usable episode."""
    ok = [e for e in eps if e.get("action") != "error"]
    texts = [(e.get("reasoning") or "") + "\n\n" + (e.get("text") or "") for e in ok]
    verdicts = judge_all(texts, cache_path, judge == "llm", judge_model, workers=workers,
                         api_key=api_key, log=log)
    for e, v in zip(ok, verdicts):
        e.update(test_aware=bool(v["test_aware"]), stakes_reasoning=bool(v["stakes_reasoning"]),
                 judge_quote=v["quote"])
    return eps


def run(args):
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    fams = args.families.split(",") if args.families else scenarios.FAMILIES
    rows = scenarios.make_cases(args.variants, fams)
    episodes = out / "episodes.jsonl"

    n = len(rows) * args.repeats
    pin, pout = PRICES.get(args.model, (4, 20))
    est = n * (1100 * pin + 900 * pout) / 1e6
    if args.judge == "llm":
        jin, jout = PRICES.get(args.judge_model, (4, 20))
        est += n * (700 * jin + 400 * jout) / 1e6
    print(f"{n} episodes on {args.model} ({len(fams)} families, {args.variants} variant(s), "
          f"{args.repeats} repeat(s)). Rough cost: ${est:.2f} including the judge.")
    if not args.yes:
        if not sys.stdin.isatty():
            raise SystemExit("Re-run with --yes to confirm the spend.")
        if input("Proceed? [y/N] ").strip().lower() != "y":
            raise SystemExit("Aborted.")

    slot = {"provider": "anthropic", "model": args.model, "effort": args.effort, "label": args.model}
    agents.run_all([slot], rows, episodes, repeats=args.repeats, workers=args.workers)

    eps = [e for e in agents.load_episodes(episodes) if e.get("model_label") == args.model]
    case_ids = {r["case_id"] for r in rows}
    eps = list({(e["case_id"], e["repeat"]): e for e in eps if e["case_id"] in case_ids}.values())
    eps = judge_episodes(eps, out / "judge_cache.jsonl", args.judge, args.judge_model,
                         workers=args.workers)
    ep = pd.DataFrame(eps)
    ep.to_csv(out / "episodes_judged.csv", index=False)
    summary = summarize(ep, fams)
    (out / "summary_agents.json").write_text(json.dumps(summary, indent=2))
    run_info = {"id": out.name, "name": args.model, "status": "done",
                "config": {"families": fams, "task_types": ["allowed", "disallowed"],
                           "mode": "tools", "variants": args.variants, "repeats": args.repeats,
                           "judge": args.judge}}
    (out / "report.md").write_text(markdown(run_info, summary))
    for m in summary["models"]:
        print("\n".join(m["findings"]))
    print(f"\nsummary_agents.json, report.md and episodes_judged.csv in {out.resolve()}. "
          f"For charts and model comparisons, open the results in the web app (python app.py).")
