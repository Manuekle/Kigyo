-- ═══════════════════════════════════════════════════════════════════════════
-- 63 — Marketing: campañas y fidelización
--
-- Una campaña es la pieza de comunicación a los clientes: qué se dice, por qué
-- canal y a quién. El envío real llega con el módulo `integraciones`
-- (WhatsApp/pasarela); aquí la campaña compone la pieza y arma la lista de
-- destinatarios desde el directorio de clientes, de modo que la integración
-- solo tenga que tomar `marketing_recipients` pendientes y enviar. Separar la
-- composición del transporte es lo que permite que una campaña por WhatsApp y
-- una por correo sean la misma fila con otro canal.
--
-- La fidelización es un libro de puntos por cliente: movimientos con signo
-- (positivo por compra, negativo por redención) y motivo obligatorio. El saldo
-- es la suma del libro; no se guarda aparte porque un saldo guardado es un
-- saldo que puede disentir del libro que lo produjo.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.marketing_campaigns (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  name           text not null check (length(btrim(name)) between 2 and 120),
  channel        text not null default 'whatsapp'
                 check (channel in ('whatsapp', 'email', 'sms', 'otro')),
  message        text not null default '' check (length(message) <= 1000),
  status         text not null default 'borrador'
                 check (status in ('borrador', 'programada', 'enviada', 'cancelada')),
  scheduled_for  timestamptz,
  sent_at        timestamptz,
  audience_count int not null default 0 check (audience_count >= 0),
  sent_count     int not null default 0 check (sent_count >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (sent_at is null or sent_at >= created_at)
);

create index marketing_campaigns_org_idx
  on public.marketing_campaigns (org_id, created_at desc);

create trigger marketing_campaigns_touch before update on public.marketing_campaigns
  for each row execute function app.touch_updated_at();

comment on table public.marketing_campaigns is
  'Campañas de comunicación a clientes, por canal. El módulo marketing.';

create table public.marketing_recipients (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.marketing_campaigns (id) on delete cascade,
  client_id       uuid references public.clients (id) on delete set null,
  -- El snapshot del contacto al momento de armar la lista: si el cliente se
  -- borra o cambia de teléfono, la lista ya generada no debe cambiar sola.
  contact_name    text not null default '',
  contact_address text not null default '',
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index marketing_recipients_campaign_idx
  on public.marketing_recipients (campaign_id, created_at);

select app.apply_child_rls('marketing_recipients', 'marketing_campaigns', 'campaign_id',
                           'marketing:read', 'marketing:write');

comment on table public.marketing_recipients is
  'Destinatarios de una campaña: quién recibe qué y si ya se le envió.';

create table public.loyalty_points (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  points     int not null check (points <> 0),
  reason     text not null check (length(btrim(reason)) between 2 and 200),
  created_by uuid,
  created_at timestamptz not null default now()
);

create index loyalty_points_org_client_idx on public.loyalty_points (org_id, client_id, created_at desc);

select app.apply_standard_rls('loyalty_points', 'marketing:read', 'marketing:write');

comment on table public.loyalty_points is
  'Libro de puntos de fidelización por cliente. El saldo es la suma del libro.';

select app.apply_standard_rls('marketing_campaigns', 'marketing:read', 'marketing:write');

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
      'facturacion', 'compras', 'catalogos', 'caja',
      'pos', 'tienda', 'ecommerce', 'canales',
      'tickets', 'firmas', 'documentos', 'contratos',
      'calendario', 'consultoria', 'ia', 'pacientes',
      'estudiantes', 'restaurante', 'agro', 'inmobiliario',
      'hoteleria', 'socios', 'tiempos', 'suscripciones',
      'cartera', 'notificaciones', 'reportes', 'creditos',
      'donantes', 'suscriptores', 'puestos', 'calidad',
      'obra', 'ph', 'contratacion', 'portal', 'marketing'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('marketing:read',  'marketing', 'read',  'Ver campañas y fidelización'),
  ('marketing:write', 'marketing', 'write', 'Gestionar campañas y fidelización')
on conflict (key) do update set label = excluded.label;

-- Dependencia blanda: campañas sin directorio de clientes es un formulario
-- que no puede armar lista; con él, es la herramienta completa.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('marketing', 'clientes', 'soft')
on conflict (module_key, requires_key) do nothing;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('marketing:read'), ('marketing:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── Transversal: todos los sectores lo proponen ────────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'construccion', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'energia', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'manufactura', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'comercio', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'ecommerce', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'servicios', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'tecnologia', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'salud', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'educacion', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'logistica', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'alimentos', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'agro', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'inmobiliario', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'hoteleria', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'financiero', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'mineria', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'telecomunicaciones', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'seguridad', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'medios', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'ong', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'gobierno', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'otro', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'fitness-bienestar', k, 'add' from unnest(array['marketing']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'marketing';
--   delete from public.module_dependencies where module_key = 'marketing';
--   delete from public.role_permissions where permission like 'marketing:%';
--   delete from public.permissions where module = 'marketing';
--   drop table if exists public.loyalty_points;
--   drop table if exists public.marketing_recipients;
--   drop table if exists public.marketing_campaigns;
--   -- y volver a crear app.valid_module_keys() sin 'marketing'
-- ═══════════════════════════════════════════════════════════════════════════
