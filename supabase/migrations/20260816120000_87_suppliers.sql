-- ═══════════════════════════════════════════════════════════════════════════
-- 87 — Directorio de proveedores (plan CRM/ERP/POS, brecha ERP pendiente)
--
-- El proveedor existía como texto suelto en `supplier_invoices.supplier` y
-- `products.supplier`: cada factura y cada producto llevaba el nombre escrito
-- a mano, y un mismo proveedor era tres ortografías en tres filas. No había
-- manera de listar "a quién le compro", ni teléfono, ni RUT, ni estado.
--
-- El directorio es una tabla con identidad propia; las dos tablas que ya
-- hablaban del proveedor en texto aprenden a referenciarlo (`supplier_id`
-- nullable — el texto queda como snapshot histórico y como denormalización
-- para la UI existente). El backfill une los nombres sueltos de ambas tablas
-- en filas del directorio, y el trigger de guardia mantiene la misma empresa
-- y rellena el texto cuando solo se manda el id.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  name         text not null,
  tax_id       text not null default '',
  contact_name text not null default '',
  email        text not null default '',
  phone        text not null default '',
  city         text not null default '',
  category     text not null default '',
  notes        text not null default '',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Nombre único por empresa, sin importar mayúsculas. Un índice (no una
-- constraint): las constraints UNIQUE de CREATE TABLE no aceptan expresiones.
create unique index suppliers_org_name_key
  on public.suppliers (org_id, (lower(name)));

create index suppliers_active_idx
  on public.suppliers (org_id, name) where deleted_at is null;

create trigger suppliers_touch before update on public.suppliers
  for each row execute function app.touch_updated_at();

comment on table public.suppliers is
  'Directorio de proveedores de la empresa. Nombre único por empresa (sin importar mayúsculas).';

-- Mismo par de permisos que supplier_invoices y supplier_payments: quien
-- gestiona inventario gestiona a sus proveedores.
select app.apply_standard_rls('suppliers', 'inventario:read', 'inventario:write');

-- Las tablas que ya escribían al proveedor en texto aprenden a referenciarlo.
-- `on delete set null`: borrar un proveedor no arrastra facturas ni productos.
alter table public.supplier_invoices
  add column supplier_id uuid references public.suppliers (id) on delete set null;
alter table public.products
  add column supplier_id uuid references public.suppliers (id) on delete set null;

create index supplier_invoices_supplier_idx
  on public.supplier_invoices (org_id, supplier_id);
create index products_supplier_idx
  on public.products (org_id, supplier_id);

/**
 * Guardia compartida por supplier_invoices y products:
 *  - el proveedor referenciado debe pertenecer a la misma empresa;
 *  - si solo se manda el id, el texto se rellena con el nombre del directorio,
 *    para que la UI existente (que lee el texto) no se quede en blanco.
 */
create or replace function app.guard_supplier_ref()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.supplier_id is not null then
    if not exists (
      select 1 from public.suppliers s
      where s.id = new.supplier_id and s.org_id = new.org_id and s.deleted_at is null
    ) then
      raise exception 'el proveedor debe pertenecer a la misma empresa'
        using errcode = 'check_violation';
    end if;
    if btrim(coalesce(new.supplier, '')) = '' then
      select s.name into new.supplier
      from public.suppliers s where s.id = new.supplier_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger supplier_invoices_guard_supplier
  before insert or update of supplier_id, org_id on public.supplier_invoices
  for each row execute function app.guard_supplier_ref();
create trigger products_guard_supplier
  before insert or update of supplier_id, org_id on public.products
  for each row execute function app.guard_supplier_ref();

-- ── Backfill: los nombres sueltos de facturas y productos se vuelven filas ──
-- del directorio, y las filas existentes quedan enlazadas. La ortografía
-- original se conserva como texto; el directorio es quien impone la única.

insert into public.suppliers (org_id, name)
select distinct org_id, btrim(supplier)
from public.supplier_invoices
where deleted_at is null and btrim(supplier) <> ''
on conflict (org_id, lower(name)) do nothing;

insert into public.suppliers (org_id, name)
select distinct org_id, btrim(supplier)
from public.products
where deleted_at is null and btrim(supplier) <> ''
on conflict (org_id, lower(name)) do nothing;

update public.supplier_invoices i
set supplier_id = s.id
from public.suppliers s
where i.supplier_id is null
  and s.org_id = i.org_id
  and s.name = btrim(i.supplier)
  and btrim(i.supplier) <> '';

update public.products p
set supplier_id = s.id
from public.suppliers s
where p.supplier_id is null
  and s.org_id = p.org_id
  and s.name = btrim(p.supplier)
  and btrim(p.supplier) <> '';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop trigger if exists products_guard_supplier on public.products;
--   drop trigger if exists supplier_invoices_guard_supplier on public.supplier_invoices;
--   drop function if exists app.guard_supplier_ref();
--   alter table public.products drop column supplier_id;
--   alter table public.supplier_invoices drop column supplier_id;
--   drop table if exists public.suppliers;
-- ═══════════════════════════════════════════════════════════════════════════