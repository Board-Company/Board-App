-- Restore Board-App data from backup: db_cluster-13-06-2025@04-25-42.backup (1).gz
-- Run this in Supabase SQL Editor AFTER running supabase_schema.sql (so tables exist).
-- Inserts your previous users and lichess_users data.

-- 1. Lichess users (insert first; users table references this)
INSERT INTO public.lichess_users (id, username, access_token, created_at, updated_at)
VALUES
  ('b84820a3-76b5-4115-9b8b-b97e1ec08b56', 'wsarker', 'lio_REVOKED_TOKEN_REMOVED_FROM_HISTORY', '2025-05-22 05:56:40.731302+00', '2025-05-22 05:56:40.731302+00')
ON CONFLICT (username) DO UPDATE SET
  access_token = EXCLUDED.access_token,
  updated_at = EXCLUDED.updated_at;

-- 2. App users
INSERT INTO public.users (id, username, email, hashed_password, disabled, created_at, lichess_username, lichess_linked)
VALUES
  ('4fe534ee-5be5-4457-8d8b-75bd65997bc1', 'redacted1@example.com', 'redacted1@example.com', '$2b$12$REDACTED_PASSWORD_HASH', false, '2025-05-03 01:03:06.841217+00', NULL, false),
  ('851ddd20-b4d5-4f60-a2b2-98930c784b78', 'test', 'test@gmail.com', '$2b$12$REDACTED_PASSWORD_HASH', false, '2025-05-04 03:00:55.6453+00', 'wsarker', true),
  ('fb91c661-90d8-4e91-b29b-ed7ca73f8b70', 'redacted2@example.com', 'redacted2@example.com', '$2b$12$REDACTED_PASSWORD_HASH', false, '2025-05-05 00:17:44.340244+00', 'wsarker', true)
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  hashed_password = EXCLUDED.hashed_password,
  disabled = EXCLUDED.disabled,
  lichess_username = EXCLUDED.lichess_username,
  lichess_linked = EXCLUDED.lichess_linked;
