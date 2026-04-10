# Documentation

This folder is the **technical knowledge base** for Board-App: contracts, storage, and cross-cutting behavior. It is meant to stay aligned with the code (see `.cursor/rules/maintain-docs-knowledge.mdc` for agent expectations).

## For GitHub / portfolio readers

1. Start with the root **[README.md](../README.md)** — architecture, quick start, and repo map.
2. Use the tables below to jump into contracts and internals.
3. Browse **[plans/](plans/)** for design notes and roadmaps; superseded material lives in **[plans/archive/](plans/archive/)**.

## Knowledge base (keep in sync with the codebase)

| Topic | File | Read when you care about… |
|-------|------|---------------------------|
| HTTP surface, auth, SSE, engine | [api-routes.md](api-routes.md) | Endpoints, request/response shapes, errors (`/games`, `/engine`, …) |
| Postgres + Redis | [database-schema.md](database-schema.md) | Tables, keys, TTLs, engine MVP (no engine Redis yet), migrations pointers |
| Subtle flows | [complex-logic.md](complex-logic.md) | Friend games, Redis → archive, client resume, SSE fallbacks, Stockfish UCI threading |

## Plans (time-bound)

- **[plans/](plans/)** — Active technical and product plans.
- **[plans/archive/](plans/archive/)** — Superseded or completed plan documents.

## Suggested reading order (new contributors)

1. Root README — run the stack.
2. [api-routes.md](api-routes.md) — what the mobile app and tools call.
3. [complex-logic.md](complex-logic.md) — why friend games behave the way they do on the wire and in the app (and how Stockfish stays off the event loop).
