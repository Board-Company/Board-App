-- Migration: add completed_games for friend chess (run if you already have users/lichess_users
-- from an older schema and only need this table)
-- Supabase SQL Editor → paste → run

create table if not exists public.completed_games (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null unique,
  white_player_id uuid not null references public.users (id),
  black_player_id uuid not null references public.users (id),
  move_history jsonb not null default '[]'::jsonb,
  final_fen text not null,
  result text not null,
  finished_reason text,
  started_at timestamptz not null,
  finished_at timestamptz not null default now()
);

create index if not exists idx_completed_games_white on public.completed_games (white_player_id);
create index if not exists idx_completed_games_black on public.completed_games (black_player_id);

comment on table public.completed_games is 'Finished in-app friend games; archived from Redis on terminal.';
