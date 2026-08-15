-- ═══════════════════════════════════════════════════════════════════════════
-- 76 — Etapas de pipeline para cotizaciones (plan CRM/ERP/POS 1.2)
--
-- La oportunidad y la cotización son la misma cosa en una pyme, con dos
-- nombres. En vez de una tabla `opportunities` duplicada, la cotización gana
-- una etapa: el estado del documento (Borrador/Enviada/…) sigue siendo del
-- documento, y la etapa pasa a ser el estado del *trato* — dos preguntas que
-- hasta ahora se contestaban mal juntas.
--
-- Las etapas son datos por empresa, sembradas con cuatro por defecto
-- (Prospección, Propuesta, Negociación, Cerrado) y editables/borrables desde
-- la pantalla. Un quote sin etapa es legítimo: las cotizaciones creadas antes
-- de este módulo no se les inventa una etapa.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.pipeline_stages (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 2 and 40),
  position   int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);

create index pipeline_stages_org_idx on public.pipeline_stages (org_id, position);

create trigger pipeline_stages_touch before update on public.pipeline_stages
  for each row execute function app.touch_updated_at();

comment on table public.pipeline_stages is
  'Etapas del pipeline de ventas, por empresa. El estado del trato, no del documento.';

select app.apply_standard_rls('pipeline_stages', 'cotizaciones:read', 'cotizaciones:write');

/**
 * Siembra las cuatro etapas por defecto si la empresa no tiene ninguna.
 *
 * Idempotente, como seed_default_roles: re-ejecutarla no duplica. Se llama
 * desde provision_company y desde el botón «Restablecer etapas» de la UI
 * (ese sí re-siembra incluso cuando la empresa borró algunas: primero
 * reactiva/de-vuelve las que existan por nombre y añade las faltantes).
 */
create or replace function app.seed_pipeline_stages(p_org_id uuid, p_reset boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_reset then
    insert into public.pipeline_stages (org_id, name, position, is_active)
    values
      (p_org_id, 'Prospección', 10, true),
      (p_org_id, 'Propuesta',   20, true),
      (p_org_id, 'Negociación', 30, true),
      (p_org_id, 'Cerrado',     40, true)
    on conflict (org_id, name) do update
      set position = excluded.position, is_active = true;
    return;
  end if;

  if not exists (
    select 1 from public.pipeline_stages where org_id = p_org_id
  ) then
    insert into public.pipeline_stages (org_id, name, position, is_active)
    values
      (p_org_id, 'Prospección', 10, true),
      (p_org_id, 'Propuesta',   20, true),
      (p_org_id, 'Negociación', 30, true),
      (p_org_id, 'Cerrado',     40, true);
  end if;
end;
$$;

revoke all on function app.seed_pipeline_stages(uuid, boolean) from public, anon, authenticated;

-- provision_company siembra también las etapas, junto a los roles.
create or replace function app.provision_company(
  p_account_id uuid,
  p_name       text,
  p_sector     text,
  p_user_id    uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug     text;
  v_slug_try text;
  v_sector   text := nullif(btrim(p_sector), '');
  v_org_id   uuid;
  n          int := 0;
begin
  if v_sector is not null and not exists (
    select 1 from public.sectors s
    where s.key = v_sector and s.parent_key is null and s.is_active
  ) then
    v_sector := null;
  end if;

  v_slug := app.slugify(p_name);
  v_slug_try := v_slug;
  while exists (select 1 from public.organizations o where o.slug = v_slug_try) loop
    n := n + 1;
    v_slug_try := v_slug || '-' || n::text;
  end loop;

  insert into public.organizations (name, slug, company_type, account_id)
  values (btrim(p_name), v_slug_try, v_sector, p_account_id)
  returning id into v_org_id;

  perform app.seed_default_roles(v_org_id);
  perform app.seed_pipeline_stages(v_org_id);

  insert into public.memberships (org_id, user_id, role)
  values (v_org_id, p_user_id, 'Administrador');

  perform app.seed_default_permissions(v_org_id);

  return v_org_id;
end;
$$;

revoke all on function app.provision_company(uuid, text, text, uuid) from public, anon, authenticated;

-- ─── La cotización apunta a una etapa ───────────────────────────────────────

alter table public.quotes
  add column stage_id uuid references public.pipeline_stages (id) on delete set null;

create index quotes_stage_idx on public.quotes (stage_id) where deleted_at is null;

/**
 * La etapa debe ser de la misma empresa que la cotización.
 *
 * Mismo hueco que las actividades de leads: el FK valida que la etapa exista
 * en algún lado, no que sea la de esta empresa.
 */
create or replace function app.guard_quote_stage_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage_id is not null and not exists (
    select 1 from public.pipeline_stages s
    where s.id = new.stage_id and s.org_id = new.org_id
  ) then
    raise exception 'la etapa debe pertenecer a la misma empresa que la cotización'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger quotes_guard_stage_org
  before insert or update of stage_id, org_id on public.quotes
  for each row execute function app.guard_quote_stage_org();

/**
 * El botón de la UI: re-siembra las etapas por defecto.
 * Autorización: cotizaciones:write, igual que mover una etapa.
 */
create or replace function public.reset_pipeline_stages()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para continuar.' using errcode = 'insufficient_privilege';
  end if;

  perform app.seed_pipeline_stages(org, true)
  from (select app.orgs_with('cotizaciones:write') as org) t;

  return true;
end;
$$;

revoke all on function public.reset_pipeline_stages() from public, anon;
grant execute on function public.reset_pipeline_stages() to authenticated;

-- Empresas existentes reciben sus etapas.
select app.seed_pipeline_stages(o.id) from public.organizations o;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.reset_pipeline_stages();
--   drop trigger if exists quotes_guard_stage_org on public.quotes;
--   drop function if exists app.guard_quote_stage_org();
--   alter table public.quotes drop column if exists stage_id;
--   -- y volver a crear app.provision_company sin el seed de etapas
--   drop function if exists app.seed_pipeline_stages(uuid, boolean);
--   drop table if exists public.pipeline_stages;
-- ═══════════════════════════════════════════════════════════════════════════
