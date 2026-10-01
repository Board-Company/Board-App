#!/usr/bin/env python3
"""End-to-end check: two players, one spectator, live eval.

Runs against a bench API (scripts/bench_app.py) so it never touches Supabase:

  A creates a game, B joins with the code, C opens it with the same code as a
  spectator and holds the SSE stream. A and B play moves; C must receive each one.
  C then requests engine eval for the live position and must get a real score.

  .venv/bin/python scripts/verify_spectate_eval.py --base http://127.0.0.1:8100
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys

import chess
import httpx

OPENING = ["e4", "e5", "Nf3", "Nc6", "Bb5"]


def auth(name: str) -> dict[str, str]:
    return {"Authorization": f"Bearer bench:{name}"}


async def read_events(client: httpx.AsyncClient, url: str, name: str, q: asyncio.Queue) -> None:
    async with client.stream("GET", url, headers=auth(name), timeout=httpx.Timeout(10, read=None)) as r:
        r.raise_for_status()
        async for line in r.aiter_lines():
            if line.startswith("data: "):
                await q.put(json.loads(line[6:]))


async def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="http://127.0.0.1:8100")
    p.add_argument("--depth", type=int, default=12)
    args = p.parse_args()

    failures: list[str] = []

    def check(ok: bool, label: str, detail: str = "") -> None:
        print(f"  {'PASS' if ok else 'FAIL'}  {label}{(' — ' + detail) if detail else ''}")
        if not ok:
            failures.append(label)

    async with httpx.AsyncClient(base_url=args.base, timeout=30) as client:
        print("game setup")
        created = (await client.post("/games", headers=auth("alice"))).json()
        game_id, code = created["game_id"], created["invite_code"]
        check(bool(code), "host creates game", f"invite {code}")
        joined = await client.post("/games/join", json={"invite_code": code}, headers=auth("bob"))
        check(joined.status_code == 200, "opponent joins with code")

        print("spectator")
        watched = await client.post("/games/watch", json={"invite_code": code}, headers=auth("carol"))
        body = watched.json()
        check(watched.status_code == 200, "spectator opens game with the same code")
        check(body.get("role") == "spectator", "spectator role reported", str(body.get("role")))
        check(body.get("spectator_count") == 1, "spectator counted", str(body.get("spectator_count")))

        stranger = await client.get(f"/games/{game_id}", headers=auth("mallory"))
        check(stranger.status_code == 403, "stranger without the code refused", str(stranger.status_code))

        q: asyncio.Queue = asyncio.Queue()
        stream = asyncio.create_task(read_events(client, f"/games/{game_id}/events", "carol", q))
        first = await asyncio.wait_for(q.get(), timeout=10)
        check(first["game_id"] == game_id, "spectator stream opens with a snapshot")

        print("live moves")
        board = chess.Board()
        for i, san in enumerate(OPENING):
            mover = "alice" if board.turn == chess.WHITE else "bob"
            board.push_san(san)
            r = await client.post(f"/games/{game_id}/move", json={"san": san}, headers=auth(mover))
            if r.status_code != 200:
                check(False, f"move {san} accepted", r.text[:80])
                break
            seen = None
            while True:
                event = await asyncio.wait_for(q.get(), timeout=10)
                if len(event["move_history"]) >= i + 1:
                    seen = event
                    break
            check(
                seen is not None and seen["move_history"][-1] == san,
                f"spectator sees move {san}",
                f"history {len(seen['move_history'])} plies" if seen else "timeout",
            )

        print("live eval for the spectator")
        job = await client.post(
            "/engine/jobs",
            json={"fen": board.fen(), "depth": args.depth, "profile": "play"},
            headers=auth("carol"),
        )
        check(job.status_code == 200, "spectator may request eval", str(job.status_code))
        job_id = job.json()["job_id"]
        got_line, final = None, None
        async with client.stream(
            "GET", f"/engine/jobs/{job_id}/events", headers=auth("carol"),
            timeout=httpx.Timeout(10, read=60),
        ) as r:
            async for line in r.aiter_lines():
                if not line.startswith("data: "):
                    continue
                event = json.loads(line[6:])
                result = event.get("result") or {}
                if result.get("lines") and got_line is None:
                    got_line = result["lines"][0]
                if event["status"] in ("done", "failed", "cancelled"):
                    final = event
                    break
        check(final is not None and final["status"] == "done", "eval job completes",
              final["status"] if final else "no terminal event")
        result = (final or {}).get("result") or {}
        lines = result.get("lines") or []
        check(bool(lines), "eval returns a line")
        if lines:
            top = lines[0]
            score = top.get("score_cp")
            check(len(lines) == 1, "one line per multipv slot", f"{len(lines)} lines")
            check(result.get("depth") == args.depth, "reached requested depth", str(result.get("depth")))
            check(score is not None and -200 <= score <= 200,
                  "score is sane for a book position", f"{score} cp")
            check(bool(top.get("uci_pv")), "principal variation present",
                  " ".join(top.get("uci_pv", [])[:3]))
            board_check = chess.Board(board.fen())
            best = result.get("bestmove_uci")
            check(best is not None and chess.Move.from_uci(best) in board_check.legal_moves,
                  "best move is legal in this position", str(best))

        stream.cancel()

    print()
    if failures:
        print(f"{len(failures)} check(s) failed: {', '.join(failures)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
