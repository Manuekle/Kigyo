-- ═══════════════════════════════════════════════════════════════════════════
-- 45 — Odontología: el subsector que hasta ahora recibía una clínica genérica
--
-- `salud-odontologia` existe en el catálogo desde la migración 29 y su delta
-- entero era `+catalogos, +cotizaciones, −hseq, −trazabilidad`. Es decir: un
-- odontólogo recibía exactamente las mismas pantallas que un consultorio de
-- medicina general. Entraba a `pacientes` y encontraba historia clínica,
-- consultas y turnos —- todo correcto y todo insuficiente, porque el trabajo
-- de una clínica dental se organiza alrededor de una cosa que no existía en
-- ningún lado: la pieza dental.
--
-- ─── Por qué no es un módulo nuevo ─────────────────────────────────────────
--
-- Todo esto vive bajo `pacientes:read` / `pacientes:write`, sin permisos
-- propios y sin entrada en `enabled_modules`. Es la regla que la migración 16
-- fijó para salud y la 25 repitió para restaurante: «un sector recibe un
-- módulo sectorial, no un mueble de medio-módulos».
--
-- Un `odontograma` conmutable sería un interruptor que solo una de las seis
-- ramas de salud entiende, que las otras cinco tendrían que ver apagado para
-- siempre, y que en el plan del cliente aparecería como una línea que no sabe
-- comprar. La pantalla se muestra o no según el subsector, que es una decisión
-- de presentación y no de acceso.
--
-- ─── Numeración FDI ────────────────────────────────────────────────────────
--
-- Las piezas se identifican con la notación de dos dígitos de la FDI, que es
-- la que usa el mundo entero salvo Estados Unidos: primer dígito el cuadrante
-- (1-4 permanentes, 5-8 temporales), segundo la pieza desde el centro (1-8).
-- Se guarda como `smallint` y no como texto porque es un número con orden —- el
-- odontograma se dibuja recorriéndolo—- y el check declara los rangos válidos
-- en vez de aceptar «99» y descubrirlo al pintar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── El odontograma ─────────────────────────────────────────────────────────

/**
 * El levantamiento de la boca en un momento dado.
 *
 * Un paciente tiene varios a lo largo del tiempo, no uno que se sobrescribe:
 * el odontograma de hace dos años es la prueba de qué había antes de que este
 * consultorio tocara nada, y es lo primero que se busca cuando alguien reclama.
 * Guardar solo el estado actual convierte la historia en una opinión.
 */
create table public.dental_charts (
  id          uuid primary key default gen_random_uuid(),
  -- `org_id` propio aunque cuelgue del paciente, porque de este cuelga a su vez
  -- `dental_chart_teeth`: `app.apply_child_rls` lee `parent.org_id`, así que un
  -- nieto de `patients` no tiene de dónde heredar. Es el mismo patrón que
  -- `pos_sales`, que referencia `clients` y lleva su propia columna.
  org_id      uuid not null references public.organizations (id) on delete cascade,
  patient_id  uuid not null references public.patients (id) on delete cascade,
  professional_id uuid references public.employees (id) on delete set null,
  charted_on  date not null default current_date,
  kind        text not null default 'Inicial'
                check (kind in ('Inicial', 'Control', 'Final')),
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index dental_charts_patient_idx
  on public.dental_charts (org_id, patient_id, charted_on desc);

create trigger dental_charts_touch before update on public.dental_charts
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('dental_charts', 'pacientes:read', 'pacientes:write');

comment on table public.dental_charts is
  'Odontogramas de un paciente. Uno por levantamiento, no uno que se sobrescribe: '
  'el de hace dos años es la prueba de qué había antes.';

/**
 * El estado de una pieza, o de una cara de una pieza.
 *
 * `surface` es nulo cuando el hallazgo es de la pieza entera —- ausente,
 * implante, endodoncia—- y tiene valor cuando es de una cara: una caries está
 * en la oclusal o en la mesial, y anotarla en «la pieza» pierde exactamente el
 * dato con el que se planea el tratamiento.
 *
 * Por eso la unicidad es `(chart_id, tooth, surface)` y no `(chart_id, tooth)`:
 * la misma pieza puede tener caries en dos caras, y son dos hallazgos.
 */
create table public.dental_chart_teeth (
  id         uuid primary key default gen_random_uuid(),
  chart_id   uuid not null references public.dental_charts (id) on delete cascade,
  -- FDI. 11-18, 21-28, 31-38, 41-48 permanentes; 51-55, 61-65, 71-75, 81-85
  -- temporales. El check declara los cuadrantes y descarta el resto.
  tooth      smallint not null check (
               (tooth between 11 and 18) or (tooth between 21 and 28) or
               (tooth between 31 and 38) or (tooth between 41 and 48) or
               (tooth between 51 and 55) or (tooth between 61 and 65) or
               (tooth between 71 and 75) or (tooth between 81 and 85)
             ),
  surface    text check (surface is null or surface in
               ('Oclusal', 'Mesial', 'Distal', 'Vestibular', 'Lingual', 'Palatina')),
  condition  text not null check (condition in (
               'Sano', 'Caries', 'Obturado', 'Corona', 'Ausente', 'Implante',
               'Endodoncia', 'Fracturado', 'Sellante', 'Extracción indicada',
               'Protesis', 'Ortodoncia'
             )),
  notes      text not null default '',
  created_at timestamptz not null default now(),
  unique (chart_id, tooth, surface)
);

/**
 * Y el hallazgo de la pieza entera, una sola vez.
 *
 * El `unique` de arriba no lo cubre: en Postgres dos nulos no chocan, así que
 * «pieza 16 ausente» se podría anotar cinco veces sin que nada se queje. El
 * índice parcial es la forma de decirlo sin inventar un centinela como
 * `surface = ''`, que después habría que filtrar en cada consulta.
 */
create unique index dental_chart_teeth_whole_idx
  on public.dental_chart_teeth (chart_id, tooth) where surface is null;

create index dental_chart_teeth_chart_idx
  on public.dental_chart_teeth (chart_id, tooth);

select app.apply_child_rls('dental_chart_teeth', 'dental_charts', 'chart_id',
                           'pacientes:read', 'pacientes:write');

comment on table public.dental_chart_teeth is
  'Hallazgos por pieza (FDI) y por cara. `surface` nulo = la pieza entera.';

-- ─── Planes de tratamiento ──────────────────────────────────────────────────

/**
 * Lo que se propuso hacer, pieza por pieza, y qué se ha hecho.
 *
 * Separado del odontograma porque son dos preguntas distintas: el odontograma
 * dice cómo está la boca, el plan dice qué se va a hacer con ella. Mezclarlos
 * obliga a inventar un estado «caries que vamos a obturar el martes», que no es
 * un hallazgo clínico sino una agenda.
 *
 * `total_cents` se recalcula desde las líneas por un trigger, igual que
 * `menu_items.cost_cents` en la migración 25: una cifra que la aplicación
 * mantiene a mano se desincroniza el día que alguien borra una línea desde otro
 * sitio.
 */
create table public.treatment_plans (
  id          uuid primary key default gen_random_uuid(),
  -- Columna propia por la misma razón que `dental_charts`: de este cuelgan las
  -- líneas del plan, y el helper de RLS de hijos necesita un `org_id` arriba.
  org_id      uuid not null references public.organizations (id) on delete cascade,
  patient_id  uuid not null references public.patients (id) on delete cascade,
  code        text,
  professional_id uuid references public.employees (id) on delete set null,
  status      text not null default 'Propuesto'
                check (status in ('Propuesto', 'Aceptado', 'En curso', 'Terminado', 'Rechazado')),
  proposed_on date not null default current_date,
  accepted_on date,
  total_cents bigint not null default 0 check (total_cents >= 0),
  -- La cotización con la que se le presentó al paciente, cuando se hizo una.
  -- Nulo es lo normal: la mayoría se acepta de palabra en el sillón.
  quote_id    uuid references public.quotes (id) on delete set null,
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, code)
);

create index treatment_plans_patient_idx
  on public.treatment_plans (org_id, patient_id, proposed_on desc) where deleted_at is null;

create trigger treatment_plans_code before insert on public.treatment_plans
  for each row execute function app.set_code('treatment_plan', 'PLT', '5');
create trigger treatment_plans_touch before update on public.treatment_plans
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('treatment_plans', 'pacientes:read', 'pacientes:write');

comment on table public.treatment_plans is
  'Planes de tratamiento odontológico. El odontograma dice cómo está la boca; '
  'esto dice qué se va a hacer con ella.';

create table public.treatment_plan_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.treatment_plans (id) on delete cascade,
  -- La pieza y la cara sobre las que se trabaja. Nulas para un procedimiento
  -- que no es de una pieza: una profilaxis es de la boca entera.
  tooth       smallint check (
                tooth is null or
                (tooth between 11 and 18) or (tooth between 21 and 28) or
                (tooth between 31 and 38) or (tooth between 41 and 48) or
                (tooth between 51 and 55) or (tooth between 61 and 65) or
                (tooth between 71 and 75) or (tooth between 81 and 85)
              ),
  surface     text check (surface is null or surface in
                ('Oclusal', 'Mesial', 'Distal', 'Vestibular', 'Lingual', 'Palatina')),
  procedure   text not null check (length(btrim(procedure)) between 1 and 200),
  -- El producto del catálogo del que salió el precio, cuando salió de ahí.
  -- El precio se copia igual: subir la tarifa mañana no reescribe lo que se le
  -- prometió a este paciente hoy.
  product_id  uuid references public.products (id) on delete set null,
  price_cents bigint not null default 0 check (price_cents >= 0),
  status      text not null default 'Pendiente'
                check (status in ('Pendiente', 'En curso', 'Hecho', 'Cancelado')),
  done_on     date,
  professional_id uuid references public.employees (id) on delete set null,
  notes       text not null default '',
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

create index treatment_plan_items_plan_idx
  on public.treatment_plan_items (plan_id, sort, created_at);

select app.apply_child_rls('treatment_plan_items', 'treatment_plans', 'plan_id',
                           'pacientes:read', 'pacientes:write');

/**
 * El total del plan es la suma de sus líneas.
 *
 * Mismo patrón que `app.sync_menu_item_cost` (migración 25). Las canceladas no
 * suman: un plan de cinco procedimientos del que se descartaron dos vale lo que
 * valen los tres que quedan, y presentarle al paciente el total original sería
 * cobrarle por lo que no se le va a hacer.
 */
create or replace function app.sync_treatment_plan_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan  uuid := coalesce(new.plan_id, old.plan_id);
  v_total bigint;
begin
  select coalesce(sum(i.price_cents), 0) into v_total
  from public.treatment_plan_items i
  where i.plan_id = v_plan and i.status <> 'Cancelado';

  update public.treatment_plans p set total_cents = v_total where p.id = v_plan;
  return null;
end;
$$;

revoke all on function app.sync_treatment_plan_total() from public, anon, authenticated;

create trigger treatment_plan_items_sync_total
  after insert or update or delete on public.treatment_plan_items
  for each row execute function app.sync_treatment_plan_total();

-- ─── Laboratorio dental ─────────────────────────────────────────────────────

/**
 * El trabajo que sale de la clínica y tiene que volver.
 *
 * Distinto de `patient_lab_results`, que es el laboratorio *clínico* —- un
 * hemograma, una biopsia—- y ya existía desde la migración 16. Aquí no se pide
 * un resultado: se manda una corona a fabricar y se espera una caja. Lo que
 * importa es la fecha de regreso, porque la cita del paciente ya está agendada
 * contra ella.
 *
 * Cuelga del paciente y no de la línea del plan: se manda a hacer trabajo antes
 * de que exista un plan formal, y una prótesis que sobrevive a que se reescriba
 * el plan sigue estando en el laboratorio.
 */
create table public.dental_lab_orders (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  patient_id  uuid not null references public.patients (id) on delete cascade,
  plan_item_id uuid references public.treatment_plan_items (id) on delete set null,
  code        text,
  lab_name    text not null default '',
  work_type   text not null default 'Corona'
                check (work_type in (
                  'Corona', 'Puente', 'Prótesis total', 'Prótesis parcial',
                  'Incrustación', 'Carilla', 'Férula', 'Placa', 'Otro'
                )),
  tooth       smallint check (
                tooth is null or
                (tooth between 11 and 18) or (tooth between 21 and 28) or
                (tooth between 31 and 38) or (tooth between 41 and 48)
              ),
  sent_on     date not null default current_date,
  due_on      date,
  received_on date,
  status      text not null default 'Enviado'
                check (status in ('Enviado', 'En proceso', 'Recibido', 'Reproceso', 'Cancelado')),
  cost_cents  bigint not null default 0 check (cost_cents >= 0),
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, code)
);

create index dental_lab_orders_patient_idx
  on public.dental_lab_orders (org_id, patient_id, sent_on desc);
-- La consulta de la pantalla: qué está afuera y cuándo vuelve.
create index dental_lab_orders_pending_idx
  on public.dental_lab_orders (status, due_on) where received_on is null;

create trigger dental_lab_orders_code before insert on public.dental_lab_orders
  for each row execute function app.set_code('dental_lab_order', 'LAB', '5');
create trigger dental_lab_orders_touch before update on public.dental_lab_orders
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('dental_lab_orders', 'pacientes:read', 'pacientes:write');

comment on table public.dental_lab_orders is
  'Trabajos enviados al laboratorio dental. Distinto de patient_lab_results, que es '
  'el laboratorio clínico: aquí no se pide un resultado, se espera una caja.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop trigger if exists treatment_plan_items_sync_total on public.treatment_plan_items;
--   drop function if exists app.sync_treatment_plan_total();
--   drop table if exists public.dental_lab_orders cascade;
--   drop table if exists public.treatment_plan_items, public.treatment_plans cascade;
--   drop table if exists public.dental_chart_teeth, public.dental_charts cascade;
-- ═══════════════════════════════════════════════════════════════════════════
