-- ═══════════════════════════════════════════════════════════════════════════
-- 91 — Marketing: plantillas reusables
--
-- Una plantilla es el molde de una campaña: nombre, canal y mensaje listos
-- para aplicar a una nueva campaña con un clic. No es una campaña ni envía
-- nada; es el bibliotecario de piezas para no volver a teclear el mismo texto.
--
-- Misma RLS que `marketing_campaigns` (marketing:read / marketing:write); no
-- introduce módulo nuevo (la clave `marketing` ya está en `valid_module_keys`
-- desde la mig 63) ni dependencia nueva.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.marketing_templates (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 2 and 120),
  channel    text not null default 'whatsapp'
             check (channel in ('whatsapp', 'email', 'sms', 'otro')),
  message    text not null default '' check (length(message) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_templates_org_idx
  on public.marketing_templates (org_id, created_at desc);

create trigger marketing_templates_touch before update on public.marketing_templates
  for each row execute function app.touch_updated_at();

comment on table public.marketing_templates is
  'Plantillas de piezas de campaña: el molde reutilizable, no una campaña.';

select app.apply_standard_rls('marketing_templates', 'marketing:read', 'marketing:write');

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop table if exists public.marketing_templates;
-- ═══════════════════════════════════════════════════════════════════════════