-- ═══════════════════════════════════════════════════════════════════════════
-- 02 — People: employees and everything hanging off a person.
--
-- The mock data carried three disjoint employee rosters and denormalised every
-- person as a display-name string (who / quien / responsable / owner / req /
-- assigned). `employees` is now the single roster and those fields are real
-- foreign keys.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Employees ──────────────────────────────────────────────────────────────

create table public.employees (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  code         text,
  -- Set when the employee has signed in; null for people who exist on the
  -- roster but have no account yet.
  user_id      uuid references public.profiles (id) on delete set null,
  full_name    text not null check (length(btrim(full_name)) between 1 and 160),
  email        text check (email is null or email = lower(email)),
  position     text not null default '',
  department   text not null default '',
  location     text not null default '',
  status       text not null default 'Activo'
                 check (status in ('Activo', 'Inactivo', 'Onboarding', 'En licencia', 'Salida')),
  employment_type text not null default 'Tiempo completo'
                 check (employment_type in ('Tiempo completo', 'Medio tiempo', 'Contrato', 'Prácticas')),
  access_role  text not null default 'Empleado' references public.roles (key),
  manager_id   uuid references public.employees (id) on delete set null,
  hired_on     date,
  ended_on     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (org_id, code),
  constraint employees_dates_ordered check (ended_on is null or hired_on is null or ended_on >= hired_on)
);

create index employees_org_idx      on public.employees (org_id) where deleted_at is null;
create index employees_manager_idx  on public.employees (manager_id);
create unique index employees_user_org_key on public.employees (org_id, user_id) where user_id is not null;

create trigger employees_code   before insert on public.employees
  for each row execute function app.set_code('employee', 'EMP', '4');
create trigger employees_touch  before update on public.employees
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('employees', 'empleados:read', 'empleados:write');

-- ─── Skills ─────────────────────────────────────────────────────────────────

create table public.employee_skills (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  skill        text not null,
  level        smallint not null check (level between 1 and 5),
  unique (employee_id, skill)
);

select app.apply_child_rls('employee_skills', 'employees', 'employee_id',
                           'empleados:read', 'empleados:write');

-- ─── Journey / lifecycle events ─────────────────────────────────────────────

create table public.employee_events (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  occurred_on  date not null,
  event        text not null,
  tag          text not null default 'Otro'
                 check (tag in ('Ingreso', 'Ascenso', 'Traslado', 'Reconocimiento', 'Salida', 'Otro')),
  created_at   timestamptz not null default now()
);

create index employee_events_emp_idx on public.employee_events (employee_id, occurred_on desc);

select app.apply_child_rls('employee_events', 'employees', 'employee_id',
                           'empleados:read', 'empleados:write');

-- ─── Attendance: absences and vacation balances ─────────────────────────────

create table public.absences (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  code         text,
  employee_id  uuid not null references public.employees (id) on delete cascade,
  kind         text not null
                 check (kind in ('Vacaciones', 'Incapacidad', 'Permiso', 'Licencia', 'Cita médica', 'Otro')),
  starts_on    date not null,
  ends_on      date not null,
  status       text not null default 'Programada'
                 check (status in ('Programada', 'Activa', 'Finalizada', 'Resuelta', 'Rechazada')),
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (org_id, code),
  constraint absences_range_ordered check (ends_on >= starts_on)
);

-- Derived, not stored: the mock kept `days` as a writable field that could
-- drift out of sync with the range it was supposed to describe.
alter table public.absences
  add column days int generated always as ((ends_on - starts_on) + 1) stored;

create index absences_org_idx on public.absences (org_id, starts_on desc) where deleted_at is null;
create index absences_emp_idx on public.absences (employee_id);

create trigger absences_code  before insert on public.absences
  for each row execute function app.set_code('absence', 'AUS', '4');
create trigger absences_touch before update on public.absences
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('absences', 'asistencia:read', 'asistencia:write');

create table public.vacation_balances (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  employee_id     uuid not null references public.employees (id) on delete cascade,
  year            int  not null check (year between 2000 and 2100),
  entitled_days   numeric(5,1) not null default 15 check (entitled_days >= 0),
  taken_days      numeric(5,1) not null default 0  check (taken_days >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (employee_id, year)
);

alter table public.vacation_balances
  add column available_days numeric(5,1) generated always as (entitled_days - taken_days) stored;

create trigger vacation_balances_touch before update on public.vacation_balances
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('vacation_balances', 'asistencia:read', 'asistencia:write');

-- ─── Payroll ────────────────────────────────────────────────────────────────
-- All money is bigint minor units (centavos COP). `hseq.monto` was a string in
-- the mock; everything monetary is numeric here.

create table public.payroll_periods (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  code        text,
  period      date not null,   -- first day of the payroll month
  status      text not null default 'Borrador'
                check (status in ('Borrador', 'En revisión', 'Aprobada', 'Pagada')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, period),
  unique (org_id, code)
);

create trigger payroll_periods_code  before insert on public.payroll_periods
  for each row execute function app.set_code('payroll_period', 'NOM', '4');
create trigger payroll_periods_touch before update on public.payroll_periods
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('payroll_periods', 'nomina:read', 'nomina:write');

create table public.payroll_lines (
  id                 uuid primary key default gen_random_uuid(),
  payroll_period_id  uuid not null references public.payroll_periods (id) on delete cascade,
  employee_id        uuid not null references public.employees (id) on delete restrict,
  gross_cents        bigint not null default 0 check (gross_cents >= 0),
  deductions_cents   bigint not null default 0 check (deductions_cents >= 0),
  created_at         timestamptz not null default now(),
  unique (payroll_period_id, employee_id)
);

alter table public.payroll_lines
  add column net_cents bigint generated always as (gross_cents - deductions_cents) stored;

select app.apply_child_rls('payroll_lines', 'payroll_periods', 'payroll_period_id',
                           'nomina:read', 'nomina:write');

create table public.benefits (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  name               text not null,
  kind               text not null default 'Otro'
                       check (kind in ('Salud', 'Alimentación', 'Seguro', 'Transporte', 'Educación', 'Otro')),
  monthly_cost_cents bigint not null default 0 check (monthly_cost_cents >= 0),
  coverage_pct       smallint not null default 100 check (coverage_pct between 0 and 100),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  unique (org_id, name)
);

create trigger benefits_touch before update on public.benefits
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('benefits', 'nomina:read', 'nomina:write');

-- ─── Evaluations ────────────────────────────────────────────────────────────

create table public.evaluations (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  code              text,
  employee_id       uuid not null references public.employees (id) on delete cascade,
  evaluator_id      uuid references public.employees (id) on delete set null,
  period_label      text not null default '',
  score             numeric(3,1) check (score is null or score between 0 and 5),
  objectives_done   smallint not null default 0 check (objectives_done >= 0),
  objectives_total  smallint not null default 0 check (objectives_total >= 0),
  status            text not null default 'Pendiente'
                      check (status in ('Pendiente', 'En revisión', 'Completada')),
  evaluated_on      date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, code)
);

create trigger evaluations_code  before insert on public.evaluations
  for each row execute function app.set_code('evaluation', 'EV', '4');
create trigger evaluations_touch before update on public.evaluations
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('evaluations', 'empleados:read', 'empleados:write');

-- ─── Risks & recommendations ────────────────────────────────────────────────
-- The mock had two disjoint `tipo` vocabularies (one in the seed, another in
-- the create form). Unified here into one category list.

create table public.risks (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  code         text,
  category     text not null
                 check (category in ('Contractual', 'Operacional', 'Cumplimiento', 'Financiero',
                                     'Técnico', 'HSE', 'Rotación', 'Desempeño', 'Sucesión',
                                     'Salud', 'Legal', 'Otro')),
  title        text not null default '',
  employee_id  uuid references public.employees (id) on delete set null,
  area         text not null default '',
  severity     text not null check (severity in ('Alta', 'Media', 'Baja')),
  detail       text not null default '',
  action       text not null default '',
  status       text not null default 'Abierto'
                 check (status in ('Abierto', 'Mitigado', 'Cerrado')),
  due_on       date,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (org_id, code)
);

create index risks_org_idx on public.risks (org_id, severity) where deleted_at is null and status = 'Abierto';

create trigger risks_code  before insert on public.risks
  for each row execute function app.set_code('risk', 'R', '4');
create trigger risks_touch before update on public.risks
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('risks', 'riesgos:read', 'riesgos:write');

create table public.recommendations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  priority    text not null check (priority in ('Urgente', 'Importante', 'Pronto')),
  category    text not null default 'Otro',
  title       text not null,
  reason      text not null default '',
  status      text not null default 'Abierta' check (status in ('Abierta', 'Aplicada', 'Descartada')),
  -- Distinguishes AI-generated suggestions from ones a human wrote.
  source      text not null default 'sistema' check (source in ('sistema', 'ia', 'manual')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger recommendations_touch before update on public.recommendations
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('recommendations', 'riesgos:read', 'riesgos:write');

-- ─── Recruitment ────────────────────────────────────────────────────────────

create table public.job_openings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  code          text,
  title         text not null,
  department    text not null default '',
  employment_type text not null default 'Tiempo completo'
                    check (employment_type in ('Tiempo completo', 'Medio tiempo', 'Contrato', 'Prácticas')),
  status        text not null default 'Activo' check (status in ('Activo', 'Pausado', 'Cerrado')),
  opened_on     date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, code)
);

create trigger job_openings_code  before insert on public.job_openings
  for each row execute function app.set_code('job_opening', 'VAC', '4');
create trigger job_openings_touch before update on public.job_openings
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('job_openings', 'empleados:read', 'empleados:write');

create table public.candidates (
  id              uuid primary key default gen_random_uuid(),
  job_opening_id  uuid not null references public.job_openings (id) on delete cascade,
  full_name       text not null,
  email           text check (email is null or email = lower(email)),
  stage           text not null default 'Aplicación'
                    check (stage in ('Aplicación', 'Revisión', 'Entrevista', 'Oferta', 'Contratado', 'Descartado')),
  score           smallint check (score is null or score between 0 and 100),
  source          text not null default 'Otro',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index candidates_opening_idx on public.candidates (job_opening_id, stage);

create trigger candidates_touch before update on public.candidates
  for each row execute function app.touch_updated_at();

select app.apply_child_rls('candidates', 'job_openings', 'job_opening_id',
                           'empleados:read', 'empleados:write');

create table public.departures (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  employee_id  uuid references public.employees (id) on delete set null,
  full_name    text not null,
  department   text not null default '',
  reason       text not null default 'Otro'
                 check (reason in ('Renuncia voluntaria', 'Mutuo acuerdo', 'Vencimiento contrato',
                                   'Terminación con justa causa', 'Otro')),
  departed_on  date not null,
  created_at   timestamptz not null default now()
);

select app.apply_standard_rls('departures', 'empleados:read', 'empleados:write');

-- ─── Training & engagement ──────────────────────────────────────────────────

create table public.courses (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  name           text not null,
  category       text not null default 'Otro',
  duration_hours numeric(5,1) check (duration_hours is null or duration_hours > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (org_id, name)
);

create trigger courses_touch before update on public.courses
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('courses', 'empleados:read', 'empleados:write');

create table public.course_enrollments (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  employee_id  uuid not null references public.employees (id) on delete cascade,
  status       text not null default 'Inscrito'
                 check (status in ('Inscrito', 'En curso', 'Completado', 'Abandonado')),
  completed_on date,
  unique (course_id, employee_id)
);

select app.apply_child_rls('course_enrollments', 'courses', 'course_id',
                           'empleados:read', 'empleados:write');

create table public.certifications (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  employee_id  uuid references public.employees (id) on delete set null,
  name         text not null,
  provider     text not null default '',
  issued_on    date,
  expires_on   date,
  created_at   timestamptz not null default now(),
  constraint certifications_dates_ordered check (expires_on is null or issued_on is null or expires_on >= issued_on)
);

select app.apply_standard_rls('certifications', 'empleados:read', 'empleados:write');

create table public.surveys (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  name           text not null,
  responses      int not null default 0 check (responses >= 0),
  score          numeric(4,1) check (score is null or score between -100 and 100),
  closed_on      date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger surveys_touch before update on public.surveys
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('surveys', 'empleados:read', 'empleados:write');
