-- Board-Backend Supabase schema
-- Run this in your Supabase project: SQL Editor → New query → paste and run

-- Users table (app accounts: email/password and Google OAuth)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  email text unique,
  hashed_password text,
  disabled boolean not null default false,
  picture text,
  auth_provider text,
  lichess_username text,
  lichess_linked boolean default false,
  lichess_rating jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Lichess OAuth tokens (linked to app users via lichess_username)
create table if not exists public.lichess_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  access_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Optional: index for lookups
create index if not exists idx_users_email on public.users (email);
create index if not exists idx_users_lichess_username on public.users (lichess_username);

-- Finished friend games (archived from Redis when terminal)
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

-- Supabase RLS: backend uses the service_role key, which bypasses RLS.
-- If you use the anon key instead, uncomment and adjust policies as needed.
-- alter table public.users enable row level security;
-- alter table public.lichess_users enable row level security;
