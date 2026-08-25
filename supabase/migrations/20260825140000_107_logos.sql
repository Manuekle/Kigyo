-- ═══════════════════════════════════════════════════════════════════════════
-- 107 · El logo de la empresa deja de ser un botón muerto
-- ═══════════════════════════════════════════════════════════════════════════
--
-- «Cambiar logo», en Configuración → Empresa, contestaba
-- `addToast('Selector de logo próximamente', 'info')`. Era el último control
-- del producto que no hacía nada, y no por falta de sitio donde guardarlo:
-- `organizations.branding` acepta `logo_url` desde la migración 30 y
-- `updateBranding` (`mutations/onboarding.ts`) ya sabía escribirlo — era otra
-- de las funciones que existían y que ninguna pantalla llamaba. Lo que faltaba
-- era el bucket.
--
-- ─── Por qué un bucket propio y no `documents` ────────────────────────────
--
-- `documents` está gobernado por `documentos:read` / `documentos:write`, que es
-- el permiso del módulo Documentos — un módulo que una empresa puede tener
-- apagado. Colgar el logo de ahí ataría la marca de la empresa a un módulo que
-- no tiene nada que ver, y una empresa que apaga Documentos perdería su propio
-- logo del recibo del POS.
--
-- El permiso correcto es `configuracion:manage`, que es el que ya decide quién
-- puede renombrar la empresa y cambiar sus datos fiscales. El logo es eso: un
-- dato de identidad de la empresa.
--
-- ─── La ruta ──────────────────────────────────────────────────────────────
--
-- `{org_id}/logo`, exactamente igual que `avatars` usa `{user_id}/avatar`:
-- siempre el mismo nombre, así que subir uno nuevo pisa el anterior. Sin
-- huérfanos que limpiar y sin URLs viejas que sigan resolviendo.
--
-- Privado, como los otros tres. La lectura sale por URL firmada, igual que el
-- avatar — un bucket público sería una lista de los logos de todos los clientes
-- de Kigyo servida sin autenticación.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('logos', 'logos', false)
on conflict (id) do nothing;

-- ─── Políticas ─────────────────────────────────────────────────────────────
--
-- Calcadas de las de `documents` salvo por el permiso y por la lectura: la
-- primera carpeta del nombre es el `org_id`, y `app.orgs_with(...)` contesta de
-- qué empresas puede el llamante hacer esa cosa. Es el mismo plano de
-- aislamiento que el resto del storage y no se inventa uno nuevo.

drop policy if exists "logos read within org" on storage.objects;
create policy "logos read within org" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'logos'
    -- Leer el logo NO exige poder administrar: cualquiera de la empresa lo ve,
    -- porque aparece en el recibo, en el encabezado y en los documentos que
    -- imprime gente que no administra nada. `configuracion:read` es lo que ya
    -- tiene todo el mundo dentro de una empresa.
    and ((storage.foldername(name))[1])::uuid in (select app.orgs_with('configuracion:read'))
  );

drop policy if exists "logos write within org" on storage.objects;
create policy "logos write within org" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and ((storage.foldername(name))[1])::uuid in (select app.orgs_with('configuracion:manage'))
  );

drop policy if exists "logos update within org" on storage.objects;
create policy "logos update within org" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and ((storage.foldername(name))[1])::uuid in (select app.orgs_with('configuracion:manage'))
  )
  with check (
    bucket_id = 'logos'
    and ((storage.foldername(name))[1])::uuid in (select app.orgs_with('configuracion:manage'))
  );

drop policy if exists "logos delete within org" on storage.objects;
create policy "logos delete within org" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and ((storage.foldername(name))[1])::uuid in (select app.orgs_with('configuracion:manage'))
  );

-- ─── Comprobación ──────────────────────────────────────────────────────────

do $$
declare v_n int;
begin
  if not exists (select 1 from storage.buckets where id = 'logos' and public = false) then
    raise exception 'el bucket logos no existe o quedó público';
  end if;

  select count(*) into v_n
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname like 'logos %';
  if v_n <> 4 then
    raise exception 'se esperaban 4 políticas de logos, hay %', v_n;
  end if;
end;
$$;

-- ─── Rollback ──────────────────────────────────────────────────────────────
--
--   drop policy if exists "logos read within org"   on storage.objects;
--   drop policy if exists "logos write within org"  on storage.objects;
--   drop policy if exists "logos update within org" on storage.objects;
--   drop policy if exists "logos delete within org" on storage.objects;
--   delete from storage.objects where bucket_id = 'logos';
--   delete from storage.buckets where id = 'logos';
