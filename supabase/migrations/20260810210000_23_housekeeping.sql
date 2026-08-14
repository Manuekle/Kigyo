-- ═══════════════════════════════════════════════════════════════════════════
-- 23 — Housekeeping tasks (limpieza) for hoteleria
--
-- The hoteleria module has rooms with a «Limpieza» status and reservations to
-- turn them around, but nothing says who cleans which room when. Room status
-- is a snapshot; `room_cleaning_tasks` is the plan and the proof — a boarding
-- house runs on the sheet that says «Suite 12, ropa, martes, Ana».
--
-- The task is a child of the room: a cleaning for a deleted room is a chore
-- for nobody. Child RLS reads the parent's tenant boundary, and the module
-- keeps its single permission pair. Rates were already covered — `rate_cents`
-- is an editable column on `hotel_rooms`; this migration only adds the work
-- sheet.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.room_cleaning_tasks (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.hotel_rooms (id) on delete cascade,
  assigned_id uuid references public.employees (id) on delete set null,
  kind        text not null default 'Limpieza'
                check (kind in ('Limpieza', 'Cambio de ropa', 'Revisión', 'Aseo profundo')),
  scheduled_on date not null default current_date,
  done        boolean not null default false,
  done_on     date,
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

create index room_cleaning_tasks_schedule_idx
  on public.room_cleaning_tasks (room_id, scheduled_on, done);

select app.apply_child_rls('room_cleaning_tasks', 'hotel_rooms', 'room_id',
                           'hoteleria:read', 'hoteleria:write');