-- ═══════════════════════════════════════════════════════════════════════════
-- 109 — «Líder de equipo» deja de nacer con permisos de once industrias.
--
-- `app.seed_default_permissions(org)` reparte los permisos por defecto entre
-- los tres roles de sistema al crear la empresa. Su lista para «Líder de
-- equipo» estaba escrita a mano y era **ciega al sector**: incluía
-- `pacientes:read`, `estudiantes:read`, `restaurante:read/write`, `agro:read`,
-- `inmobiliario:read`, `hoteleria:read` y `socios:read/write` — nueve claves de
-- módulos verticales — en toda empresa, fuera del sector que fuera.
--
-- Hoy no se nota porque la compuerta de módulo lo tapa: `enabled_modules` de
-- una constructora no lleva `pacientes`, así que el permiso existe y no abre
-- nada. Lo que hace es esperar. El día que esa empresa enciende un vertical
-- —una constructora que abre `obra`, una cadena de gimnasios que activa
-- `socios`— todos sus líderes de equipo ganan acceso **sin que nadie lo haya
-- decidido**, y sin que nada en pantalla lo diga.
--
-- El producto ya tiene la respuesta correcta a «quién entra al vertical» desde
-- la migración 46: `public.sector_roles`, 94 conjuntos de roles por sector y
-- subsector, con permisos afinados uno por uno. Una clínica recibe «Médico/a»,
-- «Enfermero/a» y «Recepcionista», y son ellos —y no un rol genérico— quienes
-- abren `pacientes`. Desde ahora el wizard los siembra en cuanto se conoce el
-- sector, así que la lista fija ya no tiene que adivinar nada.
--
-- ─── Por qué NO se toca a las empresas que ya existen ───────────────────────
--
-- Esta función corre una sola vez, al crear la empresa. Un `delete` sobre
-- `role_permissions` arreglaría la base instalada y sería el peor movimiento
-- disponible: `on conflict do nothing` no distingue «lo tiene porque nació con
-- ello» de «se lo concedieron a propósito», y quitarlo le cerraría la pantalla
-- en la cara a alguien que la usa a diario, sin aviso y sin causa visible. Es
-- la misma razón por la que la migración 97 solo repuso permisos al rol
-- Administrador. Quien quiera recortarlo lo hace desde Configuración → Roles y
-- permisos, que es donde esa decisión se ve.
--
-- Se redefine entera porque una función no tiene ALTER para su cuerpo. Único
-- cambio: las nueve claves verticales salen del bloque de «Líder de equipo».
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.seed_default_permissions(p_org_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.role_permissions (org_id, role, permission)
  select p_org_id, 'Administrador', key from public.permissions
  union all
  select p_org_id, 'Líder de equipo', key from public.permissions
    where key in (
      'dashboard:read', 'empleados:read', 'asistencia:read', 'asistencia:write',
      'riesgos:read', 'proyectos:read', 'proyectos:write', 'cotizaciones:read',
      'compras:read', 'compras:write', 'tienda:read', 'catalogos:read',
      'firmas:read', 'inventario:read', 'documentos:read', 'consultoria:read',
      'hseq:read', 'hseq:write', 'tickets:read', 'tickets:write',
      'canales:read', 'canales:write', 'calendario:read', 'calendario:write',
      'trazabilidad:read', 'ia:use',
      'clientes:read', 'clientes:write', 'contratos:read', 'facturacion:read',
      'reclutamiento:read', 'reclutamiento:write', 'capacitacion:read',
      'desempeno:read', 'desempeno:write',
      'mantenimiento:read', 'mantenimiento:write', 'flota:read',
      'produccion:read', 'ecommerce:read',
      -- Los nueve verticales que estaban aquí se fueron a `sector_roles`:
      -- pacientes, estudiantes, restaurante, agro, inmobiliario, hoteleria y
      -- socios. Un líder de equipo de la industria que sea los recibe por el
      -- rol de su sector, no por nacer con ellos.
      'caja:read', 'caja:write', 'pos:read', 'pos:write'
    )
  union all
  select p_org_id, 'Empleado', key from public.permissions
    where key in (
      'dashboard:read', 'empleados:read', 'asistencia:read', 'documentos:read',
      'tickets:read', 'calendario:read', 'canales:read', 'tienda:read',
      'ia:use', 'capacitacion:read', 'desempeno:read'
    )
  on conflict do nothing;
$$;

revoke all on function app.seed_default_permissions(uuid) from public, anon, authenticated;

-- Rollback:
--   Volver a aplicar el cuerpo de la migración 43
--   (20260812200000_43_caja_pos.sql, `create or replace function
--   app.seed_default_permissions`), que es idéntico salvo por las nueve claves.
