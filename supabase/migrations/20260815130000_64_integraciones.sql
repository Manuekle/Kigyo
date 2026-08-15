-- ═══════════════════════════════════════════════════════════════════════════
-- 64 — Integraciones: pasarela de pagos y WhatsApp
--
-- La pantalla guarda la configuración de dos integraciones: la pasarela de
-- pagos (Wompi y otros) y WhatsApp Cloud API. La regla de diseño es la del
-- encargo: **los secretos viven en el vault, nunca en la tabla**. La tabla
-- `integration_settings` solo lleva lo público (proveedor, llave pública,
-- phone number id, habilitado); las llaves privadas, el token de WhatsApp y
-- el secreto del webhook se guardan en `vault.secrets` con el nombre
-- `integraciones.<org>.<kind>.<field>`.
--
-- El vault no se toca desde la aplicación directamente: PostgREST no expone
-- el esquema `vault`, así que aquí se definen tres RPC de puerta, otorgadas
-- SOLO a service_role (las server actions las llaman con el cliente admin).
-- Ningún usuario autenticado puede leer un secreto; el navegador solo ve
-- «hay llave guardada / no hay» a través de `integraciones_has_secret`, que
-- valida la pertenencia a la organización antes de responder.
--
-- Nótese que las funciones plpgsql referencian vault.* sin que el esquema
-- exista en una base de verificación: el cuerpo se valida en ejecución, no
-- en creación, de modo que db-verify sigue pasando.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.integration_settings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  kind       text not null check (kind in ('pagos', 'whatsapp')),
  provider   text not null default 'wompi'
             check (provider in ('wompi', 'payu', 'epayco', 'stripe', 'whatsapp', 'otro')),
  enabled    boolean not null default false,
  -- Solo lo público: la llave pública de la pasarela o el phone number id de
  -- WhatsApp. Todo lo que es secreto vive en el vault.
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (org_id, kind)
);

select app.apply_standard_rls('integration_settings', 'integraciones:read', 'integraciones:write');

comment on table public.integration_settings is
  'Configuración pública de integraciones. El módulo integraciones. Los secretos van al vault.';

-- ─── RPCs de puerta al vault (solo service_role) ────────────────────────────

-- Escribe (o actualiza) un secreto. El nombre queda dentro del namespace
-- `integraciones.` que este módulo es dueño; nada más se toca.
create or replace function public.integraciones_set_secret(
  p_name  text,
  p_value text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_name !~ '^integraciones\.[0-9a-f-]{36}\.(pagos|whatsapp)\.[a-z_]+$' then
    raise exception 'nombre de secreto fuera del namespace de integraciones';
  end if;

  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    perform vault.create_secret(p_value, p_name, 'kigyo integraciones');
  else
    perform vault.update_secret(v_id, p_value);
  end if;
end;
$$;

revoke all on function public.integraciones_set_secret(text, text) from public, anon, authenticated;
grant execute on function public.integraciones_set_secret(text, text) to service_role;

-- Lee un secreto. El único camino de salida del vault, y solo para el rol de
-- servicio: una server action lo usa para llamar al proveedor, y lo usa sin
-- devolvérselo nunca al navegador.
create or replace function public.integraciones_get_secret(
  p_name text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if p_name !~ '^integraciones\.[0-9a-f-]{36}\.(pagos|whatsapp)\.[a-z_]+$' then
    raise exception 'nombre de secreto fuera del namespace de integraciones';
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = p_name;
  return v_secret;
end;
$$;

revoke all on function public.integraciones_get_secret(text) from public, anon, authenticated;
grant execute on function public.integraciones_get_secret(text) to service_role;

-- ¿Hay secreto guardado? Lo único que el navegador puede preguntar, y solo
-- sobre su propia organización.
create or replace function public.integraciones_has_secret(
  p_org_id uuid,
  p_kind   text,
  p_field  text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.memberships m
    join public.role_permissions rp on rp.org_id = m.org_id and rp.role = m.role
    where m.user_id = (select auth.uid())
      and m.org_id = p_org_id
      and rp.permission = 'integraciones:read'
  ) then
    raise exception 'sin permiso sobre esa organización';
  end if;

  return exists (
    select 1 from vault.secrets
    where name = format('integraciones.%s.%s.%s', p_org_id, p_kind, p_field)
  );
end;
$$;

revoke all on function public.integraciones_has_secret(uuid, text, text) from public, anon;
grant execute on function public.integraciones_has_secret(uuid, text, text) to authenticated;

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
      'obra', 'ph', 'contratacion', 'portal', 'marketing',
      'integraciones'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('integraciones:read',  'integraciones', 'read',  'Ver integraciones'),
  ('integraciones:write', 'integraciones', 'write', 'Gestionar integraciones')
on conflict (key) do update set label = excluded.label;

-- Dependencias blandas: la pasarela cobra facturas y WhatsApp despacha las
-- campañas de marketing. Ninguna es obligatoria para configurar.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('integraciones', 'marketing', 'soft'),
  ('integraciones', 'facturacion', 'soft')
on conflict (module_key, requires_key) do nothing;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('integraciones:read'), ('integraciones:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- Sin filas de sector_modules a propósito: una integración es configuración
-- técnica que el administrador activa cuando la necesita, no parte del
-- arranque de ningún sector.

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.module_dependencies where module_key = 'integraciones';
--   delete from public.role_permissions where permission like 'integraciones:%';
--   delete from public.permissions where module = 'integraciones';
--   drop function if exists public.integraciones_has_secret(uuid, text, text);
--   drop function if exists public.integraciones_get_secret(text);
--   drop function if exists public.integraciones_set_secret(text, text);
--   drop table if exists public.integration_settings;
--   -- y volver a crear app.valid_module_keys() sin 'integraciones'
--   -- (los secretos del vault se quedan; son del org, no de la tabla)
-- ═══════════════════════════════════════════════════════════════════════════
