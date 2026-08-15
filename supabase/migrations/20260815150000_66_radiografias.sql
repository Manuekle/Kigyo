-- ═══════════════════════════════════════════════════════════════════════════
-- 66 — Radiografías: imágenes de estudio por paciente
--
-- La imagen diagnóstica del paciente (radiografía, ultrasonido, tomografía)
-- vive en un bucket privado propio, no en el bucket de documentos: son cosas
-- distintas con vidas distintas — un estudio se ve en una galería clínica,
-- pesa decenas de MB y caduca como dato diagnóstico; un contrato se descarga
-- y se firma. Compartir bucket obligaría a mezclar políticas y a filtrar por
-- extensión en cada consulta.
--
-- El patrón es el de la migración 07: bucket privado, claves
-- `{org_id}/{uuid}-{archivo}` y políticas que fijan el primer segmento a una
-- organización del llamante. La lectura de UI es por URL firmada de 60
-- segundos, emitida en el servidor tras el permiso — un key filtrado no es un
-- estudio filtrado.
--
-- La tabla es profundidad de `pacientes` (patrón 45/65): permisos
-- `pacientes:read` / `pacientes:write`, sin módulo nuevo. La pestaña
-- «Imágenes» se muestra en todas las ramas de salud, no solo en las
-- radiológicas: una foto de una lesión en la historia clínica la necesita
-- tanto el veterinario como el odontólogo.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'radiographs', 'radiographs', false,
  20971520,  -- 20 MB por estudio
  array['image/png', 'image/jpeg', 'image/webp', 'application/dicom', 'image/dicom-rle']
) on conflict (id) do nothing;

create policy "radiographs read within org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'radiographs'
    and (storage.foldername(name))[1]::uuid in (select app.orgs_with('pacientes:read'))
  );

create policy "radiographs write within org"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'radiographs'
    and (storage.foldername(name))[1]::uuid in (select app.orgs_with('pacientes:write'))
  );

create policy "radiographs update within org"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'radiographs'
    and (storage.foldername(name))[1]::uuid in (select app.orgs_with('pacientes:write'))
  )
  with check (
    bucket_id = 'radiographs'
    and (storage.foldername(name))[1]::uuid in (select app.orgs_with('pacientes:write'))
  );

create policy "radiographs delete within org"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'radiographs'
    and (storage.foldername(name))[1]::uuid in (select app.orgs_with('pacientes:write'))
  );

create table public.patient_images (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  patient_id   uuid not null references public.patients (id) on delete cascade,
  kind         text not null default 'Radiografía'
               check (kind in ('Radiografía', 'Ultrasonido', 'Tomografía', 'Fotografía', 'Otro')),
  study        text not null check (length(btrim(study)) between 2 and 200),
  taken_on     date not null default current_date,
  storage_path text not null,
  mime_type    text,
  size_bytes   bigint not null default 0 check (size_bytes >= 0),
  notes        text not null default '',
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index patient_images_patient_idx
  on public.patient_images (org_id, patient_id, taken_on desc);

create trigger patient_images_touch before update on public.patient_images
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('patient_images', 'pacientes:read', 'pacientes:write');

comment on table public.patient_images is
  'Imágenes diagnósticas del paciente. El objeto vive en el bucket '
  'radiographs; aquí solo el registro clínico.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop table if exists public.patient_images cascade;
--   drop policy if exists "radiographs read within org" on storage.objects;
--   drop policy if exists "radiographs write within org" on storage.objects;
--   drop policy if exists "radiographs update within org" on storage.objects;
--   drop policy if exists "radiographs delete within org" on storage.objects;
--   delete from storage.buckets where id = 'radiographs';
-- ═══════════════════════════════════════════════════════════════════════════
