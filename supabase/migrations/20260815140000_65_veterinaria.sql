-- ═══════════════════════════════════════════════════════════════════════════
-- 65 — Veterinaria: mascotas, vacunas y hospitalización
--
-- `salud-veterinaria` existe en el catálogo desde la migración 29 y su delta
-- era `+catalogos, +tienda, +pos, −trazabilidad`. La pantalla de
-- `pacientes` le servía una historia clínica genérica — correcta para un
-- consultorio humano e insuficiente para una veterinaria, cuyo trabajo se
-- organiza alrededor de una cosa que no existía: la mascota.
--
-- El mapa es: `patients` = el propietario (la persona que paga y a quien se
-- llama), `vet_pets` = el paciente (la mascota). El resto cuelga de la mascota:
-- las vacunas son el carné que una veterinaria mira primero y la
-- hospitalización es el estado de cada animal interno.
--
-- Mismo contrato que la migración 45 (odontología): nada de esto es un módulo
-- nuevo ni un permiso nuevo — vive bajo `pacientes:read` / `pacientes:write`
-- y se muestra o no según el subsector, que es presentación y no acceso.
-- `org_id` propio en las tablas de las que cuelgan hijos, porque
-- `app.apply_child_rls` lee `parent.org_id` y un nieto de `patients` no tiene
-- de dónde heredar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── La mascota ─────────────────────────────────────────────────────────────

create table public.vet_pets (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  -- El propietario es un paciente de la clínica: a él se llama, a él se le
  -- cobra. La mascota es el paciente clínico.
  patient_id  uuid not null references public.patients (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 120),
  species     text not null default 'Perro'
              check (species in ('Perro', 'Gato', 'Ave', 'Equino', 'Bovino', 'Exótico', 'Otro')),
  breed       text not null default '',
  sex         text not null default 'Desconocido'
              check (sex in ('Macho', 'Hembra', 'Desconocido')),
  birth_date  date,
  weight_kg   numeric(6,2) check (weight_kg is null or weight_kg > 0),
  color       text not null default '',
  microchip   text not null default '',
  status      text not null default 'Activo'
              check (status in ('Activo', 'Fallecido', 'Adoptado', 'Perdido')),
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, patient_id, name)
);

create index vet_pets_org_idx on public.vet_pets (org_id, name) where deleted_at is null;
create index vet_pets_owner_idx on public.vet_pets (patient_id) where deleted_at is null;

create trigger vet_pets_touch before update on public.vet_pets
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('vet_pets', 'pacientes:read', 'pacientes:write');

comment on table public.vet_pets is
  'Mascotas de la veterinaria. El propietario es el paciente (patients); la '
  'mascota es el paciente clínico.';

-- ─── Vacunas ────────────────────────────────────────────────────────────────

/**
 * El carné de vacunación de la mascota.
 *
 * Una fila por aplicación, no un estado que se sobrescribe: la historia dice
 * cuándo se puso cada dosis y cuándo toca la siguiente — `next_due_on` es la
 * lista de recuerdo con la que trabaja la recepción.
 */
create table public.vet_vaccines (
  id              uuid primary key default gen_random_uuid(),
  pet_id          uuid not null references public.vet_pets (id) on delete cascade,
  vaccine         text not null check (length(btrim(vaccine)) between 1 and 120),
  administered_on date not null default current_date,
  next_due_on     date,
  batch           text not null default '',
  professional_id uuid references public.employees (id) on delete set null,
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  check (next_due_on is null or next_due_on >= administered_on)
);

create index vet_vaccines_pet_idx on public.vet_vaccines (pet_id, administered_on desc);
-- La lista de recuerdo: qué refuerzos vencen pronto o ya vencieron.
create index vet_vaccines_due_idx on public.vet_vaccines (next_due_on);

select app.apply_child_rls('vet_vaccines', 'vet_pets', 'pet_id',
                           'pacientes:read', 'pacientes:write');

comment on table public.vet_vaccines is
  'Carné de vacunación de la mascota: una fila por aplicación, con la fecha '
  'del próximo refuerzo.';

-- ─── Hospitalización ────────────────────────────────────────────────────────

/**
 * El animal interno: desde que entra hasta que sale.
 *
 * `org_id` propio porque de aquí cuelgan las notas de evolución
 * (`app.apply_child_rls` necesita un `org_id` en el padre).
 */
create table public.vet_hospitalizations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  pet_id        uuid not null references public.vet_pets (id) on delete cascade,
  admission_on  timestamptz not null default now(),
  discharge_on  timestamptz,
  reason        text not null check (length(btrim(reason)) between 2 and 300),
  status        text not null default 'Hospitalizado'
                check (status in ('Hospitalizado', 'Alta', 'Fallecido')),
  kennel        text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (discharge_on is null or discharge_on >= admission_on)
);

create index vet_hospitalizations_pet_idx
  on public.vet_hospitalizations (pet_id, admission_on desc);
-- La pantalla pregunta primero: ¿quién está adentro ahora?
create index vet_hospitalizations_open_idx
  on public.vet_hospitalizations (status) where status = 'Hospitalizado';

create trigger vet_hospitalizations_touch before update on public.vet_hospitalizations
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('vet_hospitalizations', 'pacientes:read', 'pacientes:write');

comment on table public.vet_hospitalizations is
  'Animales internos en la veterinaria: ingreso, estado y alta.';

create table public.vet_hospitalization_notes (
  id                uuid primary key default gen_random_uuid(),
  hospitalization_id uuid not null references public.vet_hospitalizations (id) on delete cascade,
  note              text not null check (length(btrim(note)) between 1 and 500),
  noted_at          timestamptz not null default now(),
  created_by        uuid,
  created_at        timestamptz not null default now()
);

create index vet_hosp_notes_hosp_idx
  on public.vet_hospitalization_notes (hospitalization_id, noted_at desc);

select app.apply_child_rls('vet_hospitalization_notes', 'vet_hospitalizations', 'hospitalization_id',
                           'pacientes:read', 'pacientes:write');

comment on table public.vet_hospitalization_notes is
  'Notas de evolución de un animal hospitalizado.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop table if exists public.vet_hospitalization_notes cascade;
--   drop table if exists public.vet_hospitalizations cascade;
--   drop table if exists public.vet_vaccines cascade;
--   drop table if exists public.vet_pets cascade;
-- ═══════════════════════════════════════════════════════════════════════════
