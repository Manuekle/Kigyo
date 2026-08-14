-- ═══════════════════════════════════════════════════════════════════════════
-- 19 — Order returns (devoluciones) for ecommerce
--
-- `online_orders` already knows how to say «Devuelto» and carries a tracking
-- code, but a return without its reason and value is a status change, not a
-- trace: two «Devuelto» orders can mean «wrong size» for one and «damaged in
-- transit» for the other, and only the value tells finance anything.
--
-- `online_order_returns` records what happened when an order is returned.
-- It is a child row of the order (hard-deleted with it — a return that
-- outlives its order counts nothing). The mutation that writes it also moves
-- the order to `status = 'Devuelto'`, so there is exactly one path that
-- creates a return and the status can never describe a return that has no
-- record.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.online_order_returns (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.online_orders (id) on delete cascade,
  reason       text not null,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  created_at   timestamptz not null default now()
);

create index online_order_returns_order_idx
  on public.online_order_returns (order_id, created_at desc);

select app.apply_child_rls('online_order_returns', 'online_orders', 'order_id',
                           'ecommerce:read', 'ecommerce:write');