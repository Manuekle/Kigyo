-- ═══════════════════════════════════════════════════════════════════════════
-- 68 — Tarifas de hotelería por temporada
--
-- La habitación tiene una tarifa base (`hotel_rooms.rate_cents`), pero un
-- hotel no cobra lo mismo en puente que en martes. Una temporada es un rango
-- de fechas con nombre — «Semana Santa», «Puente festivo», «Temporada
-- baja» — y una tarifa por tipo de habitación para ese rango.
--
-- La resolución vive en `public.hotel_rate_for`: dada una habitación y una
-- fecha, devuelve la tarifa de la temporada vigente para su tipo, o la base
-- si no hay ninguna. Es el mismo criterio que se usa al crear una reserva,
-- de modo que la tarifa sugerida en el formulario y la que cobra la pantalla
-- no pueden disentir.
--
-- Profundidad de `hoteleria` (patrón 45): permisos
-- `hoteleria:read` / `hoteleria:write`, sin módulo nuevo.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.hotel_seasons (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 2 and 80),
  starts_on  date not null,
  ends_on    date not null,
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index hotel_seasons_org_idx on public.hotel_seasons (org_id, starts_on);

create trigger hotel_seasons_touch before update on public.hotel_seasons
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('hotel_seasons', 'hoteleria:read', 'hoteleria:write');

comment on table public.hotel_seasons is
  'Temporadas del hotel: rangos de fechas con tarifas propias.';

create table public.hotel_season_rates (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references public.hotel_seasons (id) on delete cascade,
  -- El tipo de habitación, no la habitación: la tarifa de temporada es por
  -- categoría, igual que la base de la habitación.
  kind       text not null check (kind in ('Sencilla', 'Doble', 'Triple', 'Suite', 'Familiar')),
  rate_cents bigint not null default 0 check (rate_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, kind)
);

create index hotel_season_rates_season_idx on public.hotel_season_rates (season_id);

create trigger hotel_season_rates_touch before update on public.hotel_season_rates
  for each row execute function app.touch_updated_at();

select app.apply_child_rls('hotel_season_rates', 'hotel_seasons', 'season_id',
                           'hoteleria:read', 'hoteleria:write');

comment on table public.hotel_season_rates is
  'Tarifa por tipo de habitación dentro de una temporada.';

-- ─── Resolución de tarifa ──────────────────────────────────────────────────

create or replace function public.hotel_rate_for(p_room_id uuid, p_date date)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid;
  v_kind  text;
  v_base  bigint;
  v_rate  bigint;
begin
  select org_id, kind, rate_cents into v_org, v_kind, v_base
  from public.hotel_rooms
  where id = p_room_id and deleted_at is null;

  if v_org is null then
    return null;
  end if;

  if not exists (
    select 1 from public.memberships m
    join public.role_permissions rp on rp.org_id = m.org_id and rp.role = m.role
    where m.user_id = (select auth.uid())
      and m.org_id = v_org
      and rp.permission = 'hoteleria:read'
  ) then
    raise exception 'sin permiso sobre esa organización';
  end if;

  select sr.rate_cents into v_rate
  from public.hotel_season_rates sr
  join public.hotel_seasons s on s.id = sr.season_id
  where s.org_id = v_org
    and sr.kind = v_kind
    and p_date between s.starts_on and s.ends_on
  order by s.starts_on, s.created_at
  limit 1;

  return coalesce(v_rate, v_base);
end;
$$;

revoke all on function public.hotel_rate_for(uuid, date) from public, anon;
grant execute on function public.hotel_rate_for(uuid, date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.hotel_rate_for(uuid, date);
--   drop table if exists public.hotel_season_rates cascade;
--   drop table if exists public.hotel_seasons cascade;
-- ═══════════════════════════════════════════════════════════════════════════
