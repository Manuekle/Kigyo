-- ═══════════════════════════════════════════════════════════════════════════
-- 06 — Rate limiting.
--
-- The previous implementation kept counters in a JS `Map`, which resets on
-- every cold start and is not shared between instances — so on a serverless
-- host it limited nothing. Postgres is already a required dependency, so the
-- counters live here rather than pulling in a second datastore.
-- ═══════════════════════════════════════════════════════════════════════════

create table app.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (bucket, window_start)
);

create index rate_limits_gc_idx on app.rate_limits (window_start);

-- Fixed-window counter. Returns whether the call is allowed, how many attempts
-- remain, and when the window resets so the caller can send Retry-After.
--
-- Lives in `public` rather than `app` because PostgREST only exposes functions
-- from the configured schemas, and `rpc()` must be able to reach it. Access is
-- restricted to service_role below, so being reachable is not being callable.
create or replace function public.rate_limit_hit(
  p_bucket        text,
  p_limit         int,
  p_window_secs   int
)
returns table (allowed boolean, remaining int, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_hits         int;
begin
  if p_limit <= 0 or p_window_secs <= 0 then
    raise exception 'rate_limit_hit: limit and window must be positive';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_secs) * p_window_secs
  );

  insert into app.rate_limits as rl (bucket, window_start, hits)
  values (p_bucket, v_window_start, 1)
  on conflict (bucket, window_start)
    do update set hits = rl.hits + 1
  returning rl.hits into v_hits;

  return query select
    v_hits <= p_limit,
    greatest(p_limit - v_hits, 0),
    v_window_start + make_interval(secs => p_window_secs);
end;
$$;

revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- The table is only ever touched through the SECURITY DEFINER function above.
alter table app.rate_limits enable row level security;
alter table app.rate_limits force  row level security;

-- Housekeeping. Call from a scheduled job (pg_cron, or a Vercel cron hitting
-- an admin route) — the table is otherwise append-only and grows unbounded.
create or replace function public.rate_limit_gc(p_older_than interval default '1 day')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted bigint;
begin
  delete from app.rate_limits where window_start < now() - p_older_than;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.rate_limit_gc(interval) from public, anon, authenticated;
grant execute on function public.rate_limit_gc(interval) to service_role;
