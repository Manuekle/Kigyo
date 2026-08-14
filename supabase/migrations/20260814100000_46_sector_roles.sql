-- ═══════════════════════════════════════════════════════════════════════════
-- 46 — Roles sugeridos por sector y subsector
--
-- El administrador recibe tres roles genéricos (Administrador, Líder de
-- equipo, Empleado) y arma el resto a mano en una matriz de 71 permisos.
-- Una veterinaria usa «Veterinario/a», «Auxiliar veterinario» y «Recepción
-- y caja»; un hotel, «Recepción», «Ama de llaves» y «Mantenimiento». Que
-- cada empresa los invente de cero es el hueco de fase 6 del plan sectorial.
--
-- Esta migración los siembra como roles `is_system = true`: sugerencias
-- editables y borrables, distinguibles del Administrador solo por su origen.
--
-- ─── Por qué datos y no código ─────────────────────────────────────────────
--
-- El catálogo vive en `public.sector_roles`, espejo de `public.sector_modules`
-- (migración 34). Un subsector nuevo que no tiene matriz de roles no rompe
-- nada: simplemente no recibe sugerencias. Añadir una matriz es un INSERT,
-- no un deploy.
--
-- La búsqueda es por subsector con caída al sector:
--
--     coalesce(organizations.subsector, organizations.company_type)
--
-- ─── Qué NO es ──────────────────────────────────────────────────────────────
--
-- No es control de acceso. Un rol sugerido es un rol normal: el
-- administrador lo renombra, edita su matriz y lo borra. Los permisos
-- propuestos usan solo el vocabulario existente (`<módulo>:read|write`) y
-- ninguno porta `configuracion:manage` — el único administrador real sigue
-- siendo el rol sembrado que lo tiene, y el guard anti-lockout (migración
-- 24) no aprende nada nuevo.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Validación de permisos ─────────────────────────────────────────────────

create or replace function app.valid_permission_keys(p_keys text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bool_and(k in (select key from public.permissions)), true)
  from unnest(p_keys) as k;
$$;

revoke all on function app.valid_permission_keys(text[]) from public, anon, authenticated;

-- ─── El catálogo ────────────────────────────────────────────────────────────

create table public.sector_roles (
  sector_key  text not null references public.sectors (key) on delete cascade,
  -- La identidad estable, igual que `roles.key`: es el valor que
  -- `memberships.role` guarda. Sin tildes ni barras; `label` es la palabra
  -- que la persona ve.
  role_key    text not null check (length(btrim(role_key)) between 2 and 40),
  label       text not null check (length(btrim(label)) between 2 and 40),
  -- Menor = más arriba en la lista de roles.
  rank        int  not null default 50,
  -- El vocabulario de `public.permissions`. read/write por módulo.
  permissions text[] not null check (cardinality(permissions) > 0),
  primary key (sector_key, role_key)
);

comment on table public.sector_roles is
  'Roles sugeridos por sector o subsector. Se siembran como roles is_system al crear la empresa. Solo sugieren: nunca restringen.';

alter table public.sector_roles enable row level security;
alter table public.sector_roles force  row level security;

create policy sector_roles_select on public.sector_roles
  for select to authenticated using (true);

revoke insert, update, delete on public.sector_roles from authenticated;

/**
 * Un permiso propuesto tiene que existir, y ningún rol sugerido puede
 * administrar la configuración — ese es el único permiso que decide quién
 * puede revocar a todos los demás.
 */
create or replace function app.guard_sector_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.valid_permission_keys(new.permissions) then
    raise exception 'Permiso desconocido en rol sugerido (%).', array_to_string(new.permissions, ',')
      using errcode = 'check_violation';
  end if;

  if 'configuracion:manage' = any(new.permissions) then
    raise exception 'Un rol sugerido no puede administrar la configuración.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function app.guard_sector_role() from public, anon, authenticated;

create trigger sector_roles_guard
  before insert or update on public.sector_roles
  for each row execute function app.guard_sector_role();

-- ─── Matrices ───────────────────────────────────────────────────────────────

insert into public.sector_roles (sector_key, role_key, label, rank, permissions) values

  -- Salud ────────────────────────────────────────────────────────────────
  ('salud-consultorio', 'medico', 'Médico/a', 30, array['pacientes:read','pacientes:write','calendario:read','firmas:read','documentos:read','canales:read']),
  ('salud-consultorio', 'enfermero', 'Enfermero/a', 40, array['pacientes:read','pacientes:write','calendario:read']),
  ('salud-consultorio', 'recepcionista', 'Recepcionista', 50, array['pacientes:read','clientes:read','clientes:write','calendario:read','calendario:write','facturacion:read','caja:read','caja:write','tickets:read','canales:read','documentos:read']),

  ('salud-ips', 'medico', 'Médico/a', 30, array['pacientes:read','pacientes:write','calendario:read','firmas:read','documentos:read','canales:read']),
  ('salud-ips', 'enfermero', 'Enfermero/a', 40, array['pacientes:read','pacientes:write','calendario:read']),
  ('salud-ips', 'facturador', 'Facturador/a', 45, array['facturacion:read','facturacion:write','clientes:read','caja:read','caja:write','tickets:read']),
  ('salud-ips', 'recepcionista', 'Recepcionista', 50, array['pacientes:read','clientes:read','clientes:write','calendario:read','calendario:write','facturacion:read','caja:read','caja:write','tickets:read']),

  ('salud-laboratorio', 'analista', 'Analista de laboratorio', 30, array['pacientes:read','pacientes:write','catalogos:read','trazabilidad:read','calendario:read']),
  ('salud-laboratorio', 'recepcionista', 'Recepcionista', 50, array['pacientes:read','clientes:read','clientes:write','catalogos:read','facturacion:read','caja:read','caja:write','calendario:read','calendario:write']),

  ('salud-odontologia', 'odontologo', 'Odontólogo/a', 30, array['pacientes:read','pacientes:write','cotizaciones:read','cotizaciones:write','catalogos:read','calendario:read','firmas:read']),
  ('salud-odontologia', 'auxiliar', 'Auxiliar dental', 40, array['pacientes:read','pacientes:write','calendario:read','catalogos:read']),
  ('salud-odontologia', 'recepcionista', 'Recepcionista', 50, array['pacientes:read','clientes:read','clientes:write','calendario:read','calendario:write','cotizaciones:read','facturacion:read','caja:read','caja:write','tickets:read']),

  ('salud-estetica', 'especialista', 'Especialista', 30, array['pacientes:read','pacientes:write','cotizaciones:read','cotizaciones:write','catalogos:read','calendario:read','firmas:read']),
  ('salud-estetica', 'recepcionista', 'Recepcionista', 50, array['pacientes:read','clientes:read','clientes:write','calendario:read','calendario:write','cotizaciones:read','facturacion:read','caja:read','caja:write']),

  ('salud-veterinaria', 'veterinario', 'Veterinario/a', 30, array['pacientes:read','pacientes:write','calendario:read','catalogos:read','firmas:read','documentos:read']),
  ('salud-veterinaria', 'auxiliar', 'Auxiliar veterinario', 40, array['pacientes:read','pacientes:write','calendario:read','catalogos:read','tienda:read','pos:read']),
  ('salud-veterinaria', 'cajero', 'Recepción y caja', 50, array['pacientes:read','clientes:read','clientes:write','calendario:read','calendario:write','facturacion:read','tienda:read','pos:read','pos:write','caja:read','caja:write','tickets:read']),

  -- Comercio ─────────────────────────────────────────────────────────────
  ('comercio-retail', 'vendedor', 'Vendedor/a', 30, array['clientes:read','clientes:write','tienda:read','pos:read','pos:write','caja:read','catalogos:read','inventario:read']),
  ('comercio-retail', 'cajero', 'Cajero/a', 40, array['clientes:read','tienda:read','pos:read','pos:write','caja:read','caja:write','facturacion:read']),
  ('comercio-retail', 'supervisor', 'Supervisor/a de inventario', 50, array['inventario:read','inventario:write','compras:read','compras:write','catalogos:read','catalogos:write']),

  ('comercio-mayorista', 'ejecutivo', 'Ejecutivo/a de ventas', 30, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','facturacion:read','contratos:read']),
  ('comercio-mayorista', 'despachador', 'Despachador/a', 40, array['inventario:read','flota:read','compras:read','facturacion:read']),

  ('comercio-ferreteria', 'vendedor', 'Vendedor/a de mostrador', 30, array['clientes:read','clientes:write','pos:read','pos:write','caja:read','catalogos:read','inventario:read']),
  ('comercio-ferreteria', 'bodega', 'Jefe/a de bodega', 40, array['inventario:read','inventario:write','compras:read','compras:write','catalogos:read','catalogos:write']),
  ('comercio-ferreteria', 'cajero', 'Cajero/a', 50, array['clientes:read','pos:read','pos:write','caja:read','caja:write','facturacion:read']),

  ('comercio-farmacia', 'regente', 'Regente de farmacia', 30, array['clientes:read','pos:read','pos:write','caja:read','inventario:read','trazabilidad:read','catalogos:read']),
  ('comercio-farmacia', 'cajero', 'Cajero/a', 40, array['clientes:read','pos:read','pos:write','caja:read','caja:write','facturacion:read']),

  ('comercio-super', 'cajero', 'Cajero/a', 30, array['pos:read','pos:write','caja:read','caja:write','clientes:read','facturacion:read']),
  ('comercio-super', 'reponedor', 'Reponedor/a', 40, array['inventario:read','inventario:write','catalogos:read']),
  ('comercio-super', 'supervisor', 'Supervisor/a', 50, array['inventario:read','inventario:write','compras:read','compras:write','catalogos:read','catalogos:write','pos:read']),

  -- Restaurantes y alimentos ─────────────────────────────────────────────
  ('alimentos-salon', 'mesero', 'Mesero/a', 30, array['restaurante:read','restaurante:write','clientes:read','caja:read']),
  ('alimentos-salon', 'cocina', 'Cocina', 40, array['restaurante:read','inventario:read','compras:read']),
  ('alimentos-salon', 'cajero', 'Cajero/a', 50, array['restaurante:read','clientes:read','caja:read','caja:write','facturacion:read']),

  ('alimentos-rapida', 'mostrador', 'Mostrador y caja', 30, array['restaurante:read','pos:read','pos:write','caja:read','caja:write','clientes:read','tienda:read','ecommerce:read']),
  ('alimentos-rapida', 'cocina', 'Cocina', 40, array['restaurante:read','inventario:read']),
  ('alimentos-rapida', 'repartidor', 'Repartidor/a', 50, array['restaurante:read','tienda:read','ecommerce:read']),

  ('alimentos-bar', 'bartender', 'Bartender', 30, array['restaurante:read','restaurante:write','caja:read','inventario:read','clientes:read']),
  ('alimentos-bar', 'mesero', 'Mesero/a', 40, array['restaurante:read','restaurante:write','caja:read','clientes:read']),
  ('alimentos-bar', 'cajero', 'Cajero/a', 50, array['restaurante:read','caja:read','caja:write','facturacion:read']),

  ('alimentos-catering', 'chef', 'Chef', 30, array['restaurante:read','restaurante:write','inventario:read','compras:read','cotizaciones:read','proyectos:read']),
  ('alimentos-catering', 'coordinador', 'Coordinador/a de eventos', 40, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','contratos:read','contratos:write','proyectos:read','proyectos:write','calendario:read','calendario:write']),
  ('alimentos-catering', 'cocina', 'Cocina', 50, array['restaurante:read','inventario:read']),

  ('alimentos-panaderia', 'panadero', 'Panadero/a', 30, array['produccion:read','produccion:write','inventario:read','compras:read']),
  ('alimentos-panaderia', 'vendedor', 'Vendedor/a', 40, array['pos:read','pos:write','caja:read','clientes:read','clientes:write','catalogos:read']),

  -- Hotelería ────────────────────────────────────────────────────────────
  ('hoteleria-hotel', 'recepcion', 'Recepción', 30, array['hoteleria:read','hoteleria:write','clientes:read','clientes:write','calendario:read','calendario:write','facturacion:read','caja:read','caja:write']),
  ('hoteleria-hotel', 'ama', 'Ama de llaves', 40, array['hoteleria:read','mantenimiento:read','inventario:read']),
  ('hoteleria-hotel', 'mantenimiento', 'Mantenimiento', 50, array['mantenimiento:read','mantenimiento:write','inventario:read']),

  ('hoteleria-hostal', 'recepcion', 'Recepción', 30, array['hoteleria:read','hoteleria:write','clientes:read','clientes:write','facturacion:read','caja:read','caja:write']),
  ('hoteleria-hostal', 'ama', 'Ama de llaves', 40, array['hoteleria:read']),

  ('hoteleria-finca', 'recepcion', 'Recepción', 30, array['hoteleria:read','hoteleria:write','clientes:read','clientes:write','facturacion:read','caja:read','caja:write','calendario:read','calendario:write']),
  ('hoteleria-finca', 'guia', 'Guía de campo', 40, array['agro:read','hoteleria:read']),

  ('hoteleria-operador', 'agente', 'Agente de viajes', 30, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','contratos:read','contratos:write','calendario:read','calendario:write','facturacion:read']),
  ('hoteleria-operador', 'operador', 'Operador/a de itinerario', 40, array['proyectos:read','proyectos:write','calendario:read','calendario:write']),

  -- Fitness y bienestar ──────────────────────────────────────────────────
  ('fitness-gimnasio', 'instructor', 'Instructor/a', 30, array['socios:read','calendario:read','calendario:write','canales:read']),
  ('fitness-gimnasio', 'recepcionista', 'Recepcionista', 40, array['socios:read','socios:write','clientes:read','clientes:write','calendario:read','calendario:write','caja:read','caja:write','facturacion:read']),
  ('fitness-gimnasio', 'sala', 'Encargado/a de sala', 50, array['socios:read','socios:write','inventario:read','mantenimiento:read']),

  ('fitness-estudio', 'instructor', 'Instructor/a', 30, array['socios:read','calendario:read','calendario:write']),
  ('fitness-estudio', 'recepcionista', 'Recepcionista', 40, array['socios:read','socios:write','clientes:read','clientes:write','calendario:read','calendario:write','caja:read','caja:write','facturacion:read']),

  ('fitness-spa', 'terapeuta', 'Terapeuta', 30, array['socios:read','calendario:read','catalogos:read','cotizaciones:read']),
  ('fitness-spa', 'recepcionista', 'Recepcionista', 40, array['socios:read','socios:write','clientes:read','clientes:write','calendario:read','calendario:write','caja:read','caja:write','pos:read','pos:write','facturacion:read']),

  ('fitness-centro', 'terapeuta', 'Terapeuta', 30, array['socios:read','pacientes:read','pacientes:write','calendario:read']),
  ('fitness-centro', 'recepcionista', 'Recepcionista', 40, array['socios:read','socios:write','pacientes:read','clientes:read','clientes:write','calendario:read','calendario:write','caja:read','caja:write','facturacion:read']),

  -- Agro ─────────────────────────────────────────────────────────────────
  ('agro-permanente', 'administrador', 'Administrador/a de finca', 30, array['agro:read','agro:write','inventario:read','inventario:write','compras:read','compras:write','mantenimiento:read','flota:read']),
  ('agro-permanente', 'tecnico', 'Técnico/a de campo', 40, array['agro:read','agro:write','trazabilidad:read']),
  ('agro-permanente', 'capataz', 'Capataz', 50, array['agro:read','agro:write','asistencia:read','asistencia:write']),

  ('agro-transitorio', 'administrador', 'Administrador/a de finca', 30, array['agro:read','agro:write','inventario:read','inventario:write','compras:read','compras:write','produccion:read','produccion:write','mantenimiento:read','flota:read']),
  ('agro-transitorio', 'tecnico', 'Técnico/a de campo', 40, array['agro:read','agro:write','produccion:read']),
  ('agro-transitorio', 'capataz', 'Capataz', 50, array['agro:read','agro:write','asistencia:read','asistencia:write']),

  ('agro-ganaderia', 'administrador', 'Administrador/a de finca', 30, array['agro:read','agro:write','produccion:read','produccion:write','inventario:read','inventario:write','compras:read','compras:write','mantenimiento:read']),
  ('agro-ganaderia', 'veterinario', 'Veterinario/a de campo', 40, array['agro:read','agro:write','trazabilidad:read','produccion:read']),
  ('agro-ganaderia', 'capataz', 'Capataz', 50, array['agro:read','agro:write','asistencia:read','asistencia:write']),

  ('agro-poscosecha', 'administrador', 'Administrador/a', 30, array['agro:read','agro:write','produccion:read','produccion:write','inventario:read','inventario:write','compras:read','compras:write','catalogos:read','catalogos:write']),
  ('agro-poscosecha', 'calidad', 'Supervisor/a de calidad', 40, array['trazabilidad:read','produccion:read','agro:read']),
  ('agro-poscosecha', 'operario', 'Operario/a', 50, array['produccion:read','produccion:write','agro:read'])
;

insert into public.sector_roles (sector_key, role_key, label, rank, permissions) values

  -- Construcción ────────────────────────────────────────────────────────
  ('construccion-civil', 'residente', 'Residente de obra', 30, array['proyectos:read','proyectos:write','riesgos:read','hseq:read','calendario:read']),
  ('construccion-civil', 'almacenista', 'Almacenista', 40, array['inventario:read','inventario:write','compras:read','proyectos:read']),
  ('construccion-civil', 'administrativo', 'Administrativo/a de obra', 50, array['clientes:read','facturacion:read','contratos:read','documentos:read','flota:read']),

  ('construccion-mep', 'ingeniero', 'Ingeniero/a', 30, array['proyectos:read','proyectos:write','catalogos:read','catalogos:write','cotizaciones:read','cotizaciones:write','compras:read']),
  ('construccion-mep', 'instalador', 'Instalador/a', 40, array['proyectos:read','catalogos:read','inventario:read']),
  ('construccion-mep', 'almacenista', 'Almacenista', 50, array['inventario:read','inventario:write','compras:read','proyectos:read']),

  ('construccion-remodel', 'disenador', 'Diseñador/a', 30, array['proyectos:read','proyectos:write','cotizaciones:read','cotizaciones:write','catalogos:read','clientes:read','clientes:write']),
  ('construccion-remodel', 'oficial', 'Oficial de obra', 40, array['proyectos:read','inventario:read']),
  ('construccion-remodel', 'administrativo', 'Administrativo/a', 50, array['clientes:read','facturacion:read','cotizaciones:read','documentos:read']),

  ('construccion-interv', 'supervisor', 'Supervisor/a', 30, array['proyectos:read','proyectos:write','trazabilidad:read','riesgos:read','calendario:read']),
  ('construccion-interv', 'inspector', 'Inspector/a', 40, array['trazabilidad:read','proyectos:read','documentos:read','firmas:read']),
  ('construccion-interv', 'coordinador', 'Coordinador/a', 50, array['proyectos:read','proyectos:write','clientes:read','calendario:read','calendario:write']),

  -- Manufactura ─────────────────────────────────────────────────────────
  ('manufactura-metal', 'jefe-produccion', 'Jefe/a de producción', 30, array['produccion:read','produccion:write','inventario:read','compras:read','proyectos:read']),
  ('manufactura-metal', 'operario', 'Operario/a', 40, array['produccion:read','inventario:read','asistencia:read']),
  ('manufactura-metal', 'calidad', 'Control de calidad', 50, array['produccion:read','inventario:read']),

  ('manufactura-plastico', 'jefe-produccion', 'Jefe/a de producción', 30, array['produccion:read','produccion:write','inventario:read','compras:read']),
  ('manufactura-plastico', 'operario', 'Operario/a', 40, array['produccion:read','inventario:read']),
  ('manufactura-plastico', 'calidad', 'Control de calidad', 50, array['trazabilidad:read','produccion:read']),

  ('manufactura-textil', 'disenador', 'Diseñador/a', 30, array['catalogos:read','catalogos:write','produccion:read','tienda:read']),
  ('manufactura-textil', 'patronista', 'Patronista', 40, array['produccion:read','produccion:write','catalogos:read']),
  ('manufactura-textil', 'despachador', 'Despachador/a', 50, array['tienda:read','inventario:read','facturacion:read']),

  ('manufactura-alimentos', 'jefe-produccion', 'Jefe/a de producción', 30, array['produccion:read','produccion:write','inventario:read','compras:read']),
  ('manufactura-alimentos', 'operario', 'Operario/a', 40, array['produccion:read','inventario:read']),
  ('manufactura-alimentos', 'calidad', 'Control de calidad', 50, array['trazabilidad:read','produccion:read']),

  -- Servicios profesionales ─────────────────────────────────────────────
  ('servicios-consultoria', 'consultor', 'Consultor/a', 30, array['proyectos:read','proyectos:write','consultoria:read','consultoria:write','clientes:read','cotizaciones:read','calendario:read']),
  ('servicios-consultoria', 'analista', 'Analista', 40, array['proyectos:read','consultoria:read','documentos:read']),
  ('servicios-consultoria', 'gerente-cuenta', 'Gerente/a de cuenta', 50, array['clientes:read','clientes:write','facturacion:read','contratos:read','desempeno:read']),

  ('servicios-contable', 'contador', 'Contador/a', 30, array['clientes:read','clientes:write','facturacion:read','facturacion:write','trazabilidad:read','documentos:read']),
  ('servicios-contable', 'auxiliar', 'Auxiliar contable', 40, array['clientes:read','facturacion:read','trazabilidad:read']),
  ('servicios-contable', 'socio', 'Socio/a', 50, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','firmas:read','calendario:read']),

  ('servicios-legal', 'abogado', 'Abogado/a', 30, array['clientes:read','clientes:write','contratos:read','contratos:write','firmas:read','firmas:write','trazabilidad:read','calendario:read']),
  ('servicios-legal', 'paralegal', 'Paralegal', 40, array['clientes:read','documentos:read','documentos:write','trazabilidad:read','calendario:read']),

  ('servicios-agencia', 'creativo', 'Creativo/a', 30, array['proyectos:read','proyectos:write','clientes:read','documentos:read','calendario:read']),
  ('servicios-agencia', 'ejecutivo-cuenta', 'Ejecutivo/a de cuenta', 40, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','proyectos:read','calendario:read']),
  ('servicios-agencia', 'reclutador', 'Reclutador/a', 50, array['reclutamiento:read','reclutamiento:write','desempeno:read','clientes:read']),

  ('servicios-ti', 'ingeniero', 'Ingeniero/a', 30, array['proyectos:read','proyectos:write','clientes:read','inventario:read','tickets:read','tickets:write']),
  ('servicios-ti', 'soporte', 'Soporte', 40, array['tickets:read','tickets:write','clientes:read','inventario:read']),
  ('servicios-ti', 'gerente', 'Gerente/a', 50, array['clientes:read','clientes:write','facturacion:read','desempeno:read','cotizaciones:read']),

  -- Logística ───────────────────────────────────────────────────────────
  ('logistica-carga', 'conductor', 'Conductor/a', 30, array['flota:read','calendario:read','documentos:read']),
  ('logistica-carga', 'despachador', 'Despachador/a', 40, array['flota:read','flota:write','inventario:read','calendario:read','calendario:write']),
  ('logistica-carga', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','contratos:read','facturacion:read','cotizaciones:read']),

  ('logistica-ultima', 'repartidor', 'Repartidor/a', 30, array['flota:read','tienda:read','ecommerce:read','calendario:read']),
  ('logistica-ultima', 'despachador', 'Despachador/a', 40, array['flota:read','flota:write','inventario:read','ecommerce:read','calendario:read','calendario:write']),
  ('logistica-ultima', 'soporte', 'Soporte al cliente', 50, array['clientes:read','clientes:write','tickets:read','tickets:write','ecommerce:read']),

  ('logistica-bodegaje', 'jefe-bodega', 'Jefe/a de bodega', 30, array['inventario:read','inventario:write','compras:read','calendario:read']),
  ('logistica-bodegaje', 'operario', 'Operario/a', 40, array['inventario:read','asistencia:read']),
  ('logistica-bodegaje', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','contratos:read','facturacion:read']),

  -- Inmobiliario ────────────────────────────────────────────────────────
  ('inmobiliario-arriendo', 'asesor', 'Asesor/a', 30, array['inmobiliario:read','inmobiliario:write','clientes:read','clientes:write','contratos:read','contratos:write','calendario:read']),
  ('inmobiliario-arriendo', 'administrador', 'Administrador/a', 40, array['inmobiliario:read','inmobiliario:write','facturacion:read','mantenimiento:read','tickets:read']),
  ('inmobiliario-arriendo', 'conserje', 'Conserje', 50, array['mantenimiento:read','mantenimiento:write','tickets:read','tickets:write','calendario:read']),

  ('inmobiliario-ph', 'administrador', 'Administrador/a', 30, array['inmobiliario:read','inmobiliario:write','facturacion:read','contratos:read','tickets:read','tickets:write','calendario:read']),
  ('inmobiliario-ph', 'consejo', 'Consejo de administración', 40, array['documentos:read','firmas:read','calendario:read']),
  ('inmobiliario-ph', 'conserje', 'Conserje', 50, array['mantenimiento:read','mantenimiento:write','riesgos:read','hseq:read','tickets:read','tickets:write']),

  ('inmobiliario-corretaje', 'agente', 'Agente inmobiliario/a', 30, array['inmobiliario:read','inmobiliario:write','clientes:read','clientes:write','calendario:read','calendario:write']),
  ('inmobiliario-corretaje', 'coordinador', 'Coordinador/a', 40, array['inmobiliario:read','clientes:read','clientes:write','desempeno:read','documentos:read']),
  ('inmobiliario-corretaje', 'cierre', 'Gestor/a de cierre', 50, array['clientes:read','contratos:read','contratos:write','facturacion:read','firmas:read','firmas:write']),

  -- Educación ───────────────────────────────────────────────────────────
  ('educacion-colegio', 'docente', 'Docente', 30, array['estudiantes:read','estudiantes:write','capacitacion:read','calendario:read','canales:read']),
  ('educacion-colegio', 'coordinador', 'Coordinador/a', 40, array['estudiantes:read','estudiantes:write','desempeno:read','calendario:read','calendario:write']),
  ('educacion-colegio', 'secretaria', 'Secretaría', 50, array['estudiantes:read','estudiantes:write','clientes:read','facturacion:read','documentos:read','calendario:read','calendario:write']),

  ('educacion-instituto', 'docente', 'Docente', 30, array['estudiantes:read','estudiantes:write','capacitacion:read','calendario:read']),
  ('educacion-instituto', 'coordinador', 'Coordinador/a', 40, array['estudiantes:read','estudiantes:write','proyectos:read','calendario:read','calendario:write']),
  ('educacion-instituto', 'admisiones', 'Admisiones', 50, array['estudiantes:read','estudiantes:write','clientes:read','clientes:write','facturacion:read']),

  ('educacion-academia', 'instructor', 'Instructor/a', 30, array['estudiantes:read','estudiantes:write','capacitacion:read','capacitacion:write','calendario:read']),
  ('educacion-academia', 'recepcion', 'Recepción', 40, array['estudiantes:read','clientes:read','clientes:write','facturacion:read','calendario:read','calendario:write']),

  ('educacion-universidad', 'docente', 'Docente', 30, array['estudiantes:read','estudiantes:write','calendario:read','canales:read']),
  ('educacion-universidad', 'coordinador', 'Coordinador/a', 40, array['estudiantes:read','estudiantes:write','desempeno:read','calendario:read','calendario:write','proyectos:read']),
  ('educacion-universidad', 'admisiones', 'Admisiones', 50, array['estudiantes:read','estudiantes:write','clientes:read','clientes:write','facturacion:read','reclutamiento:read','trazabilidad:read'])
;

-- ─── Seed: los sugeridos llegan con la empresa ──────────────────────────────

/**
 * Redefinida para sembrar también los roles sugeridos del subsector (o del
 * sector, si no hay subsector) junto a sus grants.
 *
 * Idempotente: `on conflict do nothing` en roles y grants, así que
 * re-ejecutarla (backfill, botón de la UI) no duplica nada.
 */
create or replace function app.seed_default_roles(p_org_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.roles (org_id, key, label, rank, is_system) values
    (p_org_id, 'Administrador',   'Administrador',   10, true),
    (p_org_id, 'Líder de equipo', 'Líder de equipo', 20, true),
    (p_org_id, 'Empleado',        'Empleado',        30, true)
  on conflict (org_id, key) do nothing;

  insert into public.roles (org_id, key, label, rank, is_system)
  select p_org_id, sr.role_key, sr.label, sr.rank, true
  from public.sector_roles sr
  where sr.sector_key = coalesce(
    (select subsector from public.organizations where id = p_org_id),
    (select company_type from public.organizations where id = p_org_id)
  )
  on conflict (org_id, key) do nothing;

  insert into public.role_permissions (org_id, role, permission)
  select p_org_id, sr.role_key, p
  from public.sector_roles sr
  cross join lateral unnest(sr.permissions) as p
  where sr.sector_key = coalesce(
    (select subsector from public.organizations where id = p_org_id),
    (select company_type from public.organizations where id = p_org_id)
  )
    and exists (
      select 1 from public.roles r
      where r.org_id = p_org_id and r.key = sr.role_key
    )
  on conflict (org_id, role, permission) do nothing;
$$;

revoke all on function app.seed_default_roles(uuid) from public, anon, authenticated;

/**
 * El botón de la UI: vuelve a sembrar los sugeridos de ESTA empresa.
 * Autorización: `configuracion:manage`, igual que cualquier otra
 * operación de administración.
 */
create or replace function public.seed_suggested_roles(p_org_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para continuar.' using errcode = 'insufficient_privilege';
  end if;

  if p_org_id is null or p_org_id not in (select app.orgs_with('configuracion:manage')) then
    raise exception 'No puedes administrar esta empresa.' using errcode = 'insufficient_privilege';
  end if;

  perform app.seed_default_roles(p_org_id);

  return true;
end;
$$;

revoke all on function public.seed_suggested_roles(uuid) from public, anon;
grant execute on function public.seed_suggested_roles(uuid) to authenticated;

-- ─── Backfill: empresas existentes reciben sus sugeridos ────────────────────

select app.seed_default_roles(o.id) from public.organizations o;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.seed_suggested_roles(uuid);
--   drop trigger if exists sector_roles_guard on public.sector_roles;
--   drop function if exists app.guard_sector_role();
--   drop table    if exists public.sector_roles;
--   drop function if exists app.valid_permission_keys(text[]);
--
-- Los roles ya sembrados a partir de esta tabla son filas normales de
-- `public.roles` y se quedan: borrarlas automáticamente quitaría trabajo que
-- el cliente ya editó. Si se quieren limpiar, hágalo a mano por empresa.
-- ═══════════════════════════════════════════════════════════════════════════
