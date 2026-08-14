-- ═══════════════════════════════════════════════════════════════════════════
-- 52 — Créditos: colocación, cuotas y mora
--
-- Un préstamo es una fila; sus cuotas, otras. La mora no se guarda: se deriva
-- de cuotas vencidas sin pagar, porque guardarla sería una segunda verdad que
-- puede discrepar de la primera. El desembolso es el estado del préstamo.
--
-- Deliberadamente simple: interés fijo mensual, cuotas iguales. Modelos
-- decrecientes o variables llegan cuando una cooperativa real los pida.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.loans (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  client_id        uuid references public.clients (id) on delete set null,
  amount_cents     int  not null check (amount_cents > 0),
  interest_rate_bps int not null default 0 check (interest_rate_bps >= 0),
  term_months      int  not null check (term_months between 1 and 120),
  start_date       date not null default current_date,
  status           text not null default 'activo' check (status in ('activo', 'pagado', 'castigado')),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index loans_org_status_idx on public.loans (org_id, status);

create trigger loans_touch before update on public.loans
  for each row execute function app.touch_updated_at();

comment on table public.loans is
  'Préstamos: monto, tasa, plazo y estado. El módulo créditos.';

create table public.loan_installments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  loan_id      uuid not null references public.loans (id) on delete cascade,
  number       int  not null check (number between 1 and 120),
  due_date     date not null,
  amount_cents int  not null check (amount_cents > 0),
  status       text not null default 'pendiente' check (status in ('pendiente', 'pagada')),
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (loan_id, number)
);

create index loan_installments_org_due_idx on public.loan_installments (org_id, due_date);

create trigger loan_installments_touch before update on public.loan_installments
  for each row execute function app.touch_updated_at();

comment on table public.loan_installments is
  'Cuotas de un préstamo. La mora se deriva de las pendientes vencidas.';

select app.apply_standard_rls('loans', 'creditos:read', 'creditos:write');
select app.apply_standard_rls('loan_installments', 'creditos:read', 'creditos:write');

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
      'cartera', 'notificaciones', 'reportes', 'creditos'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('creditos:read',  'creditos', 'read',  'Ver créditos'),
  ('creditos:write', 'creditos', 'write', 'Gestionar créditos')
on conflict (key) do update set label = excluded.label;

-- Dependencias blandas.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('creditos', 'clientes', 'soft')
on conflict (module_key, requires_key) do nothing;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('creditos:read'), ('creditos:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── El sector que presta plata ─────────────────────────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'financiero', k, 'add' from unnest(array['creditos']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'creditos';
--   delete from public.module_dependencies where module_key = 'creditos';
--   delete from public.role_permissions where permission like 'creditos:%';
--   delete from public.permissions where module = 'creditos';
--   drop table if exists public.loan_installments;
--   drop table if exists public.loans;
--   -- y volver a crear app.valid_module_keys() sin 'creditos'
-- ═══════════════════════════════════════════════════════════════════════════
