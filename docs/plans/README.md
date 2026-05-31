# Plans

- **Active plans** live in this folder (e.g. `online-friend-chess.plan.md`, `stockfish-engine-workers.plan.md`, `stockfish-queue-live-analysis.plan.md`).
- **Superseded or old iterations** go in [archive/](archive/) so history stays in the repo without cluttering the root.

| Plan | Status | Summary |
|------|--------|---------|
| [online-friend-chess.plan.md](online-friend-chess.plan.md) | Mostly shipped | Redis live state for friend games → Supabase archive |
| [stockfish-queue-live-analysis.plan.md](stockfish-queue-live-analysis.plan.md) | **Shipped (v1)** | Redis LIST queue, `engine-worker`, `/engine/jobs` + SSE, Nimbus live eval + review d20 |
| [stockfish-engine-analysis.plan.md](stockfish-engine-analysis.plan.md) | Planned (context) | Product/architecture overview; in-process MVP deferred in favor of queue plan |
