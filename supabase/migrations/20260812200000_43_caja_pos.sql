-- ═══════════════════════════════════════════════════════════════════════════
-- 43 — Caja y punto de venta, para los cinco sectores que cobran de frente
--
-- Dos módulos transversales, no dos verticales. Es la diferencia que decide
-- dónde va el código: un odontograma solo lo entiende una clínica, pero cuadrar
-- el cajón al cierre del turno lo hacen igual la clínica, la tienda, el
-- restaurante, el hotel y el gimnasio. Cinco sectores, una implementación.
--
-- ─── Caja ya existía, mal ubicada ──────────────────────────────────────────
--
-- `public.cash_sessions` llegó en la migración 25 como una de las cuatro cosas
-- que le faltaban a «restaurante», y quedó protegida por `restaurante:read` y
-- `restaurante:write`. La tabla está bien: turno con base inicial, cierre
-- contra lo contado, un solo turno abierto por empresa. Lo que está mal es
-- quién puede verla — una clínica que cobra copagos en efectivo tiene que
-- encender el módulo de restaurante para cuadrar su caja.
--
-- Así que las políticas se reescriben contra `caja:*` y la tabla se queda donde
-- está. Ninguna fila se mueve; lo que cambia es el permiso que las abre.
--
-- Y para que ningún restaurante pierda su caja el día del despliegue, toda
-- empresa que hoy tenga `restaurante` encendido recibe `caja` encendido.
--
-- ─── Lo que le faltaba: los movimientos ────────────────────────────────────
--
-- Un arqueo con solo ventas no cuadra nunca. En el cajón entra y sale dinero
-- que no es una venta: la propina que se paga en efectivo, el domicilio que se
-- le paga al mensajero, el retiro a la caja fuerte a media tarde, la caja menor
-- para comprar hielo. `cash_movements` es eso, y es la razón por la que
-- `expected_cents` podía estar bien calculado y aun así no coincidir con la
-- realidad.
--
-- ─── POS: vender de mostrador ──────────────────────────────────────────────
--
-- Hoy un comercio vende por `tienda`, que es un catálogo web con carrito:
-- sirve para que alguien pida desde el celular, no para cobrarle a quien está
-- parado enfrente. `pos_sales` es la venta de mostrador — cobra, descuenta
-- existencias y queda atada al turno de caja que estaba abierto.
--
-- El descuento de existencias va en una función SECURITY DEFINER con el mismo
-- patrón que `place_storefront_order` (migración 12): bloqueo por fila en orden
-- de id, verificación y decremento en una sola transacción. Hacerlo desde la
-- aplicación deja la puerta abierta a vender dos veces la última unidad, y
-- además exigiría `catalogos:write` a quien solo está cobrando.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── El vocabulario, antes que nada ─────────────────────────────────────────
-- Generado con `npm run db:module-sql`. Va primero porque las políticas de
-- abajo nombran permisos que tienen que existir.

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
      'hoteleria', 'socios'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

insert into public.permissions (key, module, action, label) values
  ('caja:read',  'caja', 'read',  'Ver caja'),
  ('caja:write', 'caja', 'write', 'Gestionar caja'),
  ('pos:read',   'pos',  'read',  'Ver ventas de mostrador'),
  ('pos:write',  'pos',  'write', 'Gestionar ventas de mostrador')
on conflict (key) do update set label = excluded.label;

-- ─── Caja cambia de dueño ───────────────────────────────────────────────────

drop policy if exists cash_sessions_select on public.cash_sessions;
drop policy if exists cash_sessions_insert on public.cash_sessions;
drop policy if exists cash_sessions_update on public.cash_sessions;
drop policy if exists cash_sessions_delete on public.cash_sessions;

-- `apply_standard_rls` vuelve a activar RLS (ya lo está, es idempotente) y crea
-- las cuatro políticas con la forma de siempre. Reusarla en vez de escribir las
-- políticas a mano es justamente lo que impide que esta tabla termine con una
-- condición sutilmente distinta a las otras sesenta.
select app.apply_standard_rls('cash_sessions', 'caja:read', 'caja:write');

comment on table public.cash_sessions is
  'Turnos de caja: base inicial, cierre contra lo contado y diferencia. '
  'Nació dentro de restaurante (mig. 25) y desde la 43 es el módulo `caja`, '
  'compartido por comercio, alimentos, salud, hotelería y fitness.';

/**
 * Lo que entra y sale del cajón aparte de las ventas.
 *
 * Las ventas no se registran aquí a propósito: llegan solas desde `pos_sales` y
 * desde las comandas del restaurante, y anotarlas además como movimiento las
 * contaría dos veces en el arqueo — que es el error más fácil de cometer y el
 * más difícil de encontrar después.
 *
 * Hijo del turno, no de la empresa: un movimiento sin turno no se puede
 * cuadrar contra nada, y su aislamiento sale del padre por `apply_child_rls`.
 */
create table public.cash_movements (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.cash_sessions (id) on delete cascade,
  kind        text not null default 'Egreso'
                check (kind in ('Ingreso', 'Egreso', 'Retiro', 'Gasto')),
  -- Siempre positivo. El signo lo pone `kind`, no el número: un monto negativo
  -- de tipo «Egreso» es una fila que nadie sabe leer, y aparece en cuanto se
  -- permite escribirla.
  amount_cents bigint not null check (amount_cents > 0),
  concept     text not null check (length(btrim(concept)) between 1 and 200),
  method      text not null default 'Efectivo'
                check (method in ('Transferencia', 'Efectivo', 'Tarjeta', 'Cheque', 'Otro')),
  created_by  uuid references public.employees (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index cash_movements_session_idx
  on public.cash_movements (session_id, created_at desc);

select app.apply_child_rls('cash_movements', 'cash_sessions', 'session_id',
                           'caja:read', 'caja:write');

comment on table public.cash_movements is
  'Ingresos y egresos del turno que no son ventas: propinas, domicilios pagados, '
  'retiros a la caja fuerte, caja menor. Las ventas NO van aquí: se contarían dos veces.';

-- ─── Punto de venta ─────────────────────────────────────────────────────────

create table public.pos_sales (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  code            text,
  -- El turno que estaba abierto al cobrar. Nulo cuando no había ninguno: un
  -- spa que cobra todo por transferencia nunca abre caja, y negarle la venta
  -- por eso sería el software decidiendo cómo cobra el negocio.
  session_id      uuid references public.cash_sessions (id) on delete set null,
  client_id       uuid references public.clients (id) on delete set null,
  -- El mostrador vende a gente que no está en el directorio. El nombre suelto
  -- es la respuesta honesta a eso, igual que `invoices.client_name`.
  customer_name   text not null default '',
  subtotal_cents  bigint not null default 0 check (subtotal_cents >= 0),
  discount_cents  bigint not null default 0 check (discount_cents >= 0),
  tax_cents       bigint not null default 0 check (tax_cents >= 0),
  total_cents     bigint not null default 0 check (total_cents >= 0),
  payment_method  text not null default 'Efectivo'
                    check (payment_method in ('Transferencia', 'Efectivo', 'Tarjeta', 'Cheque', 'Otro')),
  -- Anulada, nunca borrada. Una venta que existió y se deshizo es un hecho del
  -- turno, y el arqueo de esa tarde tiene que poder explicarla.
  status          text not null default 'Pagada'
                    check (status in ('Pagada', 'Anulada')),
  sold_by         uuid references public.employees (id) on delete set null,
  sold_at         timestamptz not null default now(),
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, code)
);

create index pos_sales_org_idx on public.pos_sales (org_id, sold_at desc);
create index pos_sales_session_idx
  on public.pos_sales (session_id) where session_id is not null;

create trigger pos_sales_code before insert on public.pos_sales
  for each row execute function app.set_code('pos_sale', 'VTA', '5');
create trigger pos_sales_touch before update on public.pos_sales
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('pos_sales', 'pos:read', 'pos:write');

comment on table public.pos_sales is
  'Ventas de mostrador. Se anulan, no se borran: el arqueo del turno tiene que poder explicarlas.';

create table public.pos_sale_items (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references public.pos_sales (id) on delete cascade,
  -- Apunta al catálogo cuando existe, y sigue valiendo cuando el producto se
  -- retira: el sku y el nombre se copian al vender, así que un recibo de marzo
  -- se sigue leyendo en diciembre.
  product_id      uuid references public.products (id) on delete set null,
  sku             text not null default '',
  name            text not null,
  quantity        int not null check (quantity > 0),
  unit_price_cents bigint not null default 0 check (unit_price_cents >= 0),
  total_cents     bigint not null default 0 check (total_cents >= 0)
);

create index pos_sale_items_sale_idx on public.pos_sale_items (sale_id);

select app.apply_child_rls('pos_sale_items', 'pos_sales', 'sale_id',
                           'pos:read', 'pos:write');

-- ─── Vender, de forma atómica ───────────────────────────────────────────────

/**
 * Registra una venta de mostrador y mueve las existencias en una transacción.
 *
 * Mismo patrón que `place_storefront_order` (migración 12) y por la misma
 * razón: leer las existencias, decidir y después escribirlas desde la
 * aplicación deja una ventana en la que dos cajeros venden la última unidad.
 * El bloqueo por fila en orden de id es lo que hace segura la secuencia
 * leer-verificar-descontar, y el orden evita que dos ventas de los mismos dos
 * productos se traben tomándolos al revés.
 *
 * SECURITY DEFINER, así que la autorización se comprueba aquí: pide
 * `pos:write`, no `catalogos:write`. Cobrar mueve existencias, y quien cobra no
 * tiene por qué poder editar el catálogo — que es lo que exigiría la política
 * de `products` si el UPDATE saliera de la aplicación.
 *
 * Códigos de error, para que la pantalla diga algo útil:
 *   KG101 — sin permiso
 *   KG102 — el carrito no es válido
 *   KG103 — una línea ya no se sostiene (producto retirado o sin existencias)
 */
create or replace function public.register_pos_sale(
  p_org_id         uuid,
  p_items          jsonb,
  p_payment_method text default 'Efectivo',
  p_customer_name  text default '',
  p_discount_cents bigint default 0,
  p_notes          text default ''
)
returns table (sale_id uuid, sale_code text, sale_total_cents bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids         uuid[];
  v_quantities  int[];
  v_line        record;
  v_employee_id uuid;
  v_session_id  uuid;
  v_sale_id     uuid;
  v_subtotal    bigint := 0;
  v_total       bigint;
begin
  if p_org_id is null or p_org_id not in (select app.orgs_with('pos:write')) then
    raise exception 'No tienes permiso para vender.' using errcode = 'KG101';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene líneas.' using errcode = 'KG102';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'La venta tiene demasiadas líneas.' using errcode = 'KG102';
  end if;

  if p_discount_cents is null or p_discount_cents < 0 then
    raise exception 'El descuento no es válido.' using errcode = 'KG102';
  end if;

  -- Plegado por producto: el mismo artículo agregado dos veces es un decremento
  -- de la suma, no dos decrementos calculados sobre la misma existencia vieja
  -- donde gana la última escritura y la diferencia desaparece.
  select array_agg(w.product_id order by w.product_id),
         array_agg(w.quantity   order by w.product_id)
    into v_ids, v_quantities
  from (
    select (e ->> 'product_id')::uuid        as product_id,
           sum((e ->> 'quantity')::int)::int as quantity
    from jsonb_array_elements(p_items) e
    group by 1
  ) w;

  if v_ids is null or array_position(v_ids, null) is not null then
    raise exception 'La venta no es válida.' using errcode = 'KG102';
  end if;

  if exists (select 1 from unnest(v_quantities) q where q is null or q < 1 or q > 9999) then
    raise exception 'La cantidad vendida no es válida.' using errcode = 'KG102';
  end if;

  perform 1
  from public.products p
  where p.org_id = p_org_id
    and p.id = any (v_ids)
  order by p.id
  for update;

  for v_line in
    select w.product_id, w.quantity, p.id as found_id, p.name, p.stock, p.price_cents
    from unnest(v_ids, v_quantities) as w(product_id, quantity)
    left join public.products p
      on  p.id         = w.product_id
      and p.org_id     = p_org_id
      and p.deleted_at is null
      and p.is_active
    order by w.product_id
  loop
    if v_line.found_id is null then
      raise exception 'Uno de los productos ya no está disponible.' using errcode = 'KG103';
    end if;
    if v_line.stock < v_line.quantity then
      raise exception '"%" solo tiene % unidades disponibles.', v_line.name, v_line.stock
        using errcode = 'KG103';
    end if;
    v_subtotal := v_subtotal + (v_line.price_cents * v_line.quantity);
  end loop;

  -- El descuento no puede dejar el total negativo. Se recorta en vez de
  -- rechazarse: quien teclea «descuento 50.000» sobre una venta de 30.000 casi
  -- siempre quiso regalarla, y devolverle un error no le dice qué hacer.
  v_total := greatest(v_subtotal - least(p_discount_cents, v_subtotal), 0);

  update public.products p
     set stock = p.stock - w.quantity
    from unnest(v_ids, v_quantities) as w(product_id, quantity)
   where p.id     = w.product_id
     and p.org_id = p_org_id;

  select e.id into v_employee_id
  from public.employees e
  where e.org_id = p_org_id
    and e.user_id = (select auth.uid())
    and e.deleted_at is null
  limit 1;

  -- El turno abierto, si lo hay. El índice parcial `cash_sessions_one_open`
  -- garantiza que a lo sumo haya uno, así que esto no necesita desempatar.
  select s.id into v_session_id
  from public.cash_sessions s
  where s.org_id = p_org_id and s.status = 'Abierta'
  limit 1;

  insert into public.pos_sales
    (org_id, session_id, customer_name, subtotal_cents, discount_cents,
     total_cents, payment_method, sold_by, notes)
  values
    (p_org_id, v_session_id, coalesce(btrim(p_customer_name), ''), v_subtotal,
     least(coalesce(p_discount_cents, 0), v_subtotal), v_total,
     coalesce(p_payment_method, 'Efectivo'), v_employee_id, coalesce(p_notes, ''))
  returning id into v_sale_id;

  insert into public.pos_sale_items
    (sale_id, product_id, sku, name, quantity, unit_price_cents, total_cents)
  select v_sale_id, p.id, p.sku, p.name, w.quantity, p.price_cents,
         p.price_cents * w.quantity
  from unnest(v_ids, v_quantities) as w(product_id, quantity)
  join public.products p on p.id = w.product_id and p.org_id = p_org_id;

  return query
  select s.id, s.code, s.total_cents from public.pos_sales s where s.id = v_sale_id;
end;
$$;

revoke all on function public.register_pos_sale(uuid, jsonb, text, text, bigint, text)
  from public, anon;
grant execute on function public.register_pos_sale(uuid, jsonb, text, text, bigint, text)
  to authenticated;

/**
 * Anula una venta y devuelve las existencias.
 *
 * Lo simétrico de vender, y con el mismo motivo para vivir en la base: reponer
 * existencias desde la aplicación exigiría `catalogos:write` a quien solo está
 * corrigiendo un cobro.
 *
 * Idempotente: anular dos veces no devuelve el inventario dos veces. Sin eso,
 * un doble clic infla las existencias y nadie descubre por qué.
 */
create or replace function public.void_pos_sale(p_sale_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_status text;
begin
  select s.org_id, s.status into v_org_id, v_status
  from public.pos_sales s where s.id = p_sale_id;

  if v_org_id is null then
    raise exception 'Esa venta no existe.' using errcode = 'KG102';
  end if;

  if v_org_id not in (select app.orgs_with('pos:write')) then
    raise exception 'No tienes permiso para anular ventas.' using errcode = 'KG101';
  end if;

  if v_status = 'Anulada' then
    return true;
  end if;

  update public.products p
     set stock = p.stock + i.quantity
    from public.pos_sale_items i
   where i.sale_id    = p_sale_id
     and p.id         = i.product_id
     and p.org_id     = v_org_id;

  update public.pos_sales set status = 'Anulada' where id = p_sale_id;
  return true;
end;
$$;

revoke all on function public.void_pos_sale(uuid) from public, anon;
grant execute on function public.void_pos_sale(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Que nadie pierda nada el día del despliegue
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Toda empresa que hoy usa `restaurante` recibe `caja`.
 *
 * Sin esto, el despliegue le quita la caja a cada restaurante que ya la estaba
 * usando: la tabla sigue llena y las políticas nuevas piden un permiso que su
 * `enabled_modules` no incluye. Un módulo que desaparece con sus datos dentro
 * es la peor forma posible de mover una funcionalidad de sitio.
 */
update public.organizations
   set enabled_modules = array_append(enabled_modules, 'caja')
 where 'restaurante' = any(enabled_modules)
   and not ('caja' = any(enabled_modules));

-- Los permisos, para los roles que ya administran y para los que ya podían
-- tocar la caja cuando vivía dentro de restaurante.
insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('caja:read'), ('caja:write'), ('pos:read'), ('pos:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('caja:read'), ('caja:write')) as p(key)
where rp.permission = 'restaurante:write'
on conflict do nothing;

/**
 * Y las empresas que se creen desde ahora.
 *
 * Se redefine entera porque una función no tiene ALTER para su cuerpo. El único
 * cambio son las cuatro claves nuevas en el bloque de «Líder de equipo»: quien
 * dirige un turno abre y cierra la caja, y quien atiende el mostrador cobra.
 */
create or replace function app.seed_default_permissions(p_org_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.role_permissions (org_id, role, permission)
  select p_org_id, 'Administrador', key from public.permissions
  union all
  select p_org_id, 'Líder de equipo', key from public.permissions
    where key in (
      'dashboard:read', 'empleados:read', 'asistencia:read', 'asistencia:write',
      'riesgos:read', 'proyectos:read', 'proyectos:write', 'cotizaciones:read',
      'compras:read', 'compras:write', 'tienda:read', 'catalogos:read',
      'firmas:read', 'inventario:read', 'documentos:read', 'consultoria:read',
      'hseq:read', 'hseq:write', 'tickets:read', 'tickets:write',
      'canales:read', 'canales:write', 'calendario:read', 'calendario:write',
      'trazabilidad:read', 'ia:use',
      'clientes:read', 'clientes:write', 'contratos:read', 'facturacion:read',
      'reclutamiento:read', 'reclutamiento:write', 'capacitacion:read',
      'desempeno:read', 'desempeno:write',
      'mantenimiento:read', 'mantenimiento:write', 'flota:read',
      'produccion:read', 'ecommerce:read', 'pacientes:read', 'estudiantes:read',
      'restaurante:read', 'restaurante:write', 'agro:read',
      'inmobiliario:read', 'hoteleria:read',
      'socios:read', 'socios:write',
      'caja:read', 'caja:write', 'pos:read', 'pos:write'
    )
  union all
  select p_org_id, 'Empleado', key from public.permissions
    where key in (
      'dashboard:read', 'empleados:read', 'asistencia:read', 'documentos:read',
      'tickets:read', 'calendario:read', 'canales:read', 'tienda:read',
      'ia:use', 'capacitacion:read', 'desempeno:read'
    )
  on conflict do nothing;
$$;

revoke all on function app.seed_default_permissions(uuid) from public, anon, authenticated;

-- ─── Dependencias ───────────────────────────────────────────────────────────
-- Espejo de MODULE_DEPENDENCIES en src/lib/modules/registry.ts.

insert into public.module_dependencies (module_key, requires_key, kind) values
  ('pos', 'catalogos',  'hard'),
  ('pos', 'caja',       'soft'),
  ('pos', 'inventario', 'soft')
on conflict do nothing;

-- ─── Los presets de los cinco sectores ──────────────────────────────────────
-- Misma forma `select ... from unnest(array[...])` que la migración 34, que es
-- la que sectors.test.ts lee para fijarlos contra COMPANY_TYPES.

insert into public.sector_modules (sector_key, module_key, mode)
  select 'comercio', k, 'add' from unnest(array['pos', 'caja']) as k
on conflict do nothing;
insert into public.sector_modules (sector_key, module_key, mode)
  select 'salud', k, 'add' from unnest(array['caja']) as k
on conflict do nothing;
insert into public.sector_modules (sector_key, module_key, mode)
  select 'alimentos', k, 'add' from unnest(array['caja']) as k
on conflict do nothing;
insert into public.sector_modules (sector_key, module_key, mode)
  select 'hoteleria', k, 'add' from unnest(array['caja']) as k
on conflict do nothing;
insert into public.sector_modules (sector_key, module_key, mode)
  select 'fitness-bienestar', k, 'add' from unnest(array['caja']) as k
on conflict do nothing;

-- Y lo que cada subsector cambia: quién tiene mostrador y quién no.
insert into public.sector_modules (sector_key, module_key, mode)
  select 'comercio-mayorista', k, 'remove' from unnest(array['pos', 'caja']) as k
on conflict do nothing;
insert into public.sector_modules (sector_key, module_key, mode)
  select 'alimentos-rapida', k, 'add' from unnest(array['pos']) as k
on conflict do nothing;
insert into public.sector_modules (sector_key, module_key, mode)
  select 'alimentos-panaderia', k, 'add' from unnest(array['pos']) as k
on conflict do nothing;
insert into public.sector_modules (sector_key, module_key, mode)
  select 'alimentos-catering', k, 'remove' from unnest(array['caja']) as k
on conflict do nothing;
insert into public.sector_modules (sector_key, module_key, mode)
  select 'salud-veterinaria', k, 'add' from unnest(array['pos']) as k
on conflict do nothing;
insert into public.sector_modules (sector_key, module_key, mode)
  select 'hoteleria-operador', k, 'remove' from unnest(array['caja']) as k
on conflict do nothing;
insert into public.sector_modules (sector_key, module_key, mode)
  select 'fitness-spa', k, 'add' from unnest(array['pos']) as k
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.void_pos_sale(uuid);
--   drop function if exists public.register_pos_sale(uuid, jsonb, text, text, bigint, text);
--   drop table if exists public.pos_sale_items, public.pos_sales cascade;
--   drop table if exists public.cash_movements cascade;
--   delete from public.sector_modules where module_key in ('caja', 'pos');
--   delete from public.module_dependencies where module_key = 'pos';
--   delete from public.role_permissions where permission like 'caja:%' or permission like 'pos:%';
--   delete from public.permissions where module in ('caja', 'pos');
--   update public.organizations set enabled_modules = array_remove(enabled_modules, 'caja');
--   -- y devolver cash_sessions a restaurante:*
--   drop policy cash_sessions_select on public.cash_sessions; -- etc.
--   select app.apply_standard_rls('cash_sessions', 'restaurante:read', 'restaurante:write');
-- ═══════════════════════════════════════════════════════════════════════════
