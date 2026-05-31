-- Fix legacy DBs: `black_player_id` was NOT NULL in older 001 scripts.
-- Skip if you use current `supabase_schema.sql` or current `001_completed_games.sql` (nullable already).
-- Supabase SQL Editor → New query → run once.

alter table public.completed_games
  alter column black_player_id drop not null;

comment on table public.completed_games is
  'Friend games archived from Redis: finished normally, resigned, or abandoned (Redis TTL / expired lobby).';
