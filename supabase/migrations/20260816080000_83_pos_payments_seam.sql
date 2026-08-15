-- ═══════════════════════════════════════════════════════════════════════════
-- 83 — Pagos en línea del POS: el seam de datos (plan CRM/ERP/POS 3.3)
--
-- La pasarela ya está configurable desde `integraciones` (migración 64:
-- Wompi con secretos en el vault y prueba de conexión). Lo que faltaba es
-- donde aterriza un pago confirmado: una fila atada a la venta, idempotente
-- por evento del proveedor.
--
-- Esta migración es SOLO el seam. El intent de pago (edge function
-- `pos-payment-intent`) y el webhook firmado quedan pendientes de la
-- decisión de pricing que el plan marca como prerequisito (Enterprise vs
-- add-on) — el código no cambia, el gate sí, pero sin la decisión no se
-- compra un proveedor para probarlo.
--
-- Reglas que sí se fijan aquí:
--   · un evento del proveedor se procesa una sola vez (unique event_id);
--   · un pago confirmado exige una venta real (FK a pos_sales);
--   · nadie con sesión escribe estas filas: las escribe el webhook con
--     service role (RLS sin políticas de escritura para authenticated).
-- ═══════════════════════════════════════════════════════════════════════════

create table public.pos_payments (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  sale_id        uuid not null references public.pos_sales (id) on delete cascade,
  provider       text not null default 'wompi'
                   check (provider in ('wompi', 'payu', 'epayco', 'stripe', 'otro')),
  status         text not null default 'Pendiente'
                   check (status in ('Pendiente', 'Confirmado', 'Rechazado')),
  amount_cents   bigint not null check (amount_cents > 0),
  reference      text not null default '',
  external_id    text,
  event_id       text,
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (event_id)
);

create index pos_payments_sale_idx on public.pos_payments (sale_id);
create index pos_payments_org_idx on public.pos_payments (org_id, created_at desc);

create trigger pos_payments_touch before update on public.pos_payments
  for each row execute function app.touch_updated_at();

comment on table public.pos_payments is
  'Pagos en línea contra ventas de mostrador. El webhook del proveedor los confirma; event_id único los hace idempotentes.';

-- El cajero puede VER si una venta tiene pago en línea (para no cobrarla dos
-- veces); escribir estas filas es del webhook con service role, nunca del
-- navegador — el proveedor es la fuente de verdad del pago, no el cliente.
alter table public.pos_payments enable row level security;
alter table public.pos_payments force  row level security;

create policy pos_payments_select on public.pos_payments
  for select to authenticated using (org_id in (select app.orgs_with('pos:read')));

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop table if exists public.pos_payments;
-- ═══════════════════════════════════════════════════════════════════════════
