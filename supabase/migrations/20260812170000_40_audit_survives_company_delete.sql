-- ═══════════════════════════════════════════════════════════════════════════
-- 40 — Borrar una empresa chocaba con su propia auditoría
--
-- Second half of the same bug migration 39 fixed. With the payroll foreign key
-- cascading, deleting a company got one step further and hit this:
--
--     insert or update on table "audit_log" violates foreign key constraint
--     "audit_log_org_id_fkey"
--
-- The sequence is a small trap, and it is nobody's mistake in particular:
--
--   1. `delete from organizations where id = X` removes the company row;
--   2. Postgres runs the ON DELETE CASCADE actions, deleting rows from the 66
--      business tables;
--   3. every one of those deletes fires `app.audit_row`, which faithfully
--      records "someone deleted this" — with `org_id = X`;
--   4. company X no longer exists, so the foreign key refuses the insert and
--      the whole delete aborts.
--
-- The audit trigger is doing exactly what it was built to do. What is missing
-- is that a company being deleted has nobody left to read its trail: the
-- `audit_log` rows cascade away in the same statement. Writing entries into a
-- log that is being destroyed is work whose only effect is to make the delete
-- impossible.
--
-- ─── El arreglo ────────────────────────────────────────────────────────────
--
-- One guard at the top of the trigger: if the company is already gone, this
-- delete is part of the company's own removal, so return without recording.
-- Every other audited operation is untouched — an ordinary delete of an
-- invoice, with the company alive, still writes its row exactly as before.
--
-- Cheap by construction: the lookup is a primary-key hit and it only runs on
-- DELETE, which is the rarest of the three operations and the only one that
-- can be in this position.
-- ═══════════════════════════════════════════════════════════════════════════

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

  /**
   * The company is being deleted, and this row is going with it.
   *
   * `audit_log.org_id` cascades from `organizations`, so the trail for this
   * company is disappearing in the very same statement. Recording into it
   * would not preserve anything — it would only violate the foreign key and
   * abort the delete, which is precisely what it did.
   *
   * Only reachable during a cascade: an ordinary DELETE of a business row
   * happens while its company exists, and takes the branch below as always.
   */
  if tg_op = 'DELETE' and not exists (
    select 1 from public.organizations o where o.id = v_org_id
  ) then
    return old;
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
    case when tg_op = 'DELETE' then (v_old ->> 'id')::uuid else (v_new ->> 'id')::uuid end,
    v_code,
    v_changes
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
-- Restore app.audit_row from migration 05 verbatim. Reverting brings back the
-- undeletable company.
-- ═══════════════════════════════════════════════════════════════════════════
