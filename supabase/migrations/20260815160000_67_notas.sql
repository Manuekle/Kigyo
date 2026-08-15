-- ═══════════════════════════════════════════════════════════════════════════
-- 67 — Notas de estudiantes: cortes ponderados y promedio por materia
--
-- `student_enrollments` ya tenía una nota final de 0 a 100 por materia, pero
-- una nota final es la conclusión de un proceso que no se podía registrar:
-- el parcial, el quiz, la tarea. El docente anotaba el número final en su
-- planilla y lo digitaba al cierre, y la pantalla no sabía decir de dónde
-- salió ni permitir corregir un corte sin rehacer la aritmética a mano.
--
-- `student_grades` es el libro de cortes: una fila por calificación con tipo
-- y ponderación opcional. Un trigger mantiene la nota de la matrícula como
-- el promedio ponderado de sus cortes (o el simple, si ninguno pondera) —
-- el mismo patrón que `app.sync_treatment_plan_total` en la 45: una cifra
-- derivada que la aplicación mantiene a mano se desincroniza el día que
-- alguien borra un corte desde otro sitio.
--
-- Profundidad de `estudiantes` (patrón 45): permisos
-- `estudiantes:read` / `estudiantes:write`, sin módulo nuevo. `org_id`
-- propio porque `student_enrollments` es hija de `students` y no tiene de
-- dónde heredar para sus nietos.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.student_grades (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  enrollment_id uuid not null references public.student_enrollments (id) on delete cascade,
  kind          text not null default 'Parcial'
                check (kind in ('Parcial', 'Corte', 'Quiz', 'Tarea', 'Examen final', 'Otro')),
  grade         numeric(5,2) not null check (grade between 0 and 100),
  -- Ponderación opcional: nula = cuenta parejo en el promedio simple.
  weight        numeric(5,2) check (weight is null or weight > 0),
  graded_on     date not null default current_date,
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index student_grades_enrollment_idx
  on public.student_grades (enrollment_id, graded_on desc);
create index student_grades_org_idx on public.student_grades (org_id);

create trigger student_grades_touch before update on public.student_grades
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('student_grades', 'estudiantes:read', 'estudiantes:write');

comment on table public.student_grades is
  'Cortes de calificación de una matrícula. La nota de la matrícula es el '
  'promedio ponderado de esto, mantenido por trigger.';

-- 100.00 no cabe en numeric(4,2): la nota perfecta desbordaba la columna.
-- Ensanchar también la nota de la matrícula, que el trigger recalcula.
alter table public.student_grades
  alter column grade type numeric(5,2);
alter table public.student_enrollments
  alter column grade type numeric(5,2);

-- ─── La nota de la matrícula es el promedio de sus cortes ───────────────────

create or replace function app.sync_enrollment_grade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment uuid := coalesce(new.enrollment_id, old.enrollment_id);
  v_grade      numeric;
begin
  -- Ponderado cuando hay pesos; simple cuando no hay ninguno. Los cortes sin
  -- peso suman parejo en el camino simple y no entran al ponderado.
  select case
    when coalesce(sum(g.weight), 0) > 0
      then sum(g.grade * coalesce(g.weight, 0)) / sum(g.weight)
    else avg(g.grade)
  end into v_grade
  from public.student_grades g
  where g.enrollment_id = v_enrollment;

  update public.student_enrollments set grade = round(v_grade, 2)
  where id = v_enrollment;
  return null;
end;
$$;

revoke all on function app.sync_enrollment_grade() from public, anon, authenticated;

create trigger student_grades_sync_enrollment
  after insert or update or delete on public.student_grades
  for each row execute function app.sync_enrollment_grade();

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop trigger if exists student_grades_sync_enrollment on public.student_grades;
--   drop function if exists app.sync_enrollment_grade();
--   drop table if exists public.student_grades cascade;
-- ═══════════════════════════════════════════════════════════════════════════
