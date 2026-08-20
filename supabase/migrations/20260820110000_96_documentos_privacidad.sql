-- ═══════════════════════════════════════════════════════════════════════════
-- 96 — Documentos: quién subió cada archivo, y quién puede verlo.
--
-- Hasta aquí el repositorio era una sola estantería: cualquiera con
-- `documentos:read` veía todo lo que hubiera subido cualquiera de la empresa.
-- Eso convierte el módulo en un tablón de anuncios, y un tablón no es donde
-- alguien guarda la carta de renuncia que está redactando ni el borrador del
-- contrato que aún no negoció.
--
-- El modelo pasa a ser el de una carpeta personal dentro de la empresa:
--
--   · lo que subes es tuyo y privado por defecto,
--   · puedes marcarlo como visible para toda la empresa,
--   · o compartirlo con personas concretas — que es lo que `document_shares`
--     ya hacía, sin que sirviera de nada mientras todo el mundo lo veía igual.
--
-- Dos decisiones que no son obvias, y por qué:
--
-- 1. Las filas que ya existen quedan en 'Pública'. Poner privado lo que ya
--    estaba compartido no es «aplicar la política nueva», es hacer desaparecer
--    de golpe el repositorio de la empresa el día del despliegue. Lo nuevo
--    nace privado; lo viejo sigue como estaba y se ajusta a mano.
--
-- 2. La restricción se añade como política RESTRICTIVE en vez de reescribir
--    las de `app.apply_standard_rls`. Esa función es el primitivo de
--    aislamiento entre empresas y está congelada (ver AGENTS.md): sigue
--    decidiendo a qué organización pertenece la fila, y esta política se
--    multiplica encima decidiendo a qué persona. Las permissive se suman entre
--    sí, las restrictive se cruzan — así que la nueva solo puede quitar
--    acceso, nunca darlo.
-- ═══════════════════════════════════════════════════════════════════════════

-- Las columnas y el relleno van juntos dentro de un mismo bloque, y el bloque
-- solo corre si `visibility` todavía no existía. No es adorno: al aplicarse por
-- primera vez toda fila nace 'Privada' por el valor por defecto, así que el
-- relleno no se puede condicionar a «¿hay algo privado?» —lo hay, todo—, sino a
-- «¿acabo de crear la columna?». Y en una base que ya lleva semanas en marcha,
-- volver a pasar esta migración no debe republicar lo que alguien decidió
-- guardarse: un `update` sin condición no distingue lo viejo de lo decidido
-- ayer.
do $$
declare
  fresh boolean := not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'documents'
       and column_name = 'visibility'
  );
begin
  if fresh then
    alter table public.documents
      add column visibility text not null default 'Privada'
        check (visibility in ('Privada', 'Pública')),
      -- Quién subió el archivo, que no es lo mismo que `owner_id`: ese es la
      -- persona responsable del documento y se elige a mano, este es un hecho.
      add column uploaded_by uuid references public.profiles (id) on delete set null;

    -- Lo que ya existía se creó bajo la regla anterior; se queda con ella.
    update public.documents set visibility = 'Pública';

    -- Y donde se pueda deducir quién lo subió, se rellena: el responsable
    -- designado es la mejor aproximación disponible, y sin esto una fila
    -- antigua que alguien marque como privada se quedaría sin nadie que la
    -- vea — ni siquiera quien acaba de marcarla.
    update public.documents d
       set uploaded_by = e.user_id
      from public.employees e
     where e.id = d.owner_id
       and e.user_id is not null
       and d.uploaded_by is null;
  end if;
end $$;

comment on column public.documents.visibility is
  '«Privada» solo la ve quien la subió y con quien la comparta; «Pública» la ve '
  'toda la empresa. Nunca significa pública en internet: el bucket sigue siendo '
  'privado y las descargas siguen pasando por una URL firmada.';

comment on column public.documents.uploaded_by is
  'Quién transfirió el archivo. `owner_id` es el responsable designado, que '
  'puede ser otra persona o nadie.';

-- El filtro de la pantalla es «lo mío + lo de la empresa», y sobre un
-- repositorio grande lo propio es una porción pequeña de la tabla.
create index if not exists documents_visibility_idx
  on public.documents (org_id, visibility) where deleted_at is null;
create index if not exists documents_uploader_idx
  on public.documents (uploaded_by) where deleted_at is null;

-- ─── Quién ve qué ───────────────────────────────────────────────────────────
--
-- `as restrictive` se cruza con las políticas de la organización en vez de
-- sumarse: una fila necesita pasar las dos. Cubre `for all` porque un
-- documento que no puedes ver tampoco lo puedes editar ni borrar, y en la
-- inserción `uploaded_by` toma por defecto tu propio identificador, así que
-- subir algo siempre pasa la comprobación.
--
-- La parte de "compartido con esta persona" no consulta `document_shares`
-- directo: esa tabla hereda su RLS de `documents` vía `app.apply_child_rls`
-- (child_rls consulta el padre para decidir si la fila es visible), así que
-- una política de `documents` que consultara `document_shares` en línea
-- dispara ese RLS, que vuelve a evaluar esta misma política — 42P17,
-- recursión infinita, y así se descubrió en la demo. `security definer`
-- corta el ciclo: dentro de la función no se re-evalúa RLS de `documents`.
create or replace function app.document_shared_with_me(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.document_shares s
      join public.employees e on e.id = s.employee_id
     where s.document_id = p_document_id and e.user_id = auth.uid()
  ) or exists (
    select 1
      from public.document_shares s
      join public.profiles p on lower(p.email) = s.email
     where s.document_id = p_document_id and p.id = auth.uid()
  )
$$;

revoke all on function app.document_shared_with_me(uuid) from public, anon;
grant execute on function app.document_shared_with_me(uuid) to authenticated;

comment on function app.document_shared_with_me(uuid) is
  'Si el documento se comparte con auth.uid() (por empleado o por correo). '
  'security definer a propósito: evaluarlo desde la política de documents '
  'sin esto vuelve a consultar document_shares, que hereda su RLS de '
  'documents (app.apply_child_rls) y eso es la recursión infinita 42P17.';

drop policy if exists documents_visibility on public.documents;
create policy documents_visibility on public.documents
  as restrictive
  for all
  to authenticated
  using (
    visibility = 'Pública'
    or uploaded_by = auth.uid()
    -- El responsable designado ve lo suyo aunque lo haya subido otra persona.
    or exists (
      select 1 from public.employees e
       where e.id = documents.owner_id and e.user_id = auth.uid()
    )
    or app.document_shared_with_me(documents.id)
  );

alter table public.documents alter column uploaded_by set default auth.uid();

-- ─── Y quién ve qué en la búsqueda de la IA ────────────────────────────────
--
-- `document_chunks` llevaba las políticas estándar de organización, no las del
-- documento del que salió cada fragmento. Sin esto, marcar un documento como
-- privado lo escondía de la pantalla y lo dejaba intacto en el buscador: la
-- respuesta del asistente citaría el contenido con su título a cualquiera de
-- la empresa, que es la misma fuga con un intermediario simpático.
--
-- La comprobación es una sola existencia sobre `documents`, y ahí vuelven a
-- aplicarse sus políticas —la de organización y la de arriba—, así que el
-- fragmento se ve exactamente cuando se ve el documento. Una sola definición
-- de visibilidad, no dos que se puedan separar.
drop policy if exists document_chunks_visibility on public.document_chunks;
create policy document_chunks_visibility on public.document_chunks
  as restrictive
  for all
  to authenticated
  using (
    exists (select 1 from public.documents d where d.id = document_chunks.document_id)
  );

-- ─── El bucket acepta cualquier formato ─────────────────────────────────────
--
-- La lista blanca de tipos MIME rechazaba en la transferencia todo lo que no
-- fuera ofimática: un .zip, un .dwg, un audio de una reunión. El repositorio
-- es donde la empresa guarda sus archivos, no solo sus documentos, y el
-- formato no es lo que decide si algo es peligroso — el bucket es privado, no
-- se sirve como HTML y toda descarga pasa por una URL firmada. El límite de
-- tamaño sí se queda: eso protege el almacenamiento, no el contenido.
update storage.buckets
   set allowed_mime_types = null
 where id = 'documents';
