#!/usr/bin/env python3
"""Print Markdown tables from results.jsonl files written by run_benchmarks.sh.

  .venv/bin/python scripts/summarize_benchmarks.py results/*/results.jsonl
"""
from __future__ import annotations

import json
import sys


def lat(result: dict, name: str, p: str = "p95") -> str:
    v = result.get("latency_ms", {}).get(name)
    return "—" if not v or v.get(p) is None else f"{v[p]:.1f}"


def load(paths: list[str]) -> list[dict]:
    records = []
    for path in paths:
        with open(path) as f:
            records += [json.loads(line) for line in f if line.strip()]
    return records


def main() -> None:
    records = load(sys.argv[1:])
    by_mode: dict[str, list[dict]] = {}
    for r in records:
        by_mode.setdefault(r["mode"], []).append(r)

    for r in by_mode.get("race", []):
        res = r["result"]
        print("### G4 · concurrent identical moves\n")
        print("| Rounds | Requests/round | Rounds with exactly 1 accepted | Wrong final state | Status codes |")
        print("|---|---|---|---|---|")
        print(f"| {res['rounds']} | {res['concurrent_requests_per_round']} | "
              f"{res['rounds_by_accepted_count'].get('1', 0)} | {res['rounds_with_wrong_state']} | "
              f"{res['status_codes']} |\n")

    games = [r for r in by_mode.get("games", []) if "--eval" not in json.dumps(r["args"]) and not r["args"].get("eval")]
    if games:
        print("### G1/G2 · live games (no eval)\n")
        print("| Label | Games | Moves/s | Move HTTP p50 / p95 / p99 ms | Opponent delivery p50 / p95 / p99 ms | Missed | Errors |")
        print("|---|---|---|---|---|---|---|")
        for r in games:
            res, c = r["result"], r["result"]["counts"]
            errors = {k: v for k, v in c.items() if "error" in k or k.startswith("move_http_")}
            print(f"| {r['label']} | {r['args']['slots']} | {res['run']['moves_per_s']} | "
                  f"{lat(res, 'move_http_ms', 'p50')} / {lat(res, 'move_http_ms')} / {lat(res, 'move_http_ms', 'p99')} | "
                  f"{lat(res, 'move_delivery_ms', 'p50')} / {lat(res, 'move_delivery_ms')} / {lat(res, 'move_delivery_ms', 'p99')} | "
                  f"{c.get('move_delivery_missed', 0)} | {errors or 0} |")
        print()

    evals = [r for r in by_mode.get("games", []) if r["args"].get("eval")]
    if evals:
        print("### A2/A4 · games with live eval\n")
        print("| Label | Games | Eval requests | Dedupe hit rate | First eval p50 / p95 ms | Done p50 / p95 ms | Queue wait p95 ms | Stalled streams | Redis clients before → after |")
        print("|---|---|---|---|---|---|---|---|---|")
        for r in evals:
            res, c, run = r["result"], r["result"]["counts"], r["result"]["run"]
            n = c.get("eval_dedupe_hit", 0) + c.get("eval_new_job", 0)
            print(f"| {r['label']} | {r['args']['slots']} | {n} | {run.get('dedupe_hit_rate')} | "
                  f"{lat(res, 'eval_first_ms', 'p50')} / {lat(res, 'eval_first_ms')} | "
                  f"{lat(res, 'eval_done_ms', 'p50')} / {lat(res, 'eval_done_ms')} | {lat(res, 'eval_queue_wait_ms')} | "
                  f"{c.get('eval_stream_stalled', 0)} | {run['redis_before']['connected_clients']} → "
                  f"{run['redis_after_cooldown']['connected_clients']} |")
        print()

    if by_mode.get("eval"):
        print("### A3 · eval requests at a fixed rate\n")
        print("| Label | Offered /s | Completed /s | First eval p50 / p95 / p99 ms | Queue wait p50 / p95 ms | Stockfish p50 ms | Stalled |")
        print("|---|---|---|---|---|---|---|")
        for r in by_mode["eval"]:
            res, run = r["result"], r["result"]["run"]
            print(f"| {r['label']} | {run['offered_rate_per_s']} | {run['completed_per_s']} | "
                  f"{lat(res, 'eval_first_ms', 'p50')} / {lat(res, 'eval_first_ms')} / {lat(res, 'eval_first_ms', 'p99')} | "
                  f"{lat(res, 'eval_queue_wait_ms', 'p50')} / {lat(res, 'eval_queue_wait_ms')} | "
                  f"{lat(res, 'eval_engine_ms', 'p50')} | {res['counts'].get('eval_stream_stalled', 0)} |")
        print()

    if by_mode.get("streams"):
        print("### G3 · idle streams held open\n")
        print("| Idle streams | Open time s | Delivery p50 / p95 / p99 ms | Move HTTP p95 ms | Redis clients held | API RSS MB before → held |")
        print("|---|---|---|---|---|---|")
        for r in by_mode["streams"]:
            res, run = r["result"], r["result"]["run"]
            print(f"| {run['idle_streams_open']} | {run['seconds_to_open']} | "
                  f"{lat(res, 'move_delivery_ms', 'p50')} / {lat(res, 'move_delivery_ms')} / {lat(res, 'move_delivery_ms', 'p99')} | "
                  f"{lat(res, 'move_http_ms')} | {run['redis_while_held']['connected_clients']} | "
                  f"{run['api_rss_mb_before']} → {run['api_rss_mb_while_held']} |")
        print()

    for r in by_mode.get("chaos", []):
        res = r["result"]
        print("### A5 · worker crashes\n")
        print("| Jobs | Workers | SIGKILLs | Lost | Done | Retried | Slowest retried job s | Lists empty after |")
        print("|---|---|---|---|---|---|---|---|")
        print(f"| {res['jobs']} | {res['workers']} | {res['kills']} | {res['lost']} | "
              f"{res['statuses'].get('done', 0)} | {res['retried_jobs']} | {res['slowest_retried_job_s']} | "
              f"{res['ready_len_after'] == 0 and res['processing_len_after'] == 0} |\n")


if __name__ == "__main__":
    main()
