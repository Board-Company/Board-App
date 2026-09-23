#!/usr/bin/env python3
"""Run the real API for benchmarks, without Supabase.

Everything on the Redis path is the production code: routes, locks, pub/sub, SSE, the
engine queue. Two things are replaced so results measure that path and nothing leaves
the machine:

- `supabase_client` is a stub (archive upserts succeed instantly, no network).
- `get_current_active_user` accepts `Authorization: Bearer bench:<username>` instead of
  a JWT + Supabase user lookup.

Redis defaults to db 10 (games) and db 11 (engine) so benchmarks never touch dev data.

  cd Board-Backend
  .venv/bin/python scripts/bench_app.py --port 8100
"""
from __future__ import annotations

import argparse
import os
import sys
import types
import uuid
from pathlib import Path
from unittest.mock import MagicMock

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/10")
os.environ.setdefault("REDIS_ENGINE_URL", "redis://127.0.0.1:6379/11")
os.environ.setdefault("SECRET_KEY", "bench-secret-key-not-for-production")


def _stub_supabase() -> None:
    client = MagicMock()

    def _table(_name):
        chain = MagicMock()
        ok = MagicMock(data=[{"ok": True}])
        chain.insert.return_value.execute.return_value = ok
        chain.upsert.return_value.execute.return_value = ok
        chain.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            MagicMock(data=[])
        )
        return chain

    client.table.side_effect = _table
    mod = types.ModuleType("supabase_client")
    mod.supabase = client
    sys.modules["supabase_client"] = mod


_stub_supabase()

from fastapi import Header, HTTPException  # noqa: E402
from loguru import logger  # noqa: E402

import api  # noqa: E402
from auth import get_current_active_user  # noqa: E402
from schemas import User  # noqa: E402

BENCH_PREFIX = "Bearer bench:"


async def bench_user(authorization: str | None = Header(default=None)) -> User:
    if not authorization or not authorization.startswith(BENCH_PREFIX):
        raise HTTPException(status_code=401, detail="Use Authorization: Bearer bench:<username>")
    username = authorization.removeprefix(BENCH_PREFIX)
    return User(
        id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"bench:{username}")),
        username=username,
        email=f"{username}@bench.local",
        disabled=False,
    )


api.app.dependency_overrides[get_current_active_user] = bench_user
app = api.app

# Per-request DEBUG logging to api.log would be measured too; keep warnings only.
logger.remove()
logger.add(sys.stderr, level="WARNING")


def main() -> None:
    import uvicorn

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8100)
    parser.add_argument(
        "--workers", type=int, default=1,
        help="uvicorn worker processes (production Dockerfile runs 1)",
    )
    args = parser.parse_args()
    print(f"bench API on http://{args.host}:{args.port}  pid={os.getpid()}  workers={args.workers}")
    print(f"  REDIS_URL={os.environ['REDIS_URL']}  REDIS_ENGINE_URL={os.environ['REDIS_ENGINE_URL']}")
    if args.workers == 1:
        uvicorn.run(app, host=args.host, port=args.port, log_level="warning", access_log=False)
    else:
        # Workers re-import this module by name; spawn copies sys.path to children.
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        uvicorn.run(
            "bench_app:app", host=args.host, port=args.port, workers=args.workers,
            log_level="warning", access_log=False,
        )


if __name__ == "__main__":
    main()
