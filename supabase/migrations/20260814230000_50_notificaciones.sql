-- ═══════════════════════════════════════════════════════════════════════════
-- 50 — Notificaciones: reglas de recordatorio y bitácora de envíos
--
-- Un recordatorio es una regla («avisar N días antes de cada vencimiento de
-- factura») más una fila de bitácora cuando algo se envía. El motor de envío
-- (email, WhatsApp) llega con `integraciones`; esta migración deja las reglas
-- y el registro — lo que el cliente configura y lo que quiere poder auditar.
--
-- `kind` es el evento sobre el que la regla dispara. `cita` mira
-- `patient_appointments.scheduled_for`; `vencimiento` mira `invoices.due_on`;
-- `renovacion` mira `subscriptions.next_charge_on`. La consulta de próximos
-- recordatorios los une — ver queries/notificaciones.ts.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.notification_rules (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 80),
  kind        text not null check (kind in ('cita', 'vencimiento', 'renovacion')),
  days_before int  not null default 1 check (days_before between 0 and 90),
  channel     text not null default 'email' check (channel in ('email', 'whatsapp')),
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger notification_rules_touch before update on public.notification_rules
  for each row execute function app.touch_updated_at();

comment on table public.notification_rules is
  'Reglas de recordatorio: qué evento, con cuánta antelación y por qué canal. El módulo notificaciones.';

create table public.notification_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  rule_id     uuid references public.notification_rules (id) on delete set null,
  kind        text not null,
  recipient   text not null,
  channel     text not null,
  status      text not null default 'enviado' check (status in ('enviado', 'fallido')),
  sent_at     timestamptz not null default now(),
  error       text
);

create index notification_log_org_sent_idx on public.notification_log (org_id, sent_at desc);

comment on table public.notification_log is
  'Bitácora de recordatorios enviados o fallidos.';

select app.apply_standard_rls('notification_rules', 'notificaciones:read', 'notificaciones:write');
select app.apply_standard_rls('notification_log', 'notificaciones:read', 'notificaciones:write');

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
      'cartera', 'notificaciones'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('notificaciones:read',  'notificaciones', 'read',  'Ver recordatorios'),
  ('notificaciones:write', 'notificaciones', 'write', 'Gestionar recordatorios')
on conflict (key) do update set label = excluded.label;

-- Dependencias blandas: las reglas disparan sobre cosas que otros módulos
-- guardan. Ninguna bloquea el módulo.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('notificaciones', 'facturacion', 'soft'),
  ('notificaciones', 'calendario',  'soft')
on conflict (module_key, requires_key) do nothing;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('notificaciones:read'), ('notificaciones:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── Los sectores que viven de citas y vencimientos ─────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'salud', k, 'add' from unnest(array['notificaciones']) as k
  union all
  select 'educacion', k, 'add' from unnest(array['notificaciones']) as k
  union all
  select 'fitness-bienestar', k, 'add' from unnest(array['notificaciones']) as k
  union all
  select 'inmobiliario', k, 'add' from unnest(array['notificaciones']) as k
  union all
  select 'hoteleria', k, 'add' from unnest(array['notificaciones']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'notificaciones';
--   delete from public.module_dependencies where module_key = 'notificaciones';
--   delete from public.role_permissions where permission like 'notificaciones:%';
--   delete from public.permissions where module = 'notificaciones';
--   drop table if exists public.notification_log;
--   drop table if exists public.notification_rules;
--   -- y volver a crear app.valid_module_keys() sin 'notificaciones'
-- ═══════════════════════════════════════════════════════════════════════════
