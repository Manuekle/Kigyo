-- ═══════════════════════════════════════════════════════════════════════════
-- 07 — Storage.
--
-- Two private buckets. Nothing here is public: reads go through short-lived
-- signed URLs minted server-side after a permission check, so an object key
-- leaking is not the same as the file leaking.
--
-- Object key layout is `{org_id}/{...}`, and every policy pins the first path
-- segment to an organization the caller belongs to.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'documents', 'documents', false,
    52428800,  -- 50 MB
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv',
      'image/png', 'image/jpeg', 'image/webp'
    ]
  ),
  (
    'avatars', 'avatars', false,
    2097152,   -- 2 MB
    array['image/png', 'image/jpeg', 'image/webp']
  )
on conflict (id) do nothing;

-- ─── documents bucket ───────────────────────────────────────────────────────

create policy "documents read within org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select app.orgs_with('documentos:read'))
  );

create policy "documents write within org"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select app.orgs_with('documentos:write'))
  );

create policy "documents update within org"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select app.orgs_with('documentos:write'))
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select app.orgs_with('documentos:write'))
  );

create policy "documents delete within org"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select app.orgs_with('documentos:write'))
  );

-- ─── avatars bucket ─────────────────────────────────────────────────────────
-- Keyed by user id, not organization: you manage your own avatar, and anyone
-- who shares an organization with you can see it.

create policy "avatars read within org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.memberships m
        where m.user_id::text = (storage.foldername(name))[1]
          and m.org_id in (select app.current_org_ids())
      )
    )
  );

create policy "avatars manage own"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
