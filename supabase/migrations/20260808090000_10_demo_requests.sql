-- ═══════════════════════════════════════════════════════════════════════════
-- 10 — Demo requests.
--
-- Inbound leads from the public contact form. Before this the form was a no-op:
-- it set a "mensaje enviado" state in React and threw the submission away, so
-- nobody ever learned that a demo had been asked for.
--
-- These rows are NOT tenant data — a lead has no organization yet, so there is
-- no `org_id` and none of the standard RLS machinery applies. Instead the table
-- is closed to every client role and reachable only with the service-role key,
-- the same posture as `app.rate_limits`. It lives in `public` rather than `app`
-- because PostgREST only exposes the configured schemas, and the route handler
-- reaches it through `.from()`.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.demo_requests (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 160),
  email       text not null check (length(btrim(email)) between 3 and 254),
  company     text check (company is null or length(btrim(company)) <= 120),
  message     text not null check (length(btrim(message)) between 10 and 2000),
  -- Where the lead came from, so a second entry point later (pricing page,
  -- in-app upsell) is distinguishable without a schema change.
  source      text not null default 'contacto',
  status      text not null default 'nuevo'
                check (status in ('nuevo', 'contactado', 'descartado')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger demo_requests_touch
  before update on public.demo_requests
  for each row execute function app.touch_updated_at();

-- Triage order for whoever works the queue, and a lookup by address so a repeat
-- request from the same person is easy to spot.
create index demo_requests_created_idx on public.demo_requests (created_at desc);
create index demo_requests_email_idx   on public.demo_requests (lower(email));

-- No policies, by design: with RLS on and nothing granted, every client role
-- fails closed and only service_role (which bypasses RLS) can read or write.
alter table public.demo_requests enable row level security;
alter table public.demo_requests force  row level security;

-- Migration 08 already granted DML on every public table to `authenticated`,
-- and its ALTER DEFAULT PRIVILEGES covers tables added later — so this one
-- arrives pre-granted and has to be clawed back explicitly. RLS would block the
-- rows anyway; revoking as well means a future policy added by mistake cannot
-- open a table that was never meant to face clients.
revoke all on public.demo_requests from anon, authenticated;
grant  all on public.demo_requests to   service_role;
