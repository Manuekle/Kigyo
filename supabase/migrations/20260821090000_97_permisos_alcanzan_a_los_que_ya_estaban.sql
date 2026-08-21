-- ═══════════════════════════════════════════════════════════════════════════
-- 97 — Un módulo nuevo alcanza también a las empresas que ya existían.
--
-- `app.seed_default_permissions(org)` reparte los permisos por defecto entre
-- los tres roles de sistema, y corre **una vez**: cuando la empresa se crea.
-- Deriva el rol Administrador de `select key from public.permissions`, así que
-- el día que se creó era exacto — y deja de serlo en cuanto sale un módulo.
--
-- El resultado medido antes de esta migración, sobre la base real:
--
--     IPS Bogota      113 de 115 permisos      faltan pedidos:read/:write
--     Kigyo Demo Dos  113 de 115               faltan pedidos:read/:write
--     Microsoft       115 de 115               creada después de la mig. 88
--
-- `pedidos` llegó en la migración 88. Las dos empresas anteriores no lo
-- recibieron nunca, y el modo en que eso se manifiesta es el peor posible: el
-- plan incluye el módulo, así que aparece encendible en Configuración; el
-- administrador lo enciende; la pantalla responde «tu rol no incluye Ver
-- pedidos». Ha comprado algo que su propia cuenta no puede abrir, y el mensaje
-- lo manda a pedirle un permiso a alguien que no existe por encima de él.
--
-- Multiplicado por cada módulo que salga, es una decadencia silenciosa: cada
-- release deja atrás a toda la base instalada, y nadie se entera hasta que un
-- cliente reporta que una función anunciada no está.
--
-- ─── Por qué un trigger y no un backfill ───────────────────────────────────
--
-- Un `update` de una vez arregla las dos filas de hoy y no arregla la próxima.
-- La causa no es que falten permisos: es que **insertar en `public.permissions`
-- no llega a los inquilinos**. Así que eso es lo que se arregla — la fila nueva
-- se reparte sola, y una migración futura no tiene ningún paso que olvidar.
-- Es la misma idea que el registro de módulos: una fuente, y lo demás derivado.
--
-- ─── Por qué SOLO el rol Administrador ─────────────────────────────────────
--
-- Volver a correr `seed_default_permissions` entero sería más simple y sería
-- un error de seguridad. Esa función también siembra «Líder de equipo» y
-- «Empleado», y lleva `on conflict do nothing` — que no distingue «nunca lo
-- tuvo» de «se lo quitaron a propósito». Un administrador que revocó
-- `pos:write` a los líderes lo vería reaparecer en el despliegue siguiente,
-- sin haber hecho nada y sin que nada se lo diga.
--
-- Administrador es distinto por definición y no por conveniencia: es el rol
-- `is_system` que sostiene `configuracion:manage`, es decir el único que puede
-- repartir permisos. Un permiso que él no tiene es un permiso que nadie en esa
-- empresa puede conceder jamás — el estado del que no se sale desde dentro. Y
-- el trigger solo dispara con filas *nuevas* de `public.permissions`, así que
-- tampoco puede resucitar nada revocado.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.grant_permission_to_admins()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- Solo empresas que realmente tienen el rol: una que hubiera borrado
  -- «Administrador» y trabajara con roles propios no lo recupera por aquí.
  insert into public.role_permissions (org_id, role, permission)
  select r.org_id, r.key, new.key
  from public.roles r
  where r.key = 'Administrador'
  on conflict do nothing;

  return new;
end;
$$;

comment on function app.grant_permission_to_admins() is
  'Reparte un permiso recién insertado al rol Administrador de cada empresa. '
  'Sin esto, un módulo nuevo solo existe para las empresas creadas después.';

drop trigger if exists permissions_reach_existing_orgs on public.permissions;

create trigger permissions_reach_existing_orgs
after insert on public.permissions
for each row
execute function app.grant_permission_to_admins();

-- ─── El atraso acumulado ───────────────────────────────────────────────────
--
-- Lo de arriba cubre de hoy en adelante. Esto cierra lo que ya se perdió,
-- expresado como «lo que el catálogo tiene y este Administrador no» en vez de
-- como la lista de claves concretas que faltan hoy: escrita así, la sentencia
-- sigue siendo correcta si se aplica dentro de seis módulos.

insert into public.role_permissions (org_id, role, permission)
select r.org_id, r.key, p.key
from public.roles r
cross join public.permissions p
where r.key = 'Administrador'
on conflict do nothing;
