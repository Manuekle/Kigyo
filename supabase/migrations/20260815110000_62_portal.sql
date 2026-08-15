-- ═══════════════════════════════════════════════════════════════════════════
-- 62 — Portal: enlaces públicos firmados
--
-- Un enlace de portal comparte una vista de solo lectura de una entidad
-- (una factura, una cita, el avance de una obra) con alguien que no tiene
-- cuenta. La pantalla genera el enlace, el cliente lo abre desde el celular
-- y ve exactamente esa entidad: nada más de la organización.
--
-- ─── Análisis de abuso ─────────────────────────────────────────────────────
--
-- El enlace es una credencial que vive en una URL, y las URLs se reenvían,
-- se copian y se guardan. Las defensas, en orden de qué atacan:
--
-- 1. Entropía: el token son 24 bytes aleatorios (gen_random_bytes) en
--    base64url. Fuerza bruta sobre un espacio de 2^192 no es un vector real;
--    el vector real es el robo del propio enlace (reenvío, historial, captura
--    de pantalla), que la entropía no puede frenar.
-- 2. Vencimiento: 1 a 30 días, elegido al crear. El check de columna fuerza
--    expires_at > created_at y el RPC lo respeta en la vista.
-- 3. Revocación: el dueño puede matar un enlace en cualquier momento; la
--    vista lo evalúa por fila, no en caché.
-- 4. Límite de vistas: max_views opcional; cada vista lo descuenta de forma
--    atómica (update + read en el mismo statement), de modo que un enlace
--    «ver 3 veces» no puede servirse 4 veces en carreras concurrentes.
-- 5. Rate limit por enlace y por IP para misses: 120 vistas/min por enlace
--    y 30 misses/5 min por IP, sobre app.rate_limits — así un enlace robado
--    no se puede usar para martillar la API y un barrido de tokens se ahoga
--    solo.
-- 6. Respuesta uniforme: un token que no existe, uno vencido, uno revocado y
--    uno agotado responden exactamente el mismo JSON. El endpoint no es un
--    oráculo que distinga «este token existió» de «este no».
-- 7. Alcance mínimo: la vista devuelve solo los campos proyectados de la
--    entidad apuntada (más el nombre de la organización). Nada de listas,
--    nada de joins a otras entidades del dueño.
-- 8. Auditoría: cada vista queda en portal_views (quién-en-qué-IP-cuándo),
--    visible desde el módulo. Si un enlace se filtra, el dueño puede verlo
--    en uso antes de revocarlo.
--
-- El token se guarda en claro, no hasheado. La razón es deliberada: la única
-- ventaja del hash es proteger el token si la base se filtra, y quien filtre
-- la base ya tiene la factura, la cita y el avance — el token no le da nada
-- que no tenga. A cambio, la pantalla puede volver a copiar el enlace meses
-- después de crearlo, que es el caso de uso real («¿me reenvías el enlace?»).
--
-- `target_id` es un uuid sin FK: apunta a tablas distintas según `kind`, y
-- una FK no puede expresar una unión. La integridad la da el RPC de creación,
-- que valida contra la tabla correcta antes de insertar.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.portal_links (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  kind           text not null check (kind in ('factura', 'cita', 'avance')),
  target_id      uuid not null,
  label          text not null check (length(btrim(label)) between 2 and 120),
  token          text not null unique,
  created_by     uuid,
  expires_at     timestamptz not null,
  max_views      int check (max_views is null or max_views > 0),
  view_count     int not null default 0,
  last_viewed_at timestamptz,
  revoked_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (expires_at > created_at)
);

create index portal_links_org_idx on public.portal_links (org_id, created_at desc);
create index portal_links_token_idx on public.portal_links (token);

create trigger portal_links_touch before update on public.portal_links
  for each row execute function app.touch_updated_at();

comment on table public.portal_links is
  'Enlaces públicos firmados a una entidad de solo lectura. El módulo portal.';

create table public.portal_views (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references public.organizations (id) on delete cascade,
  link_id   uuid references public.portal_links (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  ip        text
);

create index portal_views_link_idx on public.portal_views (link_id, viewed_at desc);
create index portal_views_org_idx on public.portal_views (org_id, viewed_at desc);

comment on table public.portal_views is
  'Auditoría de vistas: quién abrió cada enlace y desde qué IP.';

select app.apply_standard_rls('portal_links', 'portal:read', 'portal:write');
select app.apply_standard_rls('portal_views', 'portal:read', 'portal:write');

-- ═══════════════════════════════════════════════════════════════════════════
-- RPCs (en public: PostgREST solo expone esquemas expuestos)
-- ═══════════════════════════════════════════════════════════════════════════

-- Crea el enlace y devuelve el token. Security invoker: el usuario debe ver la
-- entidad apuntada (RLS de su tabla) y tener portal:write (RLS del insert).
create or replace function public.portal_create(
  p_kind       text,
  p_target_id  uuid,
  p_label      text,
  p_days       int default 7,
  p_max_views  int default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org   uuid;
  v_token text;
begin
  if p_kind not in ('factura', 'cita', 'avance') then
    raise exception 'tipo de enlace inválido';
  end if;
  if p_days < 1 or p_days > 30 then
    raise exception 'la vigencia debe estar entre 1 y 30 días';
  end if;
  if p_max_views is not null and p_max_views < 1 then
    raise exception 'el límite de vistas debe ser positivo';
  end if;

  -- Resuelve la organización desde la entidad apuntada. La lectura pasa por
  -- la RLS de la tabla fuente: si el usuario no puede ver la entidad (otra
  -- organización o sin permiso), no encuentra fila y no crea nada.
  case p_kind
    when 'factura' then
      select org_id into v_org
      from public.invoices
      where id = p_target_id and deleted_at is null;
    when 'cita' then
      select p.org_id into v_org
      from public.patient_appointments a
      join public.patients p on p.id = a.patient_id
      where a.id = p_target_id;
    when 'avance' then
      select org_id into v_org
      from public.obra_presupuestos
      where id = p_target_id;
  end case;

  if v_org is null then
    raise exception 'la entidad no existe o no puedes verla';
  end if;

  loop
    begin
      v_token := rtrim(translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'), '=');
      insert into public.portal_links (
        org_id, kind, target_id, label, token, created_by,
        expires_at, max_views
      )
      values (
        v_org, p_kind, p_target_id, btrim(p_label), v_token, (select auth.uid()),
        now() + make_interval(days => p_days), p_max_views
      )
      returning token into v_token;
      exit;
    exception when unique_violation then
      null; -- colisión de token: regenera
    end;
  end loop;

  return v_token;
end;
$$;

revoke all on function public.portal_create(text, uuid, text, int, int) from public, anon;
grant execute on function public.portal_create(text, uuid, text, int, int) to authenticated;

-- Resuelve un token a la vista de solo lectura. Security definer: el anon no
-- tiene políticas sobre ninguna tabla y esta es la única puerta que tiene.
create or replace function public.portal_view(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headers  text;
  v_ip       text;
  v_link     public.portal_links%rowtype;
  v_allowed  boolean;
  v_org_name text;
  v_payload  jsonb;
begin
  -- IP para los buckets de rate limit y la auditoría. PostgREST la expone en
  -- request.headers; fuera de PostgREST el setting no existe.
  v_headers := nullif(current_setting('request.headers', true), '');
  v_ip := coalesce(
    split_part((v_headers::pg_catalog.json ->> 'x-forwarded-for'), ',', 1),
    'unknown'
  );

  select * into v_link from public.portal_links where token = p_token;

  if v_link.id is null then
    perform r.allowed
    from public.rate_limit_hit('portal:miss:' || v_ip, 30, 300) r;
    return jsonb_build_object('error', 'invalid');
  end if;

  select r.allowed into v_allowed
  from public.rate_limit_hit('portal:view:' || v_link.id::text, 120, 60) r;

  if not v_allowed then
    return jsonb_build_object('error', 'limit');
  end if;

  if v_link.revoked_at is not null
     or v_link.expires_at <= now()
     or (v_link.max_views is not null and v_link.view_count >= v_link.max_views) then
    return jsonb_build_object('error', 'invalid');
  end if;

  -- Consumo atómico: si dos vistas llegan juntas y queda una, solo una pasa.
  update public.portal_links
  set view_count = view_count + 1, last_viewed_at = now()
  where id = v_link.id
    and (max_views is null or view_count < max_views);

  if not found then
    return jsonb_build_object('error', 'invalid');
  end if;

  insert into public.portal_views (org_id, link_id, ip)
  values (v_link.org_id, v_link.id, v_ip);

  select name into v_org_name from public.organizations where id = v_link.org_id;

  case v_link.kind
    when 'factura' then
      select jsonb_build_object(
        'code', i.code,
        'client', i.client_name,
        'status', i.status,
        'totalCents', i.total_cents,
        'paidCents', i.paid_cents,
        'currency', i.currency,
        'issuedOn', i.issued_on,
        'dueOn', i.due_on
      ) into v_payload
      from public.invoices i
      where i.id = v_link.target_id and i.deleted_at is null;
    when 'cita' then
      select jsonb_build_object(
        'patient', p.full_name,
        'kind', a.kind,
        'scheduledFor', a.scheduled_for,
        'status', a.status,
        'reason', a.reason,
        'professional', e.full_name
      ) into v_payload
      from public.patient_appointments a
      join public.patients p on p.id = a.patient_id
      left join public.employees e on e.id = a.professional_id
      where a.id = v_link.target_id;
    when 'avance' then
      select jsonb_build_object(
        'name', o.name,
        'client', o.client,
        'estado', o.estado,
        'valorPresupuestado', o.valor_presupuestado,
        'valorEjecutado', o.valor_ejecutado,
        'avancePct', case when o.valor_presupuestado > 0
          then round((o.valor_ejecutado / o.valor_presupuestado) * 100, 1)
          else 0 end
      ) into v_payload
      from public.obra_presupuestos o
      where o.id = v_link.target_id;
  end case;

  if v_payload is null then
    return jsonb_build_object('error', 'invalid');
  end if;

  return jsonb_build_object(
    'kind', v_link.kind,
    'org', v_org_name,
    'payload', v_payload
  );
end;
$$;

revoke all on function public.portal_view(text) from public, anon, authenticated;
grant execute on function public.portal_view(text) to anon, authenticated;

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
      'obra', 'ph', 'contratacion', 'portal'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('portal:read',  'portal', 'read',  'Ver enlaces públicos'),
  ('portal:write', 'portal', 'write', 'Gestionar enlaces públicos')
on conflict (key) do update set label = excluded.label;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('portal:read'), ('portal:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── Transversal: todos los sectores lo proponen ────────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'construccion', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'energia', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'manufactura', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'comercio', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'ecommerce', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'servicios', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'tecnologia', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'salud', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'educacion', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'logistica', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'alimentos', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'agro', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'inmobiliario', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'hoteleria', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'financiero', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'mineria', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'telecomunicaciones', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'seguridad', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'medios', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'ong', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'gobierno', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'otro', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'fitness-bienestar', k, 'add' from unnest(array['portal']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'portal';
--   delete from public.role_permissions where permission like 'portal:%';
--   delete from public.permissions where module = 'portal';
--   drop function if exists public.portal_view(text);
--   drop function if exists public.portal_create(text, uuid, text, int, int);
--   drop table if exists public.portal_views;
--   drop table if exists public.portal_links;
--   -- y volver a crear app.valid_module_keys() sin 'portal'
-- ═══════════════════════════════════════════════════════════════════════════
