-- ═══════════════════════════════════════════════════════════════════════════
-- 09 — Backfill accounts that predate the schema.
--
-- `handle_new_user` fires on INSERT into auth.users, so it only ever runs for
-- signups that happen *after* migration 01. Any account created before that —
-- while testing the Supabase project, during a partial rollout, or restored
-- from an auth backup — ends up with no profile, no organization and no
-- membership.
--
-- That failure is silent and permanent: the account authenticates fine, then
-- `getMember()` finds no membership, `requireMember()` redirects to /login,
-- and the person loops between the two with nothing to explain why.
--
-- This runs the same logic once over whatever already exists. It is idempotent
-- and safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.backfill_orphan_accounts()
-- The OUT columns are prefixed: unprefixed names would become plpgsql
-- variables that shadow the identically-named columns on invitations and
-- profiles, turning every reference into an ambiguity error.
returns table (repaired_user_id uuid, repaired_email text, repaired_org_id uuid, repaired_action text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  u          record;
  v_name     text;
  v_company  text;
  v_slug     text;
  v_org_id   uuid;
  v_invite   public.invitations%rowtype;
  n          int;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    where au.email is not null
      and not exists (select 1 from public.memberships m where m.user_id = au.id)
    order by au.created_at
  loop
    v_name := coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      split_part(u.email, '@', 1)
    );

    insert into public.profiles (id, email, full_name)
    values (u.id, lower(u.email), v_name)
    on conflict (id) do nothing;

    -- An outstanding invitation still wins over creating a new organization,
    -- exactly as it does on a live signup.
    select inv.* into v_invite
    from public.invitations inv
    where inv.email = lower(u.email)
      and inv.accepted_at is null
      and inv.expires_at > now()
    order by inv.created_at desc
    limit 1;

    if found then
      insert into public.memberships (org_id, user_id, role)
      values (v_invite.org_id, u.id, v_invite.role)
      on conflict (org_id, user_id) do nothing;

      update public.invitations inv set accepted_at = now() where inv.id = v_invite.id;

      repaired_user_id := u.id;
      repaired_email := u.email;
      repaired_org_id := v_invite.org_id;
      repaired_action := 'unido por invitación';
      return next;
      continue;
    end if;

    v_company := coalesce(nullif(btrim(u.raw_user_meta_data ->> 'company'), ''), v_name);

    v_slug := app.slugify(v_company);
    n := 0;
    while exists (select 1 from public.organizations o where o.slug = v_slug) loop
      n := n + 1;
      v_slug := app.slugify(v_company) || '-' || n::text;
    end loop;

    insert into public.organizations (name, slug, industry)
    values (v_company, v_slug, nullif(btrim(u.raw_user_meta_data ->> 'industry'), ''))
    returning id into v_org_id;

    insert into public.memberships (org_id, user_id, role)
    values (v_org_id, u.id, 'Administrador');

    perform app.seed_default_permissions(v_org_id);

    repaired_user_id := u.id;
    repaired_email := u.email;
    repaired_org_id := v_org_id;
    repaired_action := 'organización creada';
    return next;
  end loop;
end;
$$;

revoke all on function app.backfill_orphan_accounts() from public, anon, authenticated;
grant execute on function app.backfill_orphan_accounts() to service_role;

-- Run it now, for accounts that already exist at migration time.
do $$
declare
  v_count int;
begin
  select count(*) into v_count from app.backfill_orphan_accounts();
  if v_count > 0 then
    raise notice 'backfill: % cuenta(s) sin organización reparada(s)', v_count;
  end if;
end;
$$;
