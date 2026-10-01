#!/usr/bin/env python3
"""HTTP + SSE benchmarks for live friend games and engine eval.

Talks to a running API (usually scripts/bench_app.py) exactly like two phones would:
create/join, open both players' /games/{id}/events streams, alternate random legal
moves, and optionally request live eval for every position from both players.

Modes
  games    Concurrent games for a fixed duration.
           move_http_ms      POST /move round trip                         (G1)
           move_delivery_ms  move sent -> opponent's SSE receives it         (G2)
           eval_*            time to first eval / done, dedupe hits (--eval) (A2, A4)
           redis clients + memory before/after                             (G5)
  eval     Open-loop eval requests at a fixed rate, unique positions         (A3)
  race     K identical moves fired at one game at the same instant           (G4)
  streams  Hold N idle game streams open, then measure move delivery        (G3)

Examples
  .venv/bin/python scripts/bench_live.py games --slots 50 --duration 60
  .venv/bin/python scripts/bench_live.py games --slots 20 --duration 60 --eval --eval-depth 12
  .venv/bin/python scripts/bench_live.py eval --rate 8 --duration 30 --eval-depth 12
  .venv/bin/python scripts/bench_live.py race --rounds 50 --concurrency 20
  .venv/bin/python scripts/bench_live.py streams --idle 2000 --sample-games 20
"""
from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import random
import subprocess
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import chess
import httpx
import redis.asyncio as aioredis

TERMINAL = {"done", "failed", "cancelled"}


# ---------------------------------------------------------------- metrics


class Metrics:
    def __init__(self) -> None:
        self.samples: dict[str, list[float]] = defaultdict(list)
        self.counts: Counter[str] = Counter()
        self.new_job_ids: list[str] = []

    def add(self, name: str, ms: float) -> None:
        self.samples[name].append(ms)

    def count(self, name: str, n: int = 1) -> None:
        self.counts[name] += n

    def summary(self) -> dict:
        return {
            "latency_ms": {k: summarize(v) for k, v in sorted(self.samples.items())},
            "counts": dict(sorted(self.counts.items())),
        }


def percentile(sorted_values: list[float], p: float) -> float:
    if not sorted_values:
        return float("nan")
    rank = max(1, math.ceil(p / 100 * len(sorted_values)))
    return sorted_values[rank - 1]


def summarize(values: list[float]) -> dict:
    v = sorted(values)
    return {
        "n": len(v),
        "p50": round(percentile(v, 50), 2),
        "p95": round(percentile(v, 95), 2),
        "p99": round(percentile(v, 99), 2),
        "max": round(v[-1], 2) if v else None,
        "mean": round(sum(v) / len(v), 2) if v else None,
    }


# ---------------------------------------------------------------- client helpers


def auth(username: str) -> dict[str, str]:
    return {"Authorization": f"Bearer bench:{username}"}


def make_client(base: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=base,
        timeout=httpx.Timeout(30.0),
        limits=httpx.Limits(max_connections=None, max_keepalive_connections=None),
    )


class GameStream:
    """One player's /games/{id}/events stream; events land in a queue with receive time."""

    def __init__(self, client: httpx.AsyncClient, game_id: str, username: str) -> None:
        self.client = client
        self.url = f"/games/{game_id}/events"
        self.username = username
        self.queue: asyncio.Queue[tuple[float, dict] | None] = asyncio.Queue()
        self.task: asyncio.Task | None = None

    async def start(self, timeout: float = 15.0) -> None:
        self.task = asyncio.create_task(self._run())
        await self.next_event(timeout)  # initial snapshot

    async def _run(self) -> None:
        try:
            async with self.client.stream(
                "GET", self.url, headers=auth(self.username),
                timeout=httpx.Timeout(15.0, read=None),
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        await self.queue.put((time.perf_counter(), json.loads(line[6:])))
        except (httpx.HTTPError, asyncio.CancelledError):
            pass
        finally:
            await self.queue.put(None)

    async def next_event(self, timeout: float) -> tuple[float, dict]:
        item = await asyncio.wait_for(self.queue.get(), timeout)
        if item is None:
            raise ConnectionError("stream closed")
        return item

    async def wait_for_ply(self, ply: int, timeout: float) -> float:
        deadline = time.perf_counter() + timeout
        while True:
            remaining = deadline - time.perf_counter()
            if remaining <= 0:
                raise asyncio.TimeoutError
            t, data = await self.next_event(remaining)
            if len(data.get("move_history") or []) >= ply:
                return t

    def drain(self) -> None:
        while not self.queue.empty():
            self.queue.get_nowait()

    async def close(self) -> None:
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except BaseException:
                pass


async def new_game(client: httpx.AsyncClient, white: str, black: str) -> str:
    r = await client.post("/games", headers=auth(white))
    r.raise_for_status()
    invite = r.json()["invite_code"]
    r = await client.post("/games/join", json={"invite_code": invite}, headers=auth(black))
    r.raise_for_status()
    return r.json()["game_id"]


async def run_eval(
    client: httpx.AsyncClient, username: str, fen: str, args, m: Metrics
) -> None:
    t0 = time.perf_counter()
    try:
        r = await client.post(
            "/engine/jobs",
            json={"fen": fen, "depth": args.eval_depth, "profile": "play"},
            headers=auth(username),
        )
    except httpx.HTTPError:
        m.count("eval_post_transport_error")
        return
    if r.status_code != 200:
        m.count(f"eval_post_http_{r.status_code}")
        return
    m.add("eval_post_ms", (time.perf_counter() - t0) * 1000)
    body = r.json()
    job_id = body["job_id"]
    if body["dedupe_hit"]:
        m.count("eval_dedupe_hit")
    else:
        m.count("eval_new_job")
        m.new_job_ids.append(job_id)

    first_eval = None
    try:
        async with client.stream(
            "GET", f"/engine/jobs/{job_id}/events", headers=auth(username),
            timeout=httpx.Timeout(15.0, read=args.eval_timeout),
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                event = json.loads(line[6:])
                now = time.perf_counter()
                result = event.get("result") or {}
                if first_eval is None and result.get("lines"):
                    first_eval = now
                    m.add("eval_first_ms", (now - t0) * 1000)
                if event["status"] in TERMINAL:
                    m.add("eval_done_ms", (now - t0) * 1000)
                    m.count(f"eval_status_{event['status']}")
                    return
        m.count("eval_stream_ended_early")
    except httpx.ReadTimeout:
        m.count("eval_stream_stalled")  # no event for eval_timeout seconds
    except httpx.HTTPError:
        m.count("eval_stream_transport_error")


async def play_game(
    client: httpx.AsyncClient,
    white: str,
    black: str,
    args,
    m: Metrics,
    rng: random.Random,
    *,
    eval_tasks: list[asyncio.Task] | None = None,
) -> None:
    try:
        game_id = await new_game(client, white, black)
    except httpx.HTTPError as e:
        m.count(f"game_create_{type(e).__name__}")
        return
    streams = {white: GameStream(client, game_id, white), black: GameStream(client, game_id, black)}
    try:
        await asyncio.gather(*(s.start() for s in streams.values()))
    except Exception:
        m.count("stream_open_error")
        await asyncio.gather(*(s.close() for s in streams.values()))
        return
    m.count("games_started")

    board = chess.Board()
    try:
        for _ in range(args.moves):
            if board.is_game_over():
                break
            mover, opponent = (white, black) if board.turn == chess.WHITE else (black, white)
            move = rng.choice(list(board.legal_moves))
            san = board.san(move)
            board.push(move)

            t0 = time.perf_counter()
            try:
                r = await client.post(f"/games/{game_id}/move", json={"san": san}, headers=auth(mover))
            except httpx.HTTPError as e:
                m.count(f"move_transport_{type(e).__name__}")
                break
            m.add("move_http_ms", (time.perf_counter() - t0) * 1000)
            if r.status_code != 200:
                m.count(f"move_http_{r.status_code}")
                break
            m.count("moves")
            try:
                t_recv = await streams[opponent].wait_for_ply(len(board.move_stack), args.delivery_timeout)
                m.add("move_delivery_ms", (t_recv - t0) * 1000)
            except (asyncio.TimeoutError, ConnectionError):
                m.count("move_delivery_missed")
            streams[mover].drain()

            if eval_tasks is not None:
                fen = board.fen()
                for player in (white, black):
                    eval_tasks.append(asyncio.create_task(run_eval(client, player, fen, args, m)))

            if board.is_game_over():
                m.count("games_finished")
                break
            await asyncio.sleep(args.think_ms / 1000)
    finally:
        await asyncio.gather(*(s.close() for s in streams.values()))


# ---------------------------------------------------------------- redis / process probes


async def redis_probe(url: str) -> dict:
    r = aioredis.from_url(url, decode_responses=True)
    try:
        clients = await r.info("clients")
        memory = await r.info("memory")
        return {
            "connected_clients": clients["connected_clients"],
            "used_memory_mb": round(memory["used_memory"] / 1e6, 2),
            "dbsize": await r.dbsize(),
        }
    finally:
        await r.aclose()


def process_tree(pid: int) -> list[int]:
    pids, frontier = [pid], [pid]
    while frontier:
        out = subprocess.run(["pgrep", "-P", str(frontier.pop())], capture_output=True, text=True).stdout
        kids = [int(x) for x in out.split()]
        pids += kids
        frontier += kids
    return pids


def tree_cpu_and_rss(pid: int | None) -> tuple[float, float] | None:
    """Summed %CPU (100 = one core) and RSS MB for a process and its children."""
    if not pid:
        return None
    pids = ",".join(str(p) for p in process_tree(pid))
    out = subprocess.run(["ps", "-o", "%cpu=,rss=", "-p", pids], capture_output=True, text=True).stdout
    cpu = rss = 0.0
    for line in out.splitlines():
        parts = line.split()
        if len(parts) == 2:
            cpu += float(parts[0]); rss += float(parts[1]) / 1024
    return round(cpu, 1), round(rss, 1)


class CpuSampler:
    """Samples API and load-generator CPU once a second so saturation can be attributed."""

    def __init__(self, api_pid: int | None) -> None:
        self.api_pid = api_pid
        self.api: list[float] = []
        self.loadgen: list[float] = []
        self._task: asyncio.Task | None = None

    async def _run(self) -> None:
        me = os.getpid()
        while True:
            await asyncio.sleep(1.0)
            a = await asyncio.to_thread(tree_cpu_and_rss, self.api_pid)
            g = await asyncio.to_thread(tree_cpu_and_rss, me)
            if a:
                self.api.append(a[0])
            if g:
                self.loadgen.append(g[0])

    def start(self) -> None:
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> dict:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except BaseException:
                pass
        def stats(v):
            return {"mean_pct": round(sum(v) / len(v), 1), "max_pct": max(v)} if v else None
        return {"api_cpu": stats(self.api), "loadgen_cpu": stats(self.loadgen),
                "note": "100% = one core; summed over child processes"}


def rss_mb(pid: int | None) -> float | None:
    got = tree_cpu_and_rss(pid)
    return got[1] if got else None


async def engine_timings(url: str, job_ids: list[str], m: Metrics) -> None:
    """Queue wait and Stockfish time per job, from the job hashes the worker wrote."""
    from datetime import datetime

    r = aioredis.from_url(url, decode_responses=True)
    try:
        for job_id in job_ids:
            h = await r.hgetall(f"engine:job:{job_id}")
            if not h or not h.get("claimed_at"):
                continue
            created = datetime.fromisoformat(h["created_at"])
            claimed = datetime.fromisoformat(h["claimed_at"])
            m.add("eval_queue_wait_ms", (claimed - created).total_seconds() * 1000)
            if h.get("result_json"):
                res = json.loads(h["result_json"])
                if res.get("engine_time_ms") is not None:
                    m.add("eval_engine_ms", res["engine_time_ms"])
    finally:
        await r.aclose()


# ---------------------------------------------------------------- modes


async def games_shard(args, first_slot: int, n_slots: int, m: Metrics) -> None:
    deadline = time.perf_counter() + args.duration
    eval_tasks: list[asyncio.Task] | None = [] if args.eval else None
    async with make_client(args.base) as client:
        async def slot(i: int) -> None:
            rng = random.Random(args.seed + i)
            await asyncio.sleep(rng.random() * min(10.0, args.duration / 4))  # stagger starts
            n = 0
            while time.perf_counter() < deadline:
                await play_game(client, f"w{i}_{n}", f"b{i}_{n}", args, m, rng, eval_tasks=eval_tasks)
                n += 1

        await asyncio.gather(*(slot(i) for i in range(first_slot, first_slot + n_slots)))
        if eval_tasks:
            await asyncio.gather(*eval_tasks)


def _games_shard_process(args, first_slot: int, n_slots: int) -> dict:
    m = Metrics()
    asyncio.run(games_shard(args, first_slot, n_slots, m))
    return {"samples": dict(m.samples), "counts": dict(m.counts), "new_job_ids": m.new_job_ids}


async def mode_games(args) -> dict:
    from concurrent.futures import ProcessPoolExecutor

    m = Metrics()
    before = await redis_probe(args.redis_url)
    rss_before = rss_mb(args.api_pid)
    sampler = CpuSampler(args.api_pid)
    sampler.start()
    started = time.perf_counter()
    if args.procs <= 1:
        await games_shard(args, 0, args.slots, m)
    else:
        loop = asyncio.get_running_loop()
        shares = [args.slots // args.procs + (1 if i < args.slots % args.procs else 0) for i in range(args.procs)]
        firsts = [sum(shares[:i]) for i in range(args.procs)]
        with ProcessPoolExecutor(max_workers=args.procs) as pool:
            parts = await asyncio.gather(*(
                loop.run_in_executor(pool, _games_shard_process, args, firsts[i], shares[i])
                for i in range(args.procs) if shares[i]
            ))
        for part in parts:
            for k, v in part["samples"].items():
                m.samples[k].extend(v)
            m.counts.update(part["counts"])
            m.new_job_ids += part["new_job_ids"]
    elapsed = time.perf_counter() - started
    cpu = await sampler.stop()

    if args.eval:
        await engine_timings(args.engine_redis_url, m.new_job_ids, m)
    await asyncio.sleep(args.cooldown)
    after = await redis_probe(args.redis_url)
    out = m.summary()
    out["run"] = {
        "elapsed_s": round(elapsed, 1),
        "moves_per_s": round(m.counts["moves"] / elapsed, 1),
        "redis_before": before,
        "redis_after_cooldown": after,
        "api_rss_mb_before": rss_before,
        "api_rss_mb_after": rss_mb(args.api_pid),
        "loadgen_procs": args.procs,
        **cpu,
    }
    if args.eval:
        hits, new = m.counts["eval_dedupe_hit"], m.counts["eval_new_job"]
        out["run"]["dedupe_hit_rate"] = round(hits / (hits + new), 3) if hits + new else None
    return out


def random_positions(count: int, seed: int) -> list[str]:
    rng = random.Random(seed)
    fens: set[str] = set()
    while len(fens) < count:
        board = chess.Board()
        for _ in range(rng.randint(4, 40)):
            moves = list(board.legal_moves)
            if not moves:
                break
            board.push(rng.choice(moves))
        if not board.is_game_over():
            fens.add(board.fen())
    return list(fens)


async def mode_eval(args) -> dict:
    m = Metrics()
    total = int(args.rate * args.duration)
    fens = random_positions(total, args.seed + int(time.time()))
    interval = 1.0 / args.rate
    tasks: list[asyncio.Task] = []
    sampler = CpuSampler(args.api_pid)
    sampler.start()
    async with make_client(args.base) as client:
        start = time.perf_counter()
        for i, fen in enumerate(fens):
            delay = start + i * interval - time.perf_counter()
            if delay > 0:
                await asyncio.sleep(delay)
            tasks.append(asyncio.create_task(run_eval(client, f"e{i % 100}", fen, args, m)))
        await asyncio.gather(*tasks)
        elapsed = time.perf_counter() - start
    await engine_timings(args.engine_redis_url, m.new_job_ids, m)
    out = m.summary()
    out["run"] = {
        "offered_rate_per_s": args.rate,
        "requests": total,
        "elapsed_s": round(elapsed, 1),
        "completed_per_s": round(m.counts["eval_status_done"] / elapsed, 2),
        **(await sampler.stop()),
    }
    return out


async def mode_race(args) -> dict:
    accepted: Counter[int] = Counter()
    statuses: Counter[str] = Counter()
    bad_rounds = 0
    async with make_client(args.base) as client:
        for n in range(args.rounds):
            white, black = f"rw{n}", f"rb{n}"
            game_id = await new_game(client, white, black)
            barrier = asyncio.Event()

            async def fire():
                await barrier.wait()
                return await client.post(f"/games/{game_id}/move", json={"san": "e4"}, headers=auth(white))

            tasks = [asyncio.create_task(fire()) for _ in range(args.concurrency)]
            await asyncio.sleep(0)
            barrier.set()
            responses = await asyncio.gather(*tasks)
            codes = [r.status_code for r in responses]
            statuses.update(str(c) for c in codes)
            ok = codes.count(200)
            accepted[ok] += 1
            state = (await client.get(f"/games/{game_id}", headers=auth(black))).json()
            if ok != 1 or state["move_history"] != ["e4"]:
                bad_rounds += 1
    return {
        "rounds": args.rounds,
        "concurrent_requests_per_round": args.concurrency,
        "rounds_by_accepted_count": {str(k): v for k, v in sorted(accepted.items())},
        "status_codes": dict(statuses),
        "rounds_with_wrong_state": bad_rounds,
    }


async def mode_streams(args) -> dict:
    m = Metrics()
    before = await redis_probe(args.redis_url)
    rss_before = rss_mb(args.api_pid)
    idle: list[GameStream] = []
    sem = asyncio.Semaphore(100)
    async with make_client(args.base) as client:
        async def open_pair(i: int) -> None:
            async with sem:
                white, black = f"iw{i}", f"ib{i}"
                try:
                    game_id = await new_game(client, white, black)
                    pair = [GameStream(client, game_id, white), GameStream(client, game_id, black)]
                    await asyncio.gather(*(s.start(timeout=30) for s in pair))
                    idle.extend(pair)
                except Exception:
                    m.count("idle_stream_open_error")

        t0 = time.perf_counter()
        await asyncio.gather(*(open_pair(i) for i in range(math.ceil(args.idle / 2))))
        open_s = time.perf_counter() - t0
        await asyncio.sleep(2)
        held = await redis_probe(args.redis_url)
        rss_held = rss_mb(args.api_pid)

        rng = random.Random(args.seed)
        sampler = CpuSampler(args.api_pid)
        sampler.start()
        await asyncio.gather(
            *(play_game(client, f"sw{i}", f"sb{i}", args, m, rng) for i in range(args.sample_games))
        )
        await asyncio.gather(*(s.close() for s in idle))
    await asyncio.sleep(args.cooldown)
    out = m.summary()
    out["run"] = {
        "idle_streams_open": len(idle),
        "seconds_to_open": round(open_s, 1),
        "redis_before": before,
        "redis_while_held": held,
        "redis_after_cooldown": await redis_probe(args.redis_url),
        "api_rss_mb_before": rss_before,
        "api_rss_mb_while_held": rss_held,
        **(await sampler.stop()),
    }
    return out


# ---------------------------------------------------------------- main


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("mode", choices=["games", "eval", "race", "streams"])
    p.add_argument("--base", default="http://127.0.0.1:8100")
    p.add_argument("--redis-url", default="redis://127.0.0.1:6379/10")
    p.add_argument("--engine-redis-url", default="redis://127.0.0.1:6379/11")
    p.add_argument("--api-pid", type=int, help="API process id, to sample its memory")
    p.add_argument("--seed", type=int, default=7)
    p.add_argument("--out", help="Append the JSON result to this file (one object per line)")
    p.add_argument("--label", default="", help="Free-text label stored with the result")
    # games / streams
    p.add_argument("--slots", type=int, default=20, help="Concurrent games (games mode)")
    p.add_argument("--procs", type=int, default=1, help="Load-generator processes (games mode)")
    p.add_argument("--duration", type=float, default=60.0, help="Seconds (games, eval)")
    p.add_argument("--moves", type=int, default=40, help="Max plies per game")
    p.add_argument("--think-ms", type=float, default=500.0, help="Pause between moves")
    p.add_argument("--delivery-timeout", type=float, default=10.0)
    p.add_argument("--cooldown", type=float, default=5.0, help="Wait before the final Redis probe")
    p.add_argument("--idle", type=int, default=1000, help="Idle streams to hold (streams mode)")
    p.add_argument("--sample-games", type=int, default=20)
    # eval
    p.add_argument("--eval", action="store_true", help="Request live eval after every move")
    p.add_argument("--eval-depth", type=int, default=12)
    p.add_argument("--eval-timeout", type=float, default=60.0, help="Max silence on an eval stream")
    p.add_argument("--rate", type=float, default=4.0, help="Eval requests per second (eval mode)")
    # race
    p.add_argument("--rounds", type=int, default=50)
    p.add_argument("--concurrency", type=int, default=20)
    args = p.parse_args()

    runner = {"games": mode_games, "eval": mode_eval, "race": mode_race, "streams": mode_streams}[args.mode]
    result = asyncio.run(runner(args))
    record = {
        "mode": args.mode,
        "label": args.label,
        "at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "args": {k: v for k, v in vars(args).items() if k not in ("out",)},
        "result": result,
    }
    print(json.dumps(record, indent=2))
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        with open(args.out, "a") as f:
            f.write(json.dumps(record) + "\n")


if __name__ == "__main__":
    sys.exit(main())
