-- ═══════════════════════════════════════════════════════════════════════════
-- 17 — Widen patient_visits.kind to the full clinical vocabulary
--
-- Migration 16 introduced `patient_appointments.kind` with
-- ('Consulta','Control','Vacunación','Examen','Otro'). When a clinic converts
-- a turno into a visit («Atender»), the visit must keep the appointment's
-- kind — a vaccination visit that turned into «Procedimiento» would corrupt
-- the very report the kind column exists to serve. So the visit vocabulary
-- becomes the union of both lists, mirrored in src/lib/domain.ts VISIT_KINDS.
--
-- The constraint is dropped and recreated on purpose: Postgres names the
-- inline check `patient_visits_kind_check`, and renaming it would leave a
-- second constraint to keep in sync forever.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.patient_visits
  drop constraint patient_visits_kind_check;

alter table public.patient_visits
  add constraint patient_visits_kind_check
  check (kind in ('Consulta', 'Control', 'Urgencia', 'Procedimiento',
                  'Teleconsulta', 'Vacunación', 'Examen', 'Otro'));