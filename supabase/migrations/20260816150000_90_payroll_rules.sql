-- ═══════════════════════════════════════════════════════════════════════════
-- 90 — Nómina legal colombiana (plan CRM/ERP/POS 4.3) — schema
--
-- La base (mig. 02) guarda un bruto, unas deducciones y un neto por
-- empleado y periodo. Aquí se añade lo que exige 4.3:
--   1. `payroll_rules` — parámetros legales versionados por año. Los valores
--      se cargan a cero y los parametriza el contador: nada de inventar
--      números regulatorios en código. Validación obligatoria con contador
--      laboral colombiano antes de producción (lo exige el plan).
--   2. `payroll_concepts` + `payroll_concept_lines` — desglose por empleado:
--      salario, auxilio de transporte, horas, novedades, deducciones.
--      El concepto se copia por texto en la línea (`name`), igual que
--      `client_name`: un concepto puede borrarse sin reescribir historia.
--   3. Cierre de periodo: `payroll_periods.locked_at` + guardias que vuelven
--      inmutables las líneas y el propio periodo una vez cerrado.
--   4. `export_payroll_pila` — vista plana para cargar en la PILA a mano;
--      sin prometer presentación automática (el plan lo prohíbe).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Reglas legales versionadas por año ──────────────────────────────────

-- La PILA exige documento de identidad por cotizante; la nómina lo necesita
-- también para el desprendible. Se añade aquí, con la misma licencia que
-- `client_name`: texto libre, validado por el contador.
alter table public.employees
  add column tax_id text not null default '';

create table public.payroll_rules (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations (id) on delete cascade,
  year                  int not null check (year between 2000 and 2100),
  -- Salario mínimo y auxilio de transporte del año. Cero hasta que el
  -- contador los parametrice.
  min_wage_cents        bigint not null default 0 check (min_wage_cents >= 0),
  transport_cents       bigint not null default 0 check (transport_cents >= 0),
  -- Prestaciones (porcentajes anuales, 100.00 = 100%).
  cesantias_pct         numeric(5, 2) not null default 8.33,
  prima_pct             numeric(5, 2) not null default 8.33,
  interes_cesantias_pct numeric(5, 2) not null default 1.00,
  vacaciones_pct        numeric(5, 2) not null default 4.17,
  -- Seguridad social: aportes del empleado y del empleador.
  salud_employee_pct    numeric(5, 2) not null default 4.00,
  salud_employer_pct    numeric(5, 2) not null default 8.50,
  pension_employee_pct  numeric(5, 2) not null default 4.00,
  pension_employer_pct  numeric(5, 2) not null default 12.00,
  arl_pct               numeric(5, 2) not null default 0.52,
  caja_pct              numeric(5, 2) not null default 3.00,
  -- Días hábiles de vacaciones por año (18 en Colombia).
  vacation_days         int not null default 15 check (vacation_days between 0 and 60),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (org_id, year)
);

create trigger payroll_rules_touch before update on public.payroll_rules
  for each row execute function app.touch_updated_at();

comment on table public.payroll_rules is
  'Parámetros legales de nómina por año. Valores a cero hasta parametrizar '
  'con contador laboral; 4.3 exige validación externa antes de producción.';

select app.apply_standard_rls('payroll_rules', 'nomina:read', 'nomina:write');

-- ─── 2. Conceptos y desglose por empleado ───────────────────────────────────

create table public.payroll_concepts (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 120),
  kind       text not null check (kind in ('Devengo', 'Deducción')),
  position   int not null default 0,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

comment on table public.payroll_concepts is
  'Catálogo de conceptos de la empresa: salario, auxilio, horas extras, '
  'préstamos, libranzas… Devengo suma al bruto; Deducción resta.';

select app.apply_standard_rls('payroll_concepts', 'nomina:read', 'nomina:write');

create table public.payroll_concept_lines (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  payroll_period_id  uuid not null references public.payroll_periods (id) on delete cascade,
  employee_id        uuid not null references public.employees (id) on delete restrict,
  name               text not null,
  kind               text not null check (kind in ('Devengo', 'Deducción')),
  amount_cents       bigint not null check (amount_cents >= 0),
  position           int not null default 0,
  created_at         timestamptz not null default now(),
  unique (payroll_period_id, employee_id, name, kind)
);

create index payroll_concept_lines_period_idx
  on public.payroll_concept_lines (payroll_period_id, employee_id, position);

comment on table public.payroll_concept_lines is
  'Desglose de un empleado en un periodo. `name` copia el concepto en el '
  'momento del cálculo: borrar un concepto no reescribe la historia.';

select app.apply_standard_rls('payroll_concept_lines', 'nomina:read', 'nomina:write');

-- ─── 3. Cierre de periodo: inmutabilidad ────────────────────────────────────

alter table public.payroll_periods
  add column locked_at timestamptz;

comment on column public.payroll_periods.locked_at is
  'Cierre del periodo: a partir de aquí líneas y periodo son inmutables.';

create or replace function app.payroll_period_locked(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select locked_at is not null
  from public.payroll_periods
  where id = p_id;
$$;

-- Las líneas no se tocan en un periodo cerrado.
create or replace function app.guard_payroll_locked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.payroll_period_locked(coalesce(new.payroll_period_id, old.payroll_period_id)) then
    raise exception 'el periodo está cerrado: no se puede modificar'
      using errcode = 'KG301';
  end if;
  -- En DELETE, NEW es NULL; retornar NULL aborta el borrado en silencio,
  -- así que hay que devolver OLD para dejar pasar la fila.
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger payroll_lines_guard_locked
  before insert or update or delete on public.payroll_lines
  for each row execute function app.guard_payroll_locked();
create trigger payroll_concept_lines_guard_locked
  before insert or update or delete on public.payroll_concept_lines
  for each row execute function app.guard_payroll_locked();

-- El periodo mismo se congela salvo la fecha de cierre.
create or replace function app.guard_payroll_period_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.locked_at is not null and
     (new.period <> old.period or new.status <> old.status or new.code <> old.code) then
    raise exception 'el periodo está cerrado: no se puede modificar'
      using errcode = 'KG301';
  end if;
  return new;
end;
$$;

create trigger payroll_periods_guard_locked
  before update on public.payroll_periods
  for each row execute function app.guard_payroll_period_update();

/**
 * Cierra el periodo: congela líneas y periodo. Solo administrador.
 * Recalcula el neto de cada línea desde el desglose (bruto - deducciones).
 */
create or replace function public.lock_payroll_period(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select org_id into v_org
  from public.payroll_periods
  where id = p_period_id;

  if v_org is null or not app.is_org_admin(v_org) then
    raise exception 'solo un administrador cierra periodos' using errcode = 'KG302';
  end if;
  if app.payroll_period_locked(p_period_id) then
    raise exception 'el periodo ya está cerrado' using errcode = 'KG303';
  end if;

  -- Neto desde el desglose: total devengos - total deducciones.
  update public.payroll_lines pl
  set gross_cents = coalesce((
        select sum(l.amount_cents) from public.payroll_concept_lines l
        where l.payroll_period_id = p_period_id
          and l.employee_id = pl.employee_id
          and l.kind = 'Devengo'
      ), 0),
      deductions_cents = coalesce((
        select sum(l.amount_cents) from public.payroll_concept_lines l
        where l.payroll_period_id = p_period_id
          and l.employee_id = pl.employee_id
          and l.kind = 'Deducción'
      ), 0)
  where pl.payroll_period_id = p_period_id;

  update public.payroll_periods
  set locked_at = now(), status = 'Pagada'
  where id = p_period_id;
end;
$$;

revoke all on function public.lock_payroll_period(uuid) from public, anon;
grant execute on function public.lock_payroll_period(uuid) to authenticated;

-- ─── 4. Exporte plano para PILA (carga manual, sin presentación) ────────────

create or replace function public.export_payroll_pila(p_period_id uuid)
returns table (
  tipo_documento text,
  documento text,
  nombre text,
  tipo_cotizante text,
  salario_base_cents bigint,
  salud_cents bigint,
  pension_cents bigint,
  arl_cents bigint,
  caja_cents bigint,
  total_aportes_cents bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org     uuid;
  v_rules   public.payroll_rules%rowtype;
  v_period  record;
begin
  select org_id, period into v_org, v_period
  from public.payroll_periods
  where id = p_period_id;

  if v_org is null then
    raise exception 'periodo no encontrado' using errcode = 'KG304';
  end if;
  if not app.is_org_admin(v_org) and not exists (
    select 1 from public.memberships m
    where m.org_id = v_org and m.user_id = (select auth.uid())
  ) then
    raise exception 'sin acceso al periodo' using errcode = 'KG305';
  end if;

  select * into v_rules
  from public.payroll_rules
  where org_id = v_org and year = extract(year from v_period.period);

  return query
  select
    'CC' as tipo_documento,
    coalesce(e.tax_id, '') as documento,
    e.full_name as nombre,
    'Dependiente' as tipo_cotizante,
    greatest(pl.gross_cents, coalesce(v_rules.min_wage_cents, 0)) as salario_base_cents,
    round(greatest(pl.gross_cents, coalesce(v_rules.min_wage_cents, 0)) * coalesce(v_rules.salud_employer_pct, 0) / 100)::bigint as salud_cents,
    round(greatest(pl.gross_cents, coalesce(v_rules.min_wage_cents, 0)) * coalesce(v_rules.pension_employer_pct, 0) / 100)::bigint as pension_cents,
    round(greatest(pl.gross_cents, coalesce(v_rules.min_wage_cents, 0)) * coalesce(v_rules.arl_pct, 0) / 100)::bigint as arl_cents,
    round(greatest(pl.gross_cents, coalesce(v_rules.min_wage_cents, 0)) * coalesce(v_rules.caja_pct, 0) / 100)::bigint as caja_cents,
    round(greatest(pl.gross_cents, coalesce(v_rules.min_wage_cents, 0))
      * (coalesce(v_rules.salud_employer_pct, 0) + coalesce(v_rules.pension_employer_pct, 0)
         + coalesce(v_rules.arl_pct, 0) + coalesce(v_rules.caja_pct, 0)) / 100)::bigint as total_aportes_cents
  from public.payroll_lines pl
  join public.employees e on e.id = pl.employee_id
  where pl.payroll_period_id = p_period_id
  order by e.full_name;
end;
$$;

revoke all on function public.export_payroll_pila(uuid) from public, anon;
grant execute on function public.export_payroll_pila(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.export_payroll_pila(uuid);
--   drop function if exists public.lock_payroll_period(uuid);
--   drop trigger if exists payroll_periods_guard_locked on public.payroll_periods;
--   drop function if exists app.guard_payroll_period_update();
--   drop trigger if exists payroll_concept_lines_guard_locked on public.payroll_concept_lines;
--   drop trigger if exists payroll_lines_guard_locked on public.payroll_lines;
--   drop function if exists app.guard_payroll_locked();
--   drop function if exists app.payroll_period_locked(uuid);
--   drop table if exists public.payroll_concept_lines;
--   drop table if exists public.payroll_concepts;
--   drop table if exists public.payroll_rules;
--   alter table public.payroll_periods drop column if exists locked_at;
--   alter table public.employees drop column if exists tax_id;
-- ═══════════════════════════════════════════════════════════════════════════