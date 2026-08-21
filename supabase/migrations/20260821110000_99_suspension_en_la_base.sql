-- ═══════════════════════════════════════════════════════════════════════════
-- 99 — La suspensión deja de ser una decoración de la aplicación.
--
-- `requirePermission` niega toda escritura cuando la empresa está suspendida:
--
--     if (member.status === 'suspended' && !permission.endsWith(':read'))
--       throw new CompanySuspendedError()
--
-- y ninguna política RLS lo sabe. Comprobado sobre la base real: cero de las
-- 753 políticas mencionan `organizations.status`.
--
-- Eso importa porque `requirePermission` no es el único camino a los datos. La
-- URL de Supabase y la anon key son `NEXT_PUBLIC_*` — viajan en el bundle de
-- todos los navegadores — así que cualquier usuario autenticado puede hablar
-- con PostgREST directamente, con su propio JWT, sin pasar por una sola línea
-- de TypeScript. Demostrado antes de escribir esto, como `authenticated`:
--
--     update organizations set status='suspended' where id='…';
--     insert into clients (org_id, name, status) values ('…','…','Activo');
--     -- INSERT 0 1
--
-- Una empresa impaga siguió escribiendo. La suspensión existía como mensaje en
-- pantalla, no como regla.
--
-- ─── Por qué RESTRICTIVE y por qué solo escritura ──────────────────────────
--
-- `app.apply_standard_rls` está congelada (AGENTS.md §5): sigue decidiendo a
-- qué empresa pertenece la fila. Esta capa se multiplica encima decidiendo si
-- esa empresa puede escribir hoy. Las permissive se suman entre sí, las
-- restrictive se cruzan — así que lo de aquí solo puede quitar acceso, nunca
-- darlo, y no hay forma de que un error aquí abra nada.
--
-- Y solo INSERT/UPDATE/DELETE, nunca SELECT, porque suspender no es confiscar.
-- Es lo mismo que dice el banner que el cliente ve: «Tus datos siguen completos
-- y vuelven a estar disponibles al regularizar el plan». Una empresa que no
-- puede leer sus propias facturas para entender qué debe es una empresa a la
-- que se le puso más difícil pagar.
--
-- ─── Qué queda deliberadamente fuera ───────────────────────────────────────
--
-- **El plano de identidad** (`memberships`, `roles`, `role_permissions`,
-- `invitations`, `membership_sites`). No usan `orgs_with` sino
-- `app.is_org_admin`, y bloquearlos abre un riesgo peor que el que cierran:
-- dejar a alguien encerrado fuera de la empresa que está intentando pagar. La
-- aplicación ya los niega vía `configuracion:manage`, que no termina en
-- `:read`.
--
-- **`ticket_portal_tokens`**, por una razón distinta: no le falta la guardia,
-- le sobra. Tiene RLS activo, cero políticas y cero grants a `authenticated`
-- (`relacl` solo lista postgres y service_role), así que ya está cerrada del
-- todo para el camino que esta migración cubre.
--
-- **Los RPC `SECURITY DEFINER`**. Son de `postgres`, que tiene `rolbypassrls`,
-- así que no ven esta política ni ninguna otra. Van en la migración siguiente,
-- con una comprobación explícita cada uno.
--
-- Resultado medido tras aplicar: 543 políticas sobre 181 tablas — 126 con
-- `org_id` y 55 hijas. Las seis que quedan fuera son las cinco del plano de
-- identidad más `ticket_portal_tokens`, y son las de arriba.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.company_is_active(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = p_org_id and o.status = 'active'
  );
$$;

comment on function app.company_is_active(uuid) is
  'Si la empresa puede escribir hoy. Suspendida = solo lectura, nunca menos.';

-- ─── Los emisores ──────────────────────────────────────────────────────────
--
-- Deliberadamente NO se toca `app.apply_standard_rls`. Estas son funciones
-- nuevas y separadas: la congelada sigue respondiendo «de qué empresa es esta
-- fila», y estas responden «esa empresa está al día». Dos preguntas, dos
-- sitios, y la primera se puede seguir leyendo sin la segunda encima.

create or replace function app.apply_active_guard(p_table text)
returns void
language plpgsql
as $$
declare
  t text := format('public.%I', p_table);
begin
  execute format('drop policy if exists %I on %s', p_table || '_active_insert', t);
  execute format('drop policy if exists %I on %s', p_table || '_active_update', t);
  execute format('drop policy if exists %I on %s', p_table || '_active_delete', t);

  execute format($f$
    create policy %I on %s as restrictive for insert to authenticated
    with check (app.company_is_active(org_id))
  $f$, p_table || '_active_insert', t);

  execute format($f$
    create policy %I on %s as restrictive for update to authenticated
    using      (app.company_is_active(org_id))
    with check (app.company_is_active(org_id))
  $f$, p_table || '_active_update', t);

  execute format($f$
    create policy %I on %s as restrictive for delete to authenticated
    using (app.company_is_active(org_id))
  $f$, p_table || '_active_delete', t);
end;
$$;

-- La hija no tiene `org_id`: pregunta por el de su padre, exactamente como su
-- política permissive ya hace. La columna FK se califica con el nombre de la
-- tabla hija por la misma razón que en `apply_child_rls` — desnuda, se
-- enlazaría a una columna homónima del padre y coincidiría con todo.
create or replace function app.apply_active_guard_child(
  p_table text, p_parent text, p_fk text
)
returns void
language plpgsql
as $$
declare
  t    text := format('public.%I', p_table);
  expr text := format(
    'exists (select 1 from public.%I parent where parent.id = %s.%I and app.company_is_active(parent.org_id))',
    p_parent, t, p_fk);
begin
  execute format('drop policy if exists %I on %s', p_table || '_active_insert', t);
  execute format('drop policy if exists %I on %s', p_table || '_active_update', t);
  execute format('drop policy if exists %I on %s', p_table || '_active_delete', t);

  execute format('create policy %I on %s as restrictive for insert to authenticated with check (%s)',
                 p_table || '_active_insert', t, expr);
  execute format('create policy %I on %s as restrictive for update to authenticated using (%s) with check (%s)',
                 p_table || '_active_update', t, expr, expr);
  execute format('create policy %I on %s as restrictive for delete to authenticated using (%s)',
                 p_table || '_active_delete', t, expr);
end;
$$;

-- ─── Aplicación ────────────────────────────────────────────────────────────
--
-- Derivado del catálogo, no escrito a mano. Una lista de 126 nombres en un
-- archivo es una lista que se queda corta en la migración siguiente, y este
-- repositorio ya tiene dos cicatrices de exactamente eso (el permiso que no
-- llegaba, el módulo que cayó en Enterprise). La condición «tiene política que
-- consulta `orgs_with`» es la definición operativa de «tabla de negocio», y es
-- la misma que decide quién recibió `apply_standard_rls`.

do $$
declare r record;
begin
  for r in
    select distinct t.tablename
    from pg_tables t
    join information_schema.columns c
      on c.table_schema = 'public' and c.table_name = t.tablename and c.column_name = 'org_id'
    where t.schemaname = 'public'
      and exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = t.tablename
          and p.permissive = 'PERMISSIVE' and p.qual like '%orgs_with%'
      )
    order by 1
  loop
    perform app.apply_active_guard(r.tablename);
  end loop;
end;
$$;

-- Las hijas, con el padre y la FK leídos de su propia política de SELECT. Si
-- alguna no se deja leer, la migración se para: preferimos no aplicarla a
-- aplicarla a medias y creer que está cubierta.
do $$
declare
  r      record;
  parent text;
  fk     text;
begin
  for r in
    select p.tablename, p.qual
    from pg_policies p
    where p.schemaname = 'public' and p.cmd = 'SELECT'
      and p.permissive = 'PERMISSIVE' and p.qual like '%parent.org_id%'
    order by 1
  loop
    parent := substring(r.qual from 'FROM ([a-z_]+) parent');
    fk     := substring(r.qual from 'parent.id = [a-z_]+\.([a-z_]+)');

    if parent is null or fk is null then
      raise exception 'no se pudo derivar padre/FK de la política de %', r.tablename;
    end if;

    perform app.apply_active_guard_child(r.tablename, parent, fk);
  end loop;
end;
$$;

-- ─── La migración se comprueba a sí misma ──────────────────────────────────
--
-- Aplicar 182 políticas en un bucle y confiar en que el bucle acertó es la
-- forma cara de no saberlo. Esto vuelve a preguntar por el catálogo: toda tabla
-- que acepte escrituras a través de `orgs_with` tiene que tener su guardia, y
-- si falta una, esta migración no se da por aplicada.

do $$
declare faltan text;
begin
  select string_agg(t.tablename, ', ' order by t.tablename) into faltan
  from pg_tables t
  where t.schemaname = 'public'
    and exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t.tablename
        and p.permissive = 'PERMISSIVE' and p.cmd = 'INSERT'
        and coalesce(p.with_check, '') like '%orgs_with%'
    )
    and not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t.tablename
        and p.permissive = 'RESTRICTIVE' and p.policyname = t.tablename || '_active_insert'
    );

  if faltan is not null then
    raise exception 'sin guardia de suspensión: %', faltan;
  end if;
end;
$$;
