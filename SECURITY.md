# Security

## Auth

- Bearer token via `authorization` header. Rotate `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` regularly.
- Supabase RLS on `public.tracks`: `auth.uid() = user_id` enforces owner-only access.
- Supabase storage bucket `drumless-audio`: `public=false` with folder-level RLS. Users own their own audio files.

## Env

- `.env` files gitignored. Never commit real keys.
- `.env.example` has placeholder values only.

## Rate Limiting

- Configured in `supabase/config.toml`. Adjust request quotas per IP/user to mitigate abuse.

## SQL Migrations

- Migrations in `supabase/migrations/` use pgcrypto extension.
- Check `status` enum has valid values. Triggers set `updated_at` automatically.

## Dependency Hygiene

- Run `pip-compile --generate-hashes server/requirements.txt` and `npm audit` regularly.
- Pin versions in both `server/requirements.txt` and `frontend/package.json`.