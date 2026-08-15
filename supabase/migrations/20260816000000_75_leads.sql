-- ═══════════════════════════════════════════════════════════════════════════
-- 75 — Leads: prospectos antes de ser clientes (plan CRM/ERP/POS 1.1)
--
-- El pipeline de Kigyo empezaba en `clientes` y en `cotizaciones`: todo lo
-- que pasaba antes (el prospecto, su origen, las llamadas) vivía en una
-- hoja de cálculo ajena o no vivía. Un lead es eso: la fase del trato en la
-- que todavía no hay trato.
--
-- Diseño deliberado:
--   · `owner_id` referencia `employees`, como `quotes.owner_id` — el dueño
--     comercial es una persona de la nómina, no una membresía.
--   · La conversión es un RPC (`leads_convert`), no dos statements desde el
--     navegador: el cliente nace y el lead queda Convertido en la misma
--     transacción, o no pasa nada. Unidireccional y con referencia al
--     cliente creado, nunca al revés.
--   · `trazabilidad` registra la conversión si el módulo está activo — el
--     trigger de auditoría ya existe y no aprende nada nuevo.
--
-- El módulo se propone en los seis sectores que venden (comercio, servicios,
-- tecnologia, inmobiliario, medios, financiero) y en ningún otro: un lead es
-- la prehistoria de un cliente, y quien no vende no la tiene.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  name          text not null check (length(btrim(name)) between 2 and 160),
  company_name  text not null default '',
  email         text not null default '',
  phone         text not null default '',
  source        text not null default 'Otro'
                  check (source in ('Referido', 'Web', 'Campaña', 'Llamada', 'Otro')),
  stage         text not null default 'Nuevo'
                  check (stage in ('Nuevo', 'Contactado', 'Calificado', 'Perdido', 'Convertido')),
  owner_id      uuid references public.employees (id) on delete set null,
  lost_reason   text not null default '',
  notes         text not null default '',
  converted_client_id uuid references public.clients (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index leads_org_stage_idx on public.leads (org_id, stage) where deleted_at is null;

create trigger leads_touch before update on public.leads
  for each row execute function app.touch_updated_at();

comment on table public.leads is
  'Prospectos y su etapa. Convertir un lead crea un cliente y deja la referencia.';

create table public.lead_activities (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  lead_id     uuid not null references public.leads (id) on delete cascade,
  kind        text not null default 'Nota'
                check (kind in ('Llamada', 'Correo', 'Nota', 'Agenda')),
  note        text not null check (length(btrim(note)) between 1 and 2000),
  occurred_at timestamptz not null default now()
);

create index lead_activities_lead_idx on public.lead_activities (lead_id, occurred_at desc);

comment on table public.lead_activities is
  'El historial del lead: llamadas, correos, notas y agenda.';

select app.apply_standard_rls('leads', 'leads:read', 'leads:write');
select app.apply_standard_rls('lead_activities', 'leads:read', 'leads:write');

/**
 * Una actividad pertenece a la empresa del lead al que apunta.
 *
 * La RLS mira el `org_id` de la fila nueva, y nada impide que un cliente
 * mienta sobre él: con `org_id` propio y `lead_id` de otra empresa, la fila
 * pasaría todos los checks y no aparecería en ninguna pantalla. El trigger
 * cierra eso en la base, que es donde los checks valen.
 */
create or replace function app.guard_lead_activity_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.leads l
    where l.id = new.lead_id and l.org_id = new.org_id and l.deleted_at is null
  ) then
    raise exception 'la actividad debe pertenecer a un lead de la misma empresa'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger lead_activities_guard_org
  before insert or update of lead_id, org_id on public.lead_activities
  for each row execute function app.guard_lead_activity_org();

-- ─── Conversión: el cliente nace y el lead queda Convertido ─────────────────

create or replace function public.leads_convert(p_lead_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead    public.leads%rowtype;
  v_client  uuid;
begin
  select * into v_lead
  from public.leads
  where id = p_lead_id and deleted_at is null;

  if v_lead.id is null then
    raise exception 'el lead no existe o no puedes verlo' using errcode = 'KG101';
  end if;

  if v_lead.stage = 'Convertido' then
    raise exception 'este lead ya fue convertido' using errcode = 'KG102';
  end if;

  if v_lead.converted_client_id is not null then
    raise exception 'este lead ya fue convertido' using errcode = 'KG102';
  end if;

  insert into public.clients (org_id, name, email, phone)
  values (
    v_lead.org_id,
    btrim(v_lead.name),
    nullif(lower(btrim(v_lead.email)), ''),
    btrim(v_lead.phone)
  )
  returning id into v_client;

  update public.leads
  set stage = 'Convertido', converted_client_id = v_client
  where id = p_lead_id;

  return v_client;
end;
$$;

revoke all on function public.leads_convert(uuid) from public, anon;
grant execute on function public.leads_convert(uuid) to authenticated;

-- ─── El catálogo reconoce el módulo nuevo ───────────────────────────────────

-- Los módulos que enabled_modules acepta. Espejo de SWITCHABLE en
-- src/lib/modules/registry.ts; registry.test.ts lo fija en ambos sentidos.
create or replace function app.valid_module_keys(keys text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select keys is null or not exists (
    select 1
    from unnest(keys) as k
    where k not in (
      'empleados', 'asistencia', 'nomina', 'riesgos',
      'reclutamiento', 'capacitacion', 'desempeno', 'proyectos',
      'hseq', 'inventario', 'mantenimiento', 'flota',
      'produccion', 'trazabilidad', 'clientes', 'cotizaciones',
      'leads', 'facturacion', 'compras', 'catalogos',
      'caja', 'pos', 'tienda', 'ecommerce',
      'canales', 'tickets', 'firmas', 'documentos',
      'contratos', 'calendario', 'consultoria', 'ia',
      'pacientes', 'estudiantes', 'restaurante', 'agro',
      'inmobiliario', 'hoteleria', 'socios', 'tiempos',
      'suscripciones', 'cartera', 'notificaciones', 'reportes',
      'creditos', 'donantes', 'suscriptores', 'puestos',
      'calidad', 'obra', 'ph', 'contratacion',
      'marketing', 'integraciones', 'portal'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('leads:read',  'leads', 'read',  'Ver leads'),
  ('leads:write', 'leads', 'write', 'Gestionar leads')
on conflict (key) do update set label = excluded.label;

-- Convertir exige el directorio de clientes, pero blando: un lead se registra
-- y se nutre aunque el módulo clientes esté apagado.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('leads', 'clientes', 'soft')
on conflict (module_key, requires_key) do update set kind = excluded.kind;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('leads:read'), ('leads:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── Los seis sectores que venden lo proponen ───────────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'comercio', k, 'add' from unnest(array['leads']) as k
union all
  select 'servicios', k, 'add' from unnest(array['leads']) as k
union all
  select 'tecnologia', k, 'add' from unnest(array['leads']) as k
union all
  select 'inmobiliario', k, 'add' from unnest(array['leads']) as k
union all
  select 'medios', k, 'add' from unnest(array['leads']) as k
union all
  select 'financiero', k, 'add' from unnest(array['leads']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'leads';
--   delete from public.role_permissions where permission like 'leads:%';
--   delete from public.permissions where module = 'leads';
--   delete from public.module_dependencies where module_key = 'leads';
--   drop function if exists public.leads_convert(uuid);
--   drop trigger if exists lead_activities_guard_org on public.lead_activities;
--   drop function if exists app.guard_lead_activity_org();
--   drop table if exists public.lead_activities;
--   drop table if exists public.leads;
--   -- y volver a crear app.valid_module_keys() sin 'leads'
-- ═══════════════════════════════════════════════════════════════════════════
