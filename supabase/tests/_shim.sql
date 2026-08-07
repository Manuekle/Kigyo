-- Minimal stand-ins for the parts of a Supabase instance that the migrations
-- depend on, so `supabase/migrations/*.sql` can be validated against a plain
-- local Postgres 16 without Docker.
--
-- Loaded only by `scripts/db-verify.sh`. It is NOT part of the migration set
-- and never runs against a real project, where all of this already exists.

-- Roles are cluster-wide, so a previous run (or a real Supabase-like local
-- setup) may already have created them.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;

grant usage on schema public, extensions to anon, authenticated, service_role;
grant usage on schema auth to authenticated, service_role;
grant usage on schema storage to authenticated, service_role;

create extension if not exists pgcrypto with schema extensions;
alter database :"DBNAME" set search_path to public, extensions;

-- ─── auth ───────────────────────────────────────────────────────────────────

create table auth.users (
  id                   uuid primary key default gen_random_uuid(),
  email                text unique,
  encrypted_password   text,
  raw_user_meta_data   jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

-- Real Supabase reads the sub claim off the request JWT. The shim reads a GUC
-- so tests can impersonate a user with `set local request.jwt.claim.sub`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

-- ─── storage ────────────────────────────────────────────────────────────────

create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

grant execute on function storage.foldername(text) to anon, authenticated, service_role;
