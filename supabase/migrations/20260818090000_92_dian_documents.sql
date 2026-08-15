-- ═══════════════════════════════════════════════════════════════════════════
-- 92 — Facturación electrónica DIAN (modo demo)
--
-- Ampía `integration_settings` con un nuevo `kind = 'dian'` y proveedor
-- `dian_demo`. El `provider` NUNCA se acepta como `dian_prod` aquí: el modo
-- producción requiere firma digital y proveedor tecnológico homologado por
-- la DIAN; ese flujo es manual, fiscal y queda fuera de este módulo. Solo
-- `dian_demo` produce CUFE/CUDE simulados, no válidos ante la DIAN.
--
-- Reemplaza las tres RPC de puerta al vault para que el namespace
-- `integraciones.<org>.dian.<field>` también lo acepten (sin eso, guardar
-- el certificado demoроблемa). Los cuerpos solo abren el regex; el resto del
-- mismo contrato.
--
-- `dian_documents` es la proyección fiscal de una factura: 1:1 con
-- `invoices`, con el CUFE simulado, el ambiente ('demo' siempre, hasta
-- que exista prod), el XML UBL 2.1 generado y el estado del envío.
-- `dian_events` es el log inmutable de cada intento (envío, aceptación,
-- rechazo, consulta) — append-only por diseño, así un evento fiscal no
-- se reescribe nunca aunque la factura cambie.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Ampiar `integration_settings` con `kind = 'dian'` ───────────────────────

alter table public.integration_settings
  drop constraint integration_settings_kind_check;

alter table public.integration_settings
  add constraint integration_settings_kind_check
  check (kind in ('pagos', 'whatsapp', 'dian'));

alter table public.integration_settings
  drop constraint integration_settings_provider_check;

alter table public.integration_settings
  add constraint integration_settings_provider_check
  check (provider in ('wompi', 'payu', 'epayco', 'stripe', 'whatsapp', 'dian_demo', 'otro'));

-- ─── Reemplazar las RPC del vault para aceptar `dian` en el namespace ───────

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
  if p_name !~ '^integraciones\.[0-9a-f-]{36}\.(pagos|whatsapp|dian)\.[a-z_]+$' then
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
  if p_name !~ '^integraciones\.[0-9a-f-]{36}\.(pagos|whatsapp|dian)\.[a-z_]+$' then
    raise exception 'nombre de secreto fuera del namespace de integraciones';
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = p_name;
  return v_secret;
end;
$$;

revoke all on function public.integraciones_get_secret(text) from public, anon, authenticated;
grant execute on function public.integraciones_get_secret(text) to service_role;

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

-- ─── Proyección fiscal de la factura ────────────────────────────────────────

create table public.dian_documents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  invoice_id   uuid not null references public.invoices (id) on delete cascade,
  -- El snapshot de la factura al momento del envío: una factura puede editarse
  -- después y la proyección fiscal queda como pruebas del intento.
  invoice_code text not null default '',
  client_name  text not null default '',
  total_cents  bigint not null default 0,
  -- Ambiente DIAN: 'demo' siempre en este módulo. 'prod' queda prohibido por
  -- el check; ir a producción requiere modificar este check y un flujo fiscal
  -- externo (certificado, proveedor homologado, revisor fiscal).
  ambiente     text not null default 'demo' check (ambiente = 'demo'),
  -- Estado del envío a DIAN (simulado en demo).
  status       text not null default 'procesando'
               check (status in ('procesando', 'aceptada', 'rechazada', 'pendiente')),
  -- CUFE simulado: SHA-256 de campos canónicos en la lib de TS, guardado aquí.
  cufe         text not null default '' check (length(cufe) <= 128),
  xml_content  text not null default '',
  error        text not null default '',
  sent_at      timestamptz not null default now(),
  responded_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (invoice_id)
);

create index dian_documents_org_idx on public.dian_documents (org_id, sent_at desc);
create index dian_documents_status_idx on public.dian_documents (org_id, status) where status in ('procesando', 'pendiente');

select app.apply_standard_rls('dian_documents', 'facturacion:read', 'facturacion:write');

comment on table public.dian_documents is
  'Proyección fiscal de una factura ante la DIAN. Modo demo: CUFE simulado, no válido ante la DIAN.';

-- ─── Bitácora inmutable de eventos por intento DIAN ──────────────────────────

create table public.dian_events (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  dian_document_id uuid not null references public.dian_documents (id) on delete cascade,
  -- El tipo de evento fiscal. Cualquiera que pase a `dian_documents.status`
  -- produce una fila aquí; el log no se edita.
  kind            text not null check (kind in ('envio', 'aceptacion', 'rechazo', 'consulta', 'error')),
  message         text not null default '',
  -- El cuerpo bruto de la respuesta simulada (XML/JSON de DIAN en prod, el
  -- payload echoes del mock en demo). Para depuración del flujo.
  response_raw    text not null default '',
  created_at      timestamptz not null default now()
);

create index dian_events_doc_idx on public.dian_events (dian_document_id, created_at desc);

-- Append-only: la tabla se escribe pero jamás se edita. El UPDATE y DELETE
-- quedan negados revocando los grants a `authenticated` para esos verbos —
-- RLS suficientemente estricta, pero los grants refuerzan la inmutabilidad.
revoke update, delete on public.dian_events from authenticated;

select app.apply_child_rls('dian_events', 'dian_documents', 'dian_document_id',
                           'facturacion:read', 'facturacion:write');

comment on table public.dian_events is
  'Bitácora inmutable de eventos DIAN por documento. Append-only, sin UPDATE ni DELETE.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop table if exists public.dian_events;
--   drop table if exists public.dian_documents;
--   alter table public.integration_settings
--     drop constraint integration_settings_provider_check,
--     add constraint integration_settings_provider_check
--     check (provider in ('wompi', 'payu', 'epayco', 'stripe', 'whatsapp', 'otro'));
--   alter table public.integration_settings
--     drop constraint integration_settings_kind_check,
--     add constraint integration_settings_kind_check
--     check (kind in ('pagos', 'whatsapp'));
--   -- y volver a crear las tres RPC sin `dian` en el namespace
-- ═══════════════════════════════════════════════════════════════════════════