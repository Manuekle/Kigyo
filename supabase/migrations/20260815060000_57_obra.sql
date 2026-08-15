-- ═══════════════════════════════════════════════════════════════════════════
-- 57 — Obra: presupuestos, capítulos, APU y avance
--
-- El presupuesto es el contrato del costo; el capítulo es cómo la obra lo
-- descompone (cimentación, estructura, acabados…) y donde se mide el avance;
-- el APU es el análisis de precio unitario de una partida (materiales, mano
-- de obra, equipo y transporte); el avance es el corte periódico de cuánto
-- se ha ejecutado de un capítulo.
--
-- Los valores son numeric(14,2) sin moneda: el sistema no factura, solo
-- presupuesta, y la moneda es la del país de la cuenta.
--
-- `client` es texto libre, no FK a clientes: el módulo funciona sin el
-- directorio comercial (dependencia blanda) y el nombre del cliente de un
-- presupuesto histórico no debe desaparecer si la cuenta se borra.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.obra_presupuestos (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,
  name                text not null check (length(btrim(name)) between 2 and 120),
  client              text,
  estado              text not null default 'borrador'
                      check (estado in ('borrador', 'aprobado', 'en_ejecucion', 'cerrado')),
  valor_presupuestado numeric(14,2) not null default 0 check (valor_presupuestado >= 0),
  valor_ejecutado     numeric(14,2) not null default 0 check (valor_ejecutado >= 0),
  fecha_inicio        date,
  fecha_fin           date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);

create index obra_presupuestos_org_estado_idx on public.obra_presupuestos (org_id, estado);

create trigger obra_presupuestos_touch before update on public.obra_presupuestos
  for each row execute function app.touch_updated_at();

comment on table public.obra_presupuestos is
  'Presupuestos de obra con estado y valores. El módulo obra.';

create table public.obra_capitulos (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,
  presupuesto_id      uuid not null references public.obra_presupuestos (id) on delete cascade,
  name                text not null check (length(btrim(name)) between 2 and 120),
  orden               int not null default 0,
  valor_presupuestado numeric(14,2) not null default 0 check (valor_presupuestado >= 0),
  valor_ejecutado     numeric(14,2) not null default 0 check (valor_ejecutado >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index obra_capitulos_presupuesto_idx on public.obra_capitulos (presupuesto_id, orden);
create index obra_capitulos_org_idx on public.obra_capitulos (org_id);

create trigger obra_capitulos_touch before update on public.obra_capitulos
  for each row execute function app.touch_updated_at();

comment on table public.obra_capitulos is
  'Capítulos de un presupuesto de obra: la descomposición donde se mide el avance.';

create table public.obra_apu (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  capitulo_id  uuid not null references public.obra_capitulos (id) on delete cascade,
  name         text not null check (length(btrim(name)) between 2 and 160),
  unidad       text not null default 'und' check (length(btrim(unidad)) between 1 and 20),
  cantidad     numeric(14,2) not null default 1 check (cantidad > 0),
  materiales   numeric(14,2) not null default 0 check (materiales >= 0),
  mano_obra    numeric(14,2) not null default 0 check (mano_obra >= 0),
  equipo       numeric(14,2) not null default 0 check (equipo >= 0),
  transporte   numeric(14,2) not null default 0 check (transporte >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index obra_apu_capitulo_idx on public.obra_apu (capitulo_id);
create index obra_apu_org_idx on public.obra_apu (org_id);

create trigger obra_apu_touch before update on public.obra_apu
  for each row execute function app.touch_updated_at();

comment on table public.obra_apu is
  'Análisis de precios unitarios: partidas con sus componentes de costo.';

create table public.obra_avances (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  capitulo_id uuid not null references public.obra_capitulos (id) on delete cascade,
  fecha       date not null default current_date,
  avance      numeric(5,2) not null check (avance between 0 and 100),
  valor       numeric(14,2) not null default 0 check (valor >= 0),
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index obra_avances_capitulo_fecha_idx on public.obra_avances (capitulo_id, fecha desc);
create index obra_avances_org_idx on public.obra_avances (org_id);

create trigger obra_avances_touch before update on public.obra_avances
  for each row execute function app.touch_updated_at();

comment on table public.obra_avances is
  'Cortes de avance por capítulo: porcentaje y valor ejecutado a la fecha.';

select app.apply_standard_rls('obra_presupuestos', 'obra:read', 'obra:write');
select app.apply_standard_rls('obra_capitulos', 'obra:read', 'obra:write');
select app.apply_standard_rls('obra_apu', 'obra:read', 'obra:write');
select app.apply_standard_rls('obra_avances', 'obra:read', 'obra:write');

-- ─── El avance escribe tres lugares y debe hacerlo en uno solo ─────────────

-- Registrar un avance actualiza el capítulo (su último corte ES su ejecutado)
-- y el presupuesto (la suma de sus capítulos). Un trigger no alcanza: el
-- insert del avance sabe del capítulo, pero la suma necesita mirar a los
-- hermanos. Funciones `security invoker` para que RLS siga mandando.
create or replace function public.obra_register_avance(
  p_capitulo_id uuid,
  p_fecha date,
  p_avance numeric,
  p_valor numeric,
  p_notas text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_presupuesto uuid;
  v_id uuid;
begin
  select org_id, presupuesto_id into v_org, v_presupuesto
  from public.obra_capitulos where id = p_capitulo_id;

  if not found then
    raise exception 'capitulo no encontrado';
  end if;

  insert into public.obra_avances (org_id, capitulo_id, fecha, avance, valor, notas)
  values (v_org, p_capitulo_id, p_fecha, p_avance, p_valor, p_notas)
  returning id into v_id;

  update public.obra_capitulos set valor_ejecutado = p_valor
  where id = p_capitulo_id;

  update public.obra_presupuestos
  set valor_ejecutado = (
    select coalesce(sum(valor_ejecutado), 0)
    from public.obra_capitulos
    where presupuesto_id = v_presupuesto
  )
  where id = v_presupuesto;

  return v_id;
end;
$$;

-- Borrar un avance deja al capítulo con su último corte restante (o cero) y
-- resincroniza el presupuesto.
create or replace function public.obra_delete_avance(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_capitulo uuid;
  v_presupuesto uuid;
begin
  select c.id, c.presupuesto_id into v_capitulo, v_presupuesto
  from public.obra_avances a
  join public.obra_capitulos c on c.id = a.capitulo_id
  where a.id = p_id;

  if not found then
    return;
  end if;

  delete from public.obra_avances where id = p_id;

  update public.obra_capitulos
  set valor_ejecutado = coalesce((
    select a.valor
    from public.obra_avances a
    where a.capitulo_id = v_capitulo
    order by a.fecha desc, a.created_at desc
    limit 1
  ), 0)
  where id = v_capitulo;

  update public.obra_presupuestos
  set valor_ejecutado = (
    select coalesce(sum(valor_ejecutado), 0)
    from public.obra_capitulos
    where presupuesto_id = v_presupuesto
  )
  where id = v_presupuesto;
end;
$$;

-- Tras borrar un capítulo (o editar sus valores), el presupuesto vuelve a
-- sumar. Una sola función para los tres caminos.
create or replace function public.obra_resync_presupuesto(p_presupuesto_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.obra_presupuestos
  set valor_ejecutado = (
    select coalesce(sum(valor_ejecutado), 0)
    from public.obra_capitulos
    where presupuesto_id = p_presupuesto_id
  )
  where id = p_presupuesto_id;
end;
$$;

revoke all on function public.obra_register_avance(uuid, date, numeric, numeric, text) from public, anon;
grant execute on function public.obra_register_avance(uuid, date, numeric, numeric, text) to authenticated;
revoke all on function public.obra_delete_avance(uuid) from public, anon;
grant execute on function public.obra_delete_avance(uuid) to authenticated;
revoke all on function public.obra_resync_presupuesto(uuid) from public, anon;
grant execute on function public.obra_resync_presupuesto(uuid) to authenticated;

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
      'obra'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('obra:read',  'obra', 'read',  'Ver presupuestos de obra'),
  ('obra:write', 'obra', 'write', 'Gestionar presupuestos de obra')
on conflict (key) do update set label = excluded.label;

-- Dependencias blandas.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('obra', 'proyectos', 'soft'),
  ('obra', 'clientes',  'soft')
on conflict (module_key, requires_key) do nothing;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('obra:read'), ('obra:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── Los sectores que presupuestan obra ─────────────────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'construccion', k, 'add' from unnest(array['obra']) as k
  union all
  select 'energia', k, 'add' from unnest(array['obra']) as k
  union all
  select 'mineria', k, 'add' from unnest(array['obra']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.obra_register_avance(uuid, date, numeric, numeric, text);
--   drop function if exists public.obra_delete_avance(uuid);
--   drop function if exists public.obra_resync_presupuesto(uuid);
--   delete from public.sector_modules where module_key = 'obra';
--   delete from public.module_dependencies where module_key = 'obra';
--   delete from public.role_permissions where permission like 'obra:%';
--   delete from public.permissions where module = 'obra';
--   drop table if exists public.obra_avances;
--   drop table if exists public.obra_apu;
--   drop table if exists public.obra_capitulos;
--   drop table if exists public.obra_presupuestos;
--   -- y volver a crear app.valid_module_keys() sin 'obra'
-- ═══════════════════════════════════════════════════════════════════════════
