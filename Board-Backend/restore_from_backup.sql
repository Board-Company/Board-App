-- Template for restoring Board-App data into a fresh Supabase project.
-- Run AFTER supabase_schema.sql so the tables exist.
--
-- This file is intentionally a template. It once contained a real database
-- dump — live Lichess OAuth tokens, user emails and bcrypt password hashes —
-- committed to a public repository. Never paste a real dump here: export it to
-- a file matching the *.dump.sql / backups/ patterns in .gitignore, which git
-- will not track.

-- 1. Lichess users (insert first; public.users references this table).
INSERT INTO public.lichess_users (id, username, access_token, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'example_user', 'lio_REPLACE_WITH_A_TOKEN_FROM_YOUR_OWN_ACCOUNT', now(), now())
ON CONFLICT (username) DO UPDATE SET
  access_token = EXCLUDED.access_token,
  updated_at = EXCLUDED.updated_at;

-- 2. App users. `hashed_password` must be a bcrypt hash produced by the API
--    (auth.py uses passlib bcrypt) — never a plaintext password.
INSERT INTO public.users (id, username, email, hashed_password, disabled, created_at, lichess_username, lichess_linked)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'example_user', 'user@example.com', '$2b$12$REPLACE_WITH_A_BCRYPT_HASH', false, now(), 'example_user', true)
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  hashed_password = EXCLUDED.hashed_password,
  disabled = EXCLUDED.disabled,
  lichess_username = EXCLUDED.lichess_username,
  lichess_linked = EXCLUDED.lichess_linked;
