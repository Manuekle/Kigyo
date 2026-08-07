-- ═══════════════════════════════════════════════════════════════════════════
-- 08 — Table privileges.
--
-- A Supabase project grants ALL on every public table to both `anon` and
-- `authenticated` by default and leans entirely on RLS to filter. That means a
-- table shipped without RLS is world-readable through the anon key.
--
-- This migration makes the grants explicit instead: `anon` gets nothing in
-- `public`, `authenticated` gets DML and is still filtered by RLS. Forgetting
-- a policy then fails closed rather than open.
-- ═══════════════════════════════════════════════════════════════════════════

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Same treatment for tables added by later migrations.
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- Reference tables are read-only for everyone but service_role: role and
-- permission catalogues are part of the schema, not tenant data.
revoke insert, update, delete on public.roles       from authenticated;
revoke insert, update, delete on public.permissions from authenticated;

-- The audit trail is append-only, and only the trigger appends.
revoke insert, update, delete on public.audit_log from authenticated;

-- The `app` schema holds security-definer machinery, never client-facing rows.
revoke all on all tables in schema app from anon, authenticated;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, which would let any
-- signed-in user invoke privileged internals directly through PostgREST.
-- Clawed back one by one; `app.orgs_with` and friends are re-granted in
-- migration 01 because RLS policies need them.
revoke all on function public.handle_new_user()                     from public, anon, authenticated;
revoke all on function app.seed_default_permissions(uuid)           from public, anon, authenticated;
revoke all on function app.next_code(uuid, text, text, int)         from public, anon, authenticated;
revoke all on function app.set_code()                               from public, anon, authenticated;
revoke all on function app.audit_row()                              from public, anon, authenticated;
revoke all on function app.guard_last_admin()                       from public, anon, authenticated;
revoke all on function app.apply_standard_rls(text, text, text)     from public, anon, authenticated;
revoke all on function app.apply_child_rls(text, text, text, text, text)
                                                                    from public, anon, authenticated;
revoke all on function app.enable_audit(text)                       from public, anon, authenticated;
