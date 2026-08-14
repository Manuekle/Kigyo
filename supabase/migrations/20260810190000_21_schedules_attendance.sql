-- ═══════════════════════════════════════════════════════════════════════════
-- 21 — Schedules and attendance (horarios y asistencia) for educación
--
-- The estudiantes module knows who is enrolled and how they are graded, but
-- not where they are supposed to be. `class_schedules` is the weekly grid a
-- school actually runs on: subject, teacher, day, time window and classroom.
-- `student_attendance` is the daily roll, keyed by (student, date) so the
-- same day cannot be marked twice any way the data arrives.
--
-- Both are top-level entities of the estudiantes module: a schedule belongs
-- to the school, not to a single enrollment, and attendance is a daily record
-- independent of any one class. Standard RLS under the module's existing
-- permission pair keeps the single-permission-per-module rule intact.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.class_schedules (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  program_id   uuid references public.academic_programs (id) on delete set null,
  subject      text not null,
  teacher_id   uuid references public.employees (id) on delete set null,
  weekday      text not null
                 check (weekday in ('Lunes', 'Martes', 'Miércoles', 'Jueves',
                                     'Viernes', 'Sábado', 'Domingo')),
  start_time   time not null,
  end_time     time not null,
  classroom    text not null default '',
  created_at   timestamptz not null default now(),
  constraint class_schedules_hours_ordered check (end_time > start_time)
);

create index class_schedules_weekday_idx
  on public.class_schedules (org_id, weekday, start_time);

select app.apply_standard_rls('class_schedules', 'estudiantes:read', 'estudiantes:write');

create table public.student_attendance (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  schedule_id  uuid references public.class_schedules (id) on delete set null,
  date         date not null,
  present      boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (student_id, date)
);

create index student_attendance_date_idx
  on public.student_attendance (org_id, date);

select app.apply_standard_rls('student_attendance', 'estudiantes:read', 'estudiantes:write');