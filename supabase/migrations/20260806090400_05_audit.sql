-- ═══════════════════════════════════════════════════════════════════════════
-- 05 — Audit trail.
--
-- The trazabilidad screen used to render a hardcoded list. It now reads this
-- table, which is filled by a trigger rather than by application code: an
-- audit log the app can forget to write is not an audit log.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.audit_log (
  id           bigint generated always as identity primary key,
  org_id       uuid not null references public.organizations (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  -- Denormalised so the entry survives the actor being deleted.
  actor_email  text,
  action       text not null check (action in ('insert', 'update', 'delete')),
  table_name   text not null,
  record_id    uuid,
  record_code  text,
  -- Only the columns that actually changed, so the log stays readable and
  -- does not duplicate the row on every touch.
  changes      jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now()
);

create index audit_log_org_idx    on public.audit_log (org_id, occurred_at desc);
create index audit_log_record_idx on public.audit_log (table_name, record_id);

alter table public.audit_log enable row level security;
alter table public.audit_log force  row level security;

create policy audit_log_select on public.audit_log
  for select to authenticated
  using (org_id in (select app.orgs_with('trazabilidad:read')));

-- No insert/update/delete policy: rows arrive only through the SECURITY
-- DEFINER trigger below, and nothing may rewrite history afterwards.

create or replace function app.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id  uuid;
  v_changes jsonb := '{}'::jsonb;
  v_old     jsonb;
  v_new     jsonb;
  v_key     text;
  v_email   text;
  v_code    text;
begin
  if tg_op = 'DELETE' then
    v_org_id := old.org_id;
  else
    v_org_id := new.org_id;
  end if;

  select p.email into v_email
  from public.profiles p
  where p.id = (select auth.uid());

  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_changes := jsonb_build_object('after', v_new - 'created_at' - 'updated_at');
    v_code := v_new ->> 'code';

  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_code := v_new ->> 'code';

    for v_key in select jsonb_object_keys(v_new) loop
      if v_key not in ('updated_at', 'created_at')
         and (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_changes := v_changes || jsonb_build_object(
          v_key,
          jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key)
        );
      end if;
    end loop;

    -- A no-op update is not worth an audit row.
    if v_changes = '{}'::jsonb then
      return new;
    end if;

  else
    v_old := to_jsonb(old);
    v_changes := jsonb_build_object('before', v_old - 'created_at' - 'updated_at');
    v_code := v_old ->> 'code';
  end if;

  insert into public.audit_log (
    org_id, actor_id, actor_email, action, table_name, record_id, record_code, changes
  )
  values (
    v_org_id,
    (select auth.uid()),
    v_email,
    lower(tg_op),
    tg_table_name,
    coalesce((to_jsonb(coalesce(new, old)) ->> 'id')::uuid, null),
    v_code,
    v_changes
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Attach to every org-scoped business table that has an `id` and an `org_id`.
create or replace function app.enable_audit(p_table text)
returns void
language plpgsql
as $$
begin
  execute format(
    'create trigger %I after insert or update or delete on public.%I
       for each row execute function app.audit_row()',
    p_table || '_audit', p_table
  );
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'employees', 'absences', 'vacation_balances', 'payroll_periods', 'benefits',
    'evaluations', 'risks', 'recommendations', 'job_openings', 'departures',
    'courses', 'certifications', 'surveys',
    'projects', 'products', 'quotes', 'purchase_requests', 'purchase_orders',
    'inventory_assets', 'supplier_invoices', 'inventory_orders',
    'document_folders', 'documents', 'signature_requests',
    'hseq_reports', 'tickets', 'channels', 'calendar_events', 'consultations'
  ] loop
    perform app.enable_audit(t);
  end loop;
end;
$$;
