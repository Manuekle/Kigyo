-- ═══════════════════════════════════════════════════════════════════════════
-- 16 — Clinical depth for the salud sector: turnos, recetas, laboratorio
--
-- The `pacientes` module shipped with the dossier (`patients`) and the visit
-- record (`patient_visits`). A clinic also works from three forward-looking
-- lists that the dossier cannot answer: what happens next (appointments),
-- what to take (prescriptions) and what to check (lab orders). All three are
-- child rows of `patients`, so they inherit their tenant boundary through
-- `app.apply_child_rls` and keep the `pacientes:read` / `pacientes:write`
-- permission pair of the module they extend — no new permissions, no new
-- modules: a clinic gets a clinical module, not a cabinet of half-modules.
--
-- Conventions inherited from migrations 02/03/15: org isolation via parent,
-- timestamps on every row, check constraints in the exact vocabulary the UI
-- speaks (accents included), indexes on the list orders the screens use.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.patient_appointments (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete cascade,
  kind            text not null default 'Consulta'
                    check (kind in ('Consulta', 'Control', 'Vacunación', 'Examen', 'Otro')),
  scheduled_for   timestamptz not null,
  professional_id uuid references public.employees (id) on delete set null,
  status          text not null default 'Programada'
                    check (status in ('Programada', 'Confirmada', 'En sala', 'Atendida', 'Cancelada', 'No asistió')),
  reason          text not null default '',
  notes           text not null default '',
  created_at      timestamptz not null default now()
);

create index patient_appointments_patient_idx
  on public.patient_appointments (patient_id, scheduled_for);
create index patient_appointments_due_idx
  on public.patient_appointments (scheduled_for, status);

select app.apply_child_rls('patient_appointments', 'patients', 'patient_id',
                           'pacientes:read', 'pacientes:write');

create table public.patient_prescriptions (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete cascade,
  professional_id uuid references public.employees (id) on delete set null,
  medication      text not null,
  dose            text not null default '',
  frequency       text not null default '',
  instructions    text not null default '',
  prescribed_on   date not null default current_date,
  created_at      timestamptz not null default now()
);

create index patient_prescriptions_patient_idx
  on public.patient_prescriptions (patient_id, prescribed_on desc);

select app.apply_child_rls('patient_prescriptions', 'patients', 'patient_id',
                           'pacientes:read', 'pacientes:write');

create table public.patient_lab_results (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients (id) on delete cascade,
  test_name     text not null,
  status        text not null default 'Solicitado'
                  check (status in ('Solicitado', 'En proceso', 'Resultado')),
  result        text not null default '',
  ordered_on    date not null default current_date,
  result_on     date,
  created_at    timestamptz not null default now()
);

create index patient_lab_results_patient_idx
  on public.patient_lab_results (patient_id, ordered_on desc);

select app.apply_child_rls('patient_lab_results', 'patients', 'patient_id',
                           'pacientes:read', 'pacientes:write');