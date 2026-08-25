-- ═══════════════════════════════════════════════════════════════════════════
-- 108 · `branding.logo_url` admite una ruta de storage, no solo una URL
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La migración 107 creó el bucket `logos` y la mutación que sube el archivo, y
-- la subida falló contra este CHECK:
--
--     (p_branding ->> 'logo_url') ~ '^https://\S+$'
--
-- La regla es de la migración 30, escrita cuando la única forma imaginada de
-- tener logo era pegar la URL de uno alojado fuera. Desde entonces el producto
-- eligió otra —y mejor— para todo lo demás: los tres buckets son privados y lo
-- que se guarda en la columna es la **ruta** dentro del bucket, que se firma al
-- leerla. `profiles.avatar_url` guarda `{user_id}/avatar` y `getSettings` lo
-- firma en cada carga, exactamente igual que ahora hace el logo.
--
-- Una URL firmada NO es alternativa: caduca en una hora, así que la columna
-- guardaría un enlace muerto casi todo el tiempo. Y un bucket público tampoco:
-- sería la lista de los logos de todos los clientes de Kigyo servida sin
-- autenticación.
--
-- ─── Qué cambia y qué no ──────────────────────────────────────────────────
--
-- Se **añade** la forma «ruta»; la forma «https» se conserva. Un logo externo
-- sigue siendo válido, así que ningún valor existente deja de serlo — la
-- migración no puede romper una fila que ya estaba (hoy las tres empresas
-- tienen `branding = {}`, pero la regla debe valer para una base que no sea
-- esta).
--
-- La ruta se acota a `{uuid}/logo`, que es lo único que `uploadLogo` escribe.
-- Sin esa forma exacta el CHECK aceptaría `../otra-empresa/logo` o cualquier
-- texto: la política de storage ya impide leer fuera de la propia empresa, pero
-- una columna que puede describir una ruta ajena es una columna que invita a
-- intentarlo.
--
-- `accent` no se toca.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.valid_branding(p_branding jsonb)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select p_branding is null or (
    jsonb_typeof(p_branding) = 'object'
    and not exists (
      select 1 from jsonb_object_keys(p_branding) as k
      where k not in ('logo_url', 'accent')
    )
    and (
      p_branding -> 'accent' is null
      or (p_branding ->> 'accent') ~ '^#[0-9a-fA-F]{6}$'
    )
    and (
      p_branding -> 'logo_url' is null
      or (
        -- Shape and length are separate tests on purpose: Postgres caps a regex
        -- repetition count at 255, so `{1,500}` is not a long bound — it is an
        -- invalid expression, and the function raises rather than refusing.
        (
          -- Un logo alojado fuera. La forma original, conservada.
          (p_branding ->> 'logo_url') ~ '^https://\S+$'
          -- O la ruta dentro del bucket privado `logos`, que es lo que escribe
          -- `uploadLogo`: el uuid de la empresa y el nombre fijo `logo`. Fijo a
          -- propósito — subir uno nuevo pisa el anterior y no deja huérfanos.
          or (p_branding ->> 'logo_url') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/logo$'
        )
        and length(p_branding ->> 'logo_url') <= 500
      )
    )
  );
$function$;

comment on function app.valid_branding(jsonb) is
  'Forma válida de organizations.branding: accent en #rrggbb, y logo_url como '
  'URL https (logo externo) o como ruta {org_id}/logo dentro del bucket privado.';

-- ─── Comprobación ──────────────────────────────────────────────────────────

do $$
begin
  -- La forma nueva.
  if not app.valid_branding('{"logo_url": "1b82cb7c-ea6a-4b84-9388-0dceb40e5b5f/logo"}'::jsonb) then
    raise exception 'la ruta de storage sigue siendo inválida';
  end if;

  -- La vieja, que no debe romperse.
  if not app.valid_branding('{"logo_url": "https://ejemplo.com/logo.png"}'::jsonb) then
    raise exception 'una URL https dejó de ser válida';
  end if;

  -- Y lo que sigue sin valer: ni ruta de otra forma, ni escapes.
  if app.valid_branding('{"logo_url": "../otra/logo"}'::jsonb) then
    raise exception 'se aceptó una ruta relativa';
  end if;
  if app.valid_branding('{"logo_url": "1b82cb7c-ea6a-4b84-9388-0dceb40e5b5f/otro"}'::jsonb) then
    raise exception 'se aceptó un nombre de objeto distinto de logo';
  end if;
  if app.valid_branding('{"accent": "rojo"}'::jsonb) then
    raise exception 'se aceptó un acento que no es #rrggbb';
  end if;
  if app.valid_branding('{"otra": "cosa"}'::jsonb) then
    raise exception 'se aceptó una clave que no existe';
  end if;

  -- Y ninguna fila viva puede haberse quedado fuera.
  if exists (select 1 from public.organizations where not app.valid_branding(branding)) then
    raise exception 'alguna empresa tiene un branding que la nueva regla rechaza';
  end if;
end;
$$;

-- ─── Rollback ──────────────────────────────────────────────────────────────
--
--   create or replace function app.valid_branding(jsonb) … (versión mig 30,
--   solo con la rama '^https://\S+$'). Exige antes vaciar `logo_url` en las
--   empresas que hayan subido un logo, o el CHECK rechaza la fila.
