# Auditoría y arquitectura objetivo — Kigyo

**Alcance:** auditoría del repo en `feat/design-system-refresh`, validación y ampliación del plan original de arquitectura multiempresa (ejecutado y absorbido en este documento y en `AGENTS.md`).
**Estado:** documento de análisis y decisión. **No se modificó ningún archivo de código.**
**Fecha:** 2026-08-10

---

## Resumen ejecutivo

El repo está mucho mejor construido de lo que un plan de "reescribir la arquitectura" asume. El aislamiento multi-tenant es real, está en la base de datos, es generado por función (no escrito a mano por tabla) y tiene tests. La composición plan → módulos → permisos ya existe y es coherente en cuatro capas (DB, server, API, cliente).

El problema no es que la arquitectura sea mala. El problema es que **`organizations` hace tres trabajos a la vez** (cuenta/billing, empresa operativa, contenedor de datos) y que **`getMember()` resuelve exactamente una membresía** (`src/lib/auth/session.ts:83-86`), de modo que un usuario en dos organizaciones solo ve la primera.

**Divergencia central con el plan actual:** el plan propone crear `companies` bajo `organizations` y añadir `company_id` a las tablas operativas (Fase 5). Eso significa tocar **66+ tablas**, **787 apariciones de `org_id` en 82 archivos** y **reescribir todas las políticas RLS**. Es la fase con más riesgo de fuga de datos de todo el plan, y es evitable.

**Recomendación:** invertir la dirección. `organizations` **ya es** la empresa operativa. Crear `accounts` **por encima**, mover billing allí, y multiempresa se convierte en "el usuario tiene N membresías dentro de un mismo account". Coste en tablas operativas: **cero**. Coste en políticas RLS: **cero**. Detalle y trade-offs en la sección **C**.

---

## A. Estado actual

### A.1 Stack y estructura

| Capa | Tecnología | Nota |
|---|---|---|
| Framework | Next.js 16.3 (App Router) | El middleware vive en `src/proxy.ts`, no `middleware.ts` |
| UI | React 19.2, Tailwind v4, framer-motion | |
| Datos | Supabase (`@supabase/ssr` 0.12) | **Sin ORM.** PostgREST vía `supabase-js` |
| Validación | Zod v4 | |
| IA | AI SDK v7 + `@ai-sdk/azure` | Azure AI Foundry |
| Tests | Vitest (unit), Playwright (e2e), pgTAP-like (`supabase/tests/rls`) | |

```
src/
  app/(auth)/            login, register, forgot-password
  app/(dashboard)/dashboard/<modulo>/{page,client,loading}.tsx   ← 37 rutas
  app/api/               auth/*, ai/*, demo/request, v1/export
  components/{layout,ui,marketing}
  lib/
    auth/{session,permissions}.ts     ← el corazón de la autorización
    modules.ts  plans.ts  domain.ts
    supabase/{server,client,admin,types}.ts
    api/{handler,errors,rate-limit,client}.ts
    context/{MemberContext,AppContext,ThemeContext,SoundContext}.tsx
    data/nav.ts
  server/
    queries/    (41 archivos)   lectura
    mutations/  (34 archivos)   escritura + 'use server'
    actions/    (32 archivos)   Server Functions de paginado/export
  proxy.ts                       CSP + refresh de sesión + redirect UX
supabase/
  migrations/   25 archivos      ~113 tablas
  tests/rls/    4 archivos
```

~69.000 LOC de TS/TSX.

### A.2 Multi-tenancy actual

**Un solo nivel: `public.organizations` es el tenant.**

Toda tabla operativa lleva `org_id uuid not null references organizations(id) on delete cascade` (66 declaraciones). El aislamiento no está escrito a mano por tabla — se genera:

- `app.orgs_with(p_permission text)` → `setof uuid` (`01_core.sql:227`). `SECURITY DEFINER`, `STABLE` (Postgres la sube a InitPlan: se evalúa una vez por query, no por fila). Devuelve los `org_id` donde el usuario tiene ese permiso vía `memberships ⋈ role_permissions`.
- `app.apply_standard_rls(tabla, perm_read, perm_write)` (`01_core.sql:265`) genera las 4 políticas con la misma forma para toda tabla raíz.
- `app.apply_child_rls(tabla, padre, fk, perm_read, perm_write)` (`01_core.sql:304`) hace que las líneas (items de factura, comentarios) hereden el aislamiento del padre en vez de duplicar un `org_id` que podría discrepar.
- `alter table ... force row level security` en todas: ni el owner de la tabla la elude.

**Esto es el activo más valioso del repositorio.** El comentario en `01_core.sql:264` lo dice bien: generar las políticas elimina la posibilidad de que una se olvide o se escriba sutilmente mal, que es exactamente como ocurren las fugas.

**Storage** (`07_storage.sql`): dos buckets privados, layout de clave `{org_id}/...`, política anclada al primer segmento del path vía `app.orgs_with('documentos:read')`. Lecturas por URL firmada de vida corta.

**Auditoría** (`05_audit.sql`): `audit_log` con `org_id`, trigger `app.audit_row` adjunto a las tablas de negocio, RLS por `trazabilidad:read`.

### A.3 Autenticación

- Supabase Auth. `getMember()` en `src/lib/auth/session.ts:43`, envuelto en `cache()` de React → una sola resolución por request compartida por layout, page y Server Functions.
- Usa `getUser()` y no `getSession()` a propósito: revalida el JWT contra el servidor de auth (`session.ts:35-41`).
- Chequeo MFA: si `aal.nextLevel === 'aal2'` y `currentLevel !== 'aal2'`, devuelve `null` (`session.ts:72-73`). Hecho aquí y no en el proxy para cubrir también Server Functions.
- Signup: trigger `public.handle_new_user` (última versión en `24_custom_roles.sql:323`). En una sola transacción crea `profiles` → resuelve invitación pendiente **o** crea `organizations` + `app.seed_default_roles` + `memberships` + `app.seed_default_permissions`.
- Reparación: `app.backfill_orphan_accounts()` (`09` + redefinida en `24`) para usuarios cuyo trigger no corrió.

### A.4 Autorización — tres puertas compuestas

`requirePermission(permission)` (`session.ts:203`) evalúa de fuera hacia dentro, y cada refusal tiene su propio error porque cada uno tiene un arreglo distinto:

| Orden | Pregunta | Fuente | Error |
|---|---|---|---|
| 1 | ¿lo compró? | `organizations.plan` → `planAllows()` | `PlanRequiredError` |
| 2 | ¿lo usa? | `organizations.enabled_modules` → `member.modules` | `ModuleDisabledError` |
| 3 | ¿puede abrirlo? | `role_permissions` → `can()` | `PermissionError` |

Vocabulario único `<module>:<action>` con `action in (read, write, manage, use)`, con CHECK constraint en `permissions.key` (`01_core.sql:131`).

Espejos coherentes de la misma lógica:
- Cliente: `MemberContext.tsx:61` — `modules.has(...) && can(...)`
- API: `src/lib/api/handler.ts:52-60` — mismas dos puertas para route handlers
- Pickers compartidos: `src/server/queries/shared.ts:89` (`allows()`)
- DB: RLS vía `app.orgs_with(permission)`

`getMember()` aplica el filtro de plan **una vez**, en `resolveModules(enabled, type, planModules(plan))` (`session.ts:123`), de modo que ningún call site puede discrepar sobre qué incluye la suscripción.

### A.5 Roles

Desde `24_custom_roles.sql` los roles son **filas del tenant**, no datos de referencia:

- `public.roles (org_id, key, label, rank, is_system)`, PK `(org_id, key)`.
- FKs compuestas `(org_id, role)` desde `memberships`, `role_permissions`, `invitations`, `employees.access_role` → una membresía no puede nombrar el rol de otro tenant.
- "Administrador" dejó de ser un literal: `app.is_org_admin(org_id)` pregunta si el usuario **tiene `configuracion:manage`** (`24:227`). Definición estrictamente más amplia y la única que sobrevive a que el cliente renombre las cosas.
- Anti-lockout: dos `constraint trigger ... deferrable initially immediate` sobre `memberships` y `role_permissions` que rechazan cualquier statement que deje cero personas con `configuracion:manage` (`24:303`, `24:316`). No cubren INSERT a propósito, porque eso rompería el signup.

### A.6 Módulos

- Catálogo en `src/lib/modules.ts:63` — 35 módulos, 5 grupos (`Personas`, `Operación`, `Comercial`, `Colaboración`, `Sectoriales`).
- `CORE_MODULES = ['dashboard', 'configuracion']` — la carcasa, no conmutable.
- `organizations.enabled_modules text[]` con constraint `app.valid_module_keys()`.
- **Semántica importante:** array vacío significa *"nunca configurado"*, **no** *"todo apagado"* (`11_org_modules.sql`, `resolveModules()` en `modules.ts:341`). `updateModules` rechaza guardar un array vacío por esa razón (`settings.ts:452`).

### A.7 Sectores

- `organizations.company_type` — 22 valores, CHECK constraint en `14_plans_and_sectors.sql`.
- Presets en TypeScript (`COMPANY_TYPES`, `modules.ts:168`), **no en la base de datos**.
- **Ya funcionan como sugerencia y no como jaula:** elegir sector propone un preset, los toggles lo enmiendan, y `updateModules` guarda la lista enmendada (`settings.ts:390-397`).
- Los presets se inclinan deliberadamente *por debajo*, no por encima (`modules.ts:151-167`) — buen criterio de producto, documentado.
- `sectorStart(key, allowed)` (`modules.ts:372`) divide el preset en "incluido en tu plan" vs "bloqueado", y el registro lo muestra. Evita prometer al cliente de una clínica un módulo de pacientes que no encontrará.
- **Sin subsectores.**
- Test `src/lib/modules.test.ts:93` fija el CHECK constraint contra `COMPANY_TYPE_KEYS` en ambas direcciones.

### A.8 Billing

- `organizations.plan text` — `starter | growth | enterprise` (`14_plans_and_sectors.sql`).
- Trigger `app.guard_plan_change` rechaza el cambio cuando `current_user = 'authenticated'`. Se usó trigger y no `REVOKE` por columna porque Postgres no resta una columna de un grant a nivel tabla, y un re-GRANT por columna se rompería en la siguiente migración que añada una.
- Definición en `src/lib/plans.ts`: `modules[]` acumulativo por construcción, `seats` (10 / null / null).
- Enforcement de asientos: **nivel aplicación** en `inviteMember` (`settings.ts:619-643`), contando membresías + invitaciones vigentes. Documentado como aceptable: solo un admin escribe invitaciones, así que el peor caso es discrepancia de facturación, no fuga de tenant.
- **Sin proveedor de pagos.** El plan se cambia con `npm run db:plan` (`scripts/set-plan.mjs`).
- Filas anteriores al plan se abuelaron a `enterprise` para no quitarles módulos en uso.

### A.9 Onboarding

**Un solo paso: el formulario de registro** (`src/app/(auth)/register/page.tsx`, 327 líneas).

Campos: nombre, email, contraseña, empresa, sector (`<select>` con los 22 `COMPANY_TYPES`), con preview en vivo de qué módulos trae ese sector en Starter (`sectorPreview`, línea 25). El sector se pasa en `raw_user_meta_data.company_type` y el trigger lo valida contra la misma lista (dropeándolo si no la reconoce, en vez de abortar el signup — decisión correcta).

No hay wizard posterior. `src/components/ui/PrimerosPasos.tsx` es un panel de primeros pasos dentro del dashboard.

### A.10 Navegación

`src/lib/data/nav.ts` exporta cuatro estructuras paralelas del mismo vocabulario: `NAV` (secciones + iconos), `META` (título), `META_SUB` (subtítulo), `ROUTE_MAP` (key → ruta). El `Sidebar` filtra cada item por `member.can(...)`, que ya pliega plan + módulos + permiso.

`ROUTE_PERMISSIONS` (`permissions.ts:130`) mapea segmento → permiso, pero **no es un guard**: cada `page.tsx` llama `requirePermission()` por su cuenta.

### A.11 Módulos existentes (37 rutas de dashboard)

Personas: empleados, asistencia, nomina, riesgos, reclutamiento, capacitacion, desempeno
Operación: proyectos, hseq, inventario, mantenimiento, flota, produccion, trazabilidad
Comercial: clientes, cotizaciones, facturacion, compras, ordenes-compra, catalogos, tienda, ecommerce
Colaboración: canales, tickets, firmas, documentos, contratos, calendario, consultoria, ia
Sectoriales: pacientes, estudiantes, restaurante, agro, inmobiliario, hoteleria
Carcasa: dashboard, configuracion

---

## B. Problemas

### B.1 Bloqueantes para multiempresa

**P1 — `getMember()` solo resuelve una membresía.**
`src/lib/auth/session.ts:83-86`:
```
.eq('user_id', user.id)
.order('created_at', { ascending: true })
.limit(1)
.maybeSingle()
```
Un usuario que pertenece a dos organizaciones ve permanentemente la primera. No hay manera de cambiar. Este es, hoy, **el único bloqueante técnico real** de multiempresa: el resto del sistema ya soporta que un usuario tenga N membresías (el esquema lo permite, RLS lo permite, `app.orgs_with` devuelve un `setof uuid`, no un uuid).

**P2 — `organizations` hace tres trabajos.**
Es simultáneamente la cuenta (billing, `plan`, límites), la empresa operativa (sector, módulos, datos fiscales implícitos) y el contenedor de aislamiento (`org_id` en 66 tablas). Mientras sean lo mismo, no se puede tener dos empresas bajo una suscripción.

**P3 — Configuración de producto atada al tenant de datos.**
`company_type`, `enabled_modules` y `plan` viven todos en `organizations`. No hay forma de que la empresa A sea una clínica con `pacientes` y la empresa B del mismo grupo sea un restaurante con `restaurante`.

**P4 — Añadir `company_id` a las tablas operativas no aísla nada por sí solo.**
El primitivo de RLS es `org_id in (select app.orgs_with(...))`. Si se añade `company_id` a 66 tablas pero las políticas siguen consultando `org_id`, el aislamiento entre empresas **no existe en la base de datos** — solo en la capa de query. Cualquier query que olvide el `.eq('company_id', ...)` filtra datos entre empresas del mismo grupo. Esta es la trampa exacta que el plan actual, en su Fase 5, se acerca a pisar; el propio plan lo reconoce en el riesgo 6.2.

**P5 — Superficie de cambio si se sigue el plan tal cual.**
787 apariciones de `org_id` en 82 archivos de `src/`. 602 usos de `orgId`. 66 tablas con `org_id not null`. 113 tablas totales. Cada uno es una oportunidad de olvidar un filtro.

### B.2 Deuda que la migración agrava

**P6 — El vocabulario de módulos está duplicado en cinco lugares.**

| Lugar | Qué guarda |
|---|---|
| `src/lib/modules.ts` `MODULES` | key, label, descripción, grupo |
| `src/lib/auth/permissions.ts` `PERMISSIONS` | `<module>:<action>` |
| `src/lib/data/nav.ts` | `NAV`, `META`, `META_SUB`, `ROUTE_MAP` |
| `public.permissions` (SQL, mig. 01 + 14) | catálogo en DB |
| `app.valid_module_keys()` (SQL, mig. 11 + 14) | lista literal de keys válidas |

Hoy están sincronizados (verificado: 35 módulos, cobertura completa en las cinco listas). Pero:
- `permissions.test.ts` **sí** fija el catálogo TS contra los INSERT de las migraciones.
- `modules.test.ts:93` **sí** fija el CHECK de `company_type`.
- **Nada fija `app.valid_module_keys()` contra `MODULE_KEYS`.** Añadir un módulo y olvidar esa función produce un `check_violation` opaco al guardar módulos, sin ningún test que lo atrape.

Añadir "módulos por empresa" multiplica el coste de cada desincronización.

**P7 — Sectores en dos sitios con acoplamiento de deploy.**
El enum vive en un CHECK constraint SQL; los presets viven en TS. Añadir un sector = migración + deploy. El plan pide 12 sectores nuevos y subsectores: con este diseño, cada uno es una migración. No hay tabla de sectores, ni subsectores, ni relación plantilla→módulos consultable.

**P8 — Sin dependencias entre módulos.**
`tienda` se puede activar sin `catalogos`. `ecommerce` sin `tienda`. `place_storefront_order` (`12_place_order.sql`) asume que existen productos y una sesión de caja. No existe `module_dependencies` ni validación al activar.

**P9 — `employees.location` es texto libre.**
`02_people.sql:23`. Es una proto-sucursal sin estructura, sin FK, sin poder filtrar ni asignar permisos por ella. Cuando se cree `sites`, este campo será una migración de datos sucia (texto libre escrito por clientes).

**P10 — Dos fuentes de verdad del rol de una persona.**
`memberships.role` (el usuario autenticado) y `employees.access_role` (`02_people.sql:28`) coexisten. Ambos referencian `roles(org_id, key)` desde la migración 24, pero nada los mantiene iguales, y `getMember()` solo lee el primero. Un empleado con cuenta puede tener dos roles distintos según a quién se pregunte.

**P11 — Roles y permisos son globales por organización.**
No se puede expresar "Ana administra la empresa A y solo lee la empresa B". Con la propuesta de la sección C esto se resuelve gratis (una membresía por empresa), pero conviene decirlo explícitamente porque hoy es imposible.

**P12 — El plan solo gatea módulos y asientos.**
No hay `max_companies`, `max_sites`, ni política de downgrade. Un downgrade hoy quitaría módulos silenciosamente (mitigado solo porque `getMember` filtra en lectura y `updateModules` rechaza en escritura, pero la configuración guardada queda inconsistente con el plan).

**P13 — Onboarding de un solo paso.**
Sin datos legales/fiscales, sin invitación de equipo, sin edición de módulos antes de entrar, sin ruta para "crear una segunda empresa".

**P14 — Bug de producto en el modo manual.**
`presetFor(null)` devuelve **todo el catálogo** (`modules.ts:324`: `companyType(key)?.modules ?? [...MODULE_KEYS]`). Combinado con `resolveModules`, una organización sin sector y sin `enabled_modules` arranca con los 35 módulos encendidos. Para cuentas antiguas es el fallback correcto y deliberado; para el "modo configurar manualmente" que pide el producto es exactamente el resultado equivocado — el usuario que elige configurar a mano recibe la barra lateral más saturada posible.

**P15 — Los guards de ruta se aplican a mano, 37 veces.**
`ROUTE_PERMISSIONS` existe pero no lo consume ningún guard central. Olvidar `requirePermission()` en una `page.tsx` nueva no rompe ningún test. RLS es el respaldo real, pero el respaldo devuelve una lista vacía, no un 403 explicable.

---

## C. Arquitectura propuesta

### C.1 La decisión central: dirección de la jerarquía

El plan actual propone `Organization → Company (nueva) → Site`. Hay dos formas de llegar a una jerarquía de tres niveles, y difieren radicalmente en riesgo.

#### Opción 1 — Company nueva debajo (lo que dice el plan actual)

Crear `companies` hija de `organizations`, añadir `company_id` a las 66 tablas operativas, backfill 1:1, reescribir RLS para que el primitivo sea `company_id in (select app.companies_with(...))`.

- **Superficie:** 66 tablas, ~787 call sites, 100% de las políticas RLS, `app.orgs_with` / `apply_standard_rls` / `apply_child_rls` / `next_code` / `audit_row` / storage.
- **Ventaja:** el modelo final es nominalmente limpio — `organizations` queda como cuenta pura.
- **Riesgo:** durante la transición conviven dos primitivos de aislamiento. Cualquier tabla que quede con RLS sobre `org_id` y datos de dos empresas es una fuga entre empresas del mismo grupo. Y "empresas del mismo grupo" es precisamente el caso que un cliente notará y reportará.

#### Opción 2 — Account nuevo por encima ⭐ recomendada

`organizations` **ya es** la empresa operativa: tiene sector, módulos, datos, códigos correlativos, storage y auditoría. Lo que le sobra es el rol de cuenta.

Entonces:
- Se crea `public.accounts` **por encima**: `id, name, plan, billing_*, límites, onboarding_completed_at`.
- `organizations` gana `account_id uuid not null references accounts(id)`. Conceptualmente pasa a ser **Company**.
- `plan` **sube** de `organizations` a `accounts`.
- **Multiempresa = N membresías del mismo usuario en N organizations del mismo account.** El esquema ya lo permite.
- **Aislamiento entre empresas = el aislamiento entre organizations que ya existe, ya está generado por función y ya tiene tests.**

| | Opción 1 | Opción 2 |
|---|---|---|
| Tablas operativas modificadas | 66+ | **0** |
| Políticas RLS reescritas | ~264 (4 × 66) | **0** |
| Call sites `.eq('org_id', ...)` a revisar | ~787 | **0** |
| Riesgo de fuga entre empresas | Alto durante la transición | **Ninguno nuevo** |
| Tablas nuevas mínimas | `companies`, `sites`, asignaciones | `accounts`, `account_memberships` |
| Deuda | Ninguna | Nomenclatura: `org_id` significa `company_id` |
| Reversibilidad | Baja (backfill masivo) | Alta (una FK y una columna movida) |

**El trade-off honesto:** la Opción 2 deja una deuda de nombres. `org_id` en 66 tablas querrá decir "id de empresa". Se mitiga con (a) un comentario `comment on column` en cada tabla, (b) una sección explícita en `AGENTS.md`, (c) opcionalmente una vista `public.companies` y tipos TS `CompanyId` que documenten la equivalencia, y (d) si algún día se quiere, una migración cosmética de renombrado que es puramente mecánica y sin riesgo de seguridad.

**Una deuda de nomenclatura es reversible. Una fuga de datos entre empresas de un mismo cliente no lo es.** Recomiendo la Opción 2.

#### Opción 3 — Descartada: base de datos o esquema por empresa

Aislamiento máximo, pero incompatible con Supabase RLS + PostgREST como está montado, con `app.orgs_with`, con el storage por prefijo y con la operación de 113 tablas. No se propone.

### C.2 Modelo objetivo (Opción 2)

```
Account  (cuenta comercial: plan, billing, límites)
  │
  ├── AccountMembership (user × account: owner | billing | admin)
  │
  └── Organization  ≡  COMPANY  (empresa operativa: sector, subsector, módulos, branding, datos fiscales)
        │                        ↑ tabla existente, con account_id añadido
        ├── Membership (user × company: role)     ← ya existe
        ├── Role (company-scoped)                  ← ya existe (mig. 24)
        ├── RolePermission                         ← ya existe
        ├── Site / Sucursal                        ← nuevo, fase posterior
        └── … 66 tablas operativas con org_id      ← sin cambios
```

**Reglas de resolución:**
1. `getMember()` deja de hacer `.limit(1)`; lee **todas** las membresías del usuario.
2. La empresa activa se toma de una cookie httpOnly (`kigyo_ctx`), **validada contra las membresías del usuario en el servidor**. Si no es válida, cae a la default (la más reciente usada, o la primera por `created_at`).
3. `member.orgId` sigue significando lo mismo que hoy — la empresa activa. **Ningún query cambia.**
4. `member.plan` pasa a leerse del `account`, no de la `organization`.
5. RLS sigue siendo **el techo** (qué puede ver este usuario en total). El contexto activo es **el filtro dentro del techo** (qué está viendo ahora). Son cosas distintas y deben seguir siéndolo.

**Riesgo residual a nombrar explícitamente:** si un query olvidara el `.eq('org_id', ...)`, un usuario multiempresa vería filas mezcladas de **sus propias** empresas. No es una fuga cross-tenant (RLS lo impide), pero sí un cruce de contexto. Mitigación en la sección L, fase 8.

---

## D. Modelo de datos

### D.1 Tablas nuevas

```sql
-- La cuenta comercial. Pequeña a propósito: aquí solo va lo que se factura.
create table public.accounts (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  plan                    text not null default 'starter'
                            check (plan in ('starter','growth','enterprise')),
  -- Referencias al proveedor de pagos, nulas hasta que exista uno.
  billing_customer_id     text,
  billing_subscription_id text,
  billing_status          text,
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Quién manda sobre la CUENTA (no sobre los datos de una empresa).
-- Deliberadamente poco granular: son tres decisiones, no una matriz.
create table public.account_memberships (
  account_id  uuid not null references public.accounts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null check (role in ('owner','billing','admin')),
  created_at  timestamptz not null default now(),
  primary key (account_id, user_id)
);

-- Sucursal. Fase posterior; se declara aquí para fijar la forma.
create table public.sites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  code        text,
  name        text not null,
  address     text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, code)
);

-- Catálogo de sectores en DB, para que añadir uno deje de ser un ALTER TABLE.
create table public.sectors (
  key        text primary key,
  label      text not null,
  parent_key text references public.sectors (key),   -- null = sector, no null = subsector
  sort       int not null default 100,
  is_active  boolean not null default true
);

-- Plantilla sector → módulos sugeridos. Sugerencia, nunca restricción.
create table public.sector_modules (
  sector_key  text not null references public.sectors (key) on delete cascade,
  module_key  text not null,
  primary key (sector_key, module_key)
);

-- Dependencias entre módulos.
create table public.module_dependencies (
  module_key   text not null,
  requires_key text not null,
  -- 'hard': no se puede activar sin la dependencia.
  -- 'soft':  se avisa y se ofrece activarla junto.
  kind         text not null default 'soft' check (kind in ('hard','soft')),
  primary key (module_key, requires_key),
  check (module_key <> requires_key)
);
```

### D.2 Columnas nuevas sobre tablas existentes

```sql
alter table public.organizations
  add column account_id  uuid references public.accounts (id) on delete cascade,
  add column subsector   text references public.sectors (key),
  add column legal_name  text,
  add column tax_id      text,
  add column country     text,
  add column currency    text not null default 'COP',
  add column timezone    text not null default 'America/Bogota',
  add column branding    jsonb not null default '{}'::jsonb;   -- logo_url, accent, etc.
```

`organizations.plan` **se mantiene temporalmente** durante el dual-read de la fase 1 y se elimina en la fase 7.

`site_id uuid references sites(id)` se añade **solo a las tablas donde la sucursal es un hecho del negocio** (no a las 66). Candidatas iniciales: `employees`, `inventory_assets`, `cash_sessions`, `restaurant_orders`, `dining_tables`, `hotel_rooms`, `patients` (opcional), `work_orders`. Nullable siempre: una empresa sin sucursales no debe cambiar de comportamiento.

### D.3 Reemplazo del CHECK de `company_type`

```sql
alter table public.organizations drop constraint organizations_company_type_check;
alter table public.organizations
  add constraint organizations_company_type_fkey
  foreign key (company_type) references public.sectors (key);
```

Añadir un sector pasa de ser una migración de esquema a un `insert`. El test `modules.test.ts:93` se reemplaza por uno que compare `COMPANY_TYPES` contra el seed de `public.sectors`.

### D.4 Índices y constraints necesarios

```sql
create index organizations_account_idx   on public.organizations (account_id);
create index account_memberships_user_idx on public.account_memberships (user_id);
create index sites_org_idx                on public.sites (org_id);
create unique index sites_one_default_idx on public.sites (org_id) where is_default;
```

### D.5 Entidades que faltan y no están en el plan actual

- `company_switch_log` o campo `memberships.last_active_at` — para que "la empresa activa por defecto" sea la última usada y no la más antigua.
- `plan_limits` — o mantenerlo en TS junto a `PLANS`. Recomiendo TS (es código, se versiona, se testea).
- `invitations.company_id` ya existe implícito como `org_id`; falta `account_invitations` si se quiere invitar a nivel cuenta.

---

## E. Arquitectura de módulos

### E.1 Registro único

Problema P6: cinco listas del mismo vocabulario. Propuesta: **un solo registro** del que se deriva todo.

```ts
// src/lib/modules/registry.ts
export interface ModuleDef {
  key: string
  label: string
  description: string
  group: ModuleGroup
  icon: IconName
  route: string
  /** Acciones que este módulo define. Genera PERMISSIONS. */
  actions: readonly ('read' | 'write' | 'manage' | 'use')[]
  /** Rutas adicionales que resuelven a este módulo (ej. 'ordenes-compra'). */
  aliases?: readonly string[]
  /** Dependencias duras y blandas. */
  requires?: readonly { key: string; kind: 'hard' | 'soft' }[]
  /** Módulo insignia de un sector; aparece en su preset y en ningún otro. */
  vertical?: string
  meta: { title: string; subtitle: string }
}
```

De ahí se derivan, sin listas paralelas:
- `MODULE_KEYS`, `PERMISSIONS`, `PERMISSION_LABELS`, `MODULE_LABELS`
- `NAV`, `META`, `META_SUB`, `ROUTE_MAP`
- `ROUTE_PERMISSIONS` (incluyendo los alias)
- El seed SQL de `public.permissions` y el cuerpo de `app.valid_module_keys()`, **generados por script** (`scripts/gen-module-sql.mjs`) y verificados por test.

### E.2 Tests que faltan

1. `app.valid_module_keys()` ⟷ `MODULE_KEYS` en ambas direcciones (hoy no existe — hueco real).
2. Toda `page.tsx` bajo `/dashboard` llama `requirePermission` o `requireMember` (arregla P15 mecánicamente).
3. Todo query de `src/server/queries/` filtra por `org_id` o hereda de un padre que lo hace.
4. `module_dependencies` es acíclico.

### E.3 Dependencias

Al activar un módulo:
- **`hard`**: la dependencia se activa junto, sin preguntar, y se informa. Ej. `ecommerce → tienda → catalogos`.
- **`soft`**: se ofrece activarla, marcada. Ej. `facturacion → clientes`.

Al desactivar:
- **Nunca cascada silenciosa.** Se listan los módulos que dependen del que se apaga y se pide confirmación explícita, o se bloquea. Recomiendo **bloquear** con el mensaje "Ecommerce depende de Tienda. Desactiva Ecommerce primero."

Set inicial propuesto (a validar contra el dominio):
```
tienda      → catalogos (hard), inventario (soft)
ecommerce   → tienda (hard)
facturacion → clientes (hard)
cotizaciones→ clientes (soft), catalogos (soft)
nomina      → empleados (hard)
asistencia  → empleados (hard)
desempeno   → empleados (hard)
capacitacion→ empleados (soft)
restaurante → catalogos (soft), inventario (soft)
hoteleria   → clientes (soft)
mantenimiento → inventario (soft)
produccion  → inventario (hard), catalogos (soft)
```

---

## F. Arquitectura de sectores

### F.1 Principio

**El sector es una recomendación, y el producto ya lo trata así.** No hay que cambiarlo — hay que preservarlo explícitamente al añadir subsectores.

Contrato:
1. Elegir sector **propone** un preset y **reemplaza** la selección actual (con confirmación si había cambios manuales).
2. Todo módulo permanece conmutable individualmente después, siempre.
3. El sector nunca aparece en ningún guard: `requirePermission` no lo consulta, RLS no lo consulta.
4. Cambiar de sector nunca borra datos. Solo cambia sugerencias.

### F.2 Sectores y subsectores

```
sectors (key, label, parent_key, sort, is_active)
```

Un subsector es una fila con `parent_key` no nulo. Su preset **hereda** el del padre y lo enmienda:

```
resolveSectorPreset(sector, subsector) =
  (preset(sector) ∪ preset(subsector).add) − preset(subsector).remove
```

Catálogo inicial propuesto (los 22 sectores actuales se conservan tal cual; se añaden subsectores para los prioritarios):

| Sector | Subsectores propuestos |
|---|---|
| salud | Consultorio, IPS/Clínica, Laboratorio, Odontología, Estética, Veterinaria |
| comercio | Retail físico, Mayorista, Ferretería, Farmacia, Supermercado |
| alimentos | Restaurante de salón, Comida rápida, Bar, Catering, Panadería/Producción |
| hoteleria | Hotel, Hostal, Finca/Glamping, Operador turístico |
| educacion | Colegio, Instituto técnico, Academia/Idiomas, Universidad |
| construccion | Obra civil, Instalaciones/MEP, Remodelación, Interventoría |
| manufactura | Metalmecánica, Plásticos, Textil, Alimentos procesados |
| agro | Cultivo permanente, Cultivo transitorio, Ganadería, Poscosecha |
| inmobiliario | Arrendamiento, Propiedad horizontal, Corretaje, Construcción y venta |
| servicios | Consultoría, Contabilidad, Legal, Agencia, TI/Soporte |
| logistica | Transporte de carga, Última milla, Bodegaje, Mensajería |
| tecnologia | SaaS, Desarrollo a la medida, Hardware/IoT |

Además el plan pide un sector **Fitness & Bienestar**, que hoy no existe y caería en "otro". Debe añadirse (gimnasio, estudio, spa, centro de bienestar).

### F.3 Modo manual

Estado explícito, no "sector nulo":

```
organizations.company_type = null  AND  enabled_modules != '{}'   →  modo manual
organizations.company_type = null  AND  enabled_modules  = '{}'   →  nunca configurado (legacy)
```

**Arreglar P14:** el modo manual no debe partir de los 35 módulos. Introducir un preset mínimo explícito y usarlo cuando el usuario elija "configurar manualmente":

```ts
export const MANUAL_START = [...PEOPLE, ...SPINE]   // ~7 módulos
```

`presetFor(null)` debe seguir devolviendo el catálogo completo **solo** para el fallback de cuentas legacy — son dos preguntas distintas y hoy comparten función. Separarlas en `presetFor(sector)` y `legacyFallback()`.

### F.4 Dónde vive la fuente de verdad

| Dato | Fuente | Razón |
|---|---|---|
| Lista de sectores/subsectores | **DB** (`sectors`) | Añadir uno sin migración de esquema |
| Preset sector → módulos | **DB** (`sector_modules`), seeded desde TS | Consultable; permite override por cuenta a futuro |
| Definición de módulos | **TS** (`registry.ts`) | Es código: se versiona, se testea, se tipa |
| Dependencias | **DB** (`module_dependencies`), seeded desde TS | Consultable desde la UI de activación |

El script de seed vive junto a `scripts/gen-db-types.mjs` y un test verifica que DB y TS coinciden, igual que hace hoy `permissions.test.ts`.

---

## G. Onboarding

### G.1 Flujo objetivo

Sacar todo del formulario de registro. El registro solo crea la cuenta de usuario.

```
1. Registro        email + contraseña + nombre                          → auth.users, profiles
2. Cuenta          nombre de la cuenta/grupo                            → accounts, account_memberships(owner)
3. Empresa         nombre comercial, razón social, NIT, país, moneda    → organizations (con account_id)
4. Sector          22 sectores  |  "Configurar manualmente"
5. Subsector       (si el sector tiene)                                 → si no, se salta
6. Módulos         preset editable, con dependencias resueltas en vivo  → enabled_modules
                   y los bloqueados por plan mostrados aparte (ya existe: sectorStart)
7. Sucursales      opcional, saltable                                   → sites
8. Equipo          invitaciones + rol por persona, saltable             → invitations
```

Estado en `accounts.onboarding_completed_at`. Un layout guard en `/dashboard` redirige a `/onboarding` mientras sea null.

**Cada paso es guardable y reanudable.** El trigger `handle_new_user` se simplifica: crea `profiles`, resuelve invitación, y **deja de crear la organización** para los signups no invitados. Eso hay que hacerlo con cuidado — es el punto donde hoy se garantiza atomicidad. Propuesta: mantener el trigger creando `accounts` + `account_memberships(owner)` (barato, sin datos que pedir), y que la empresa la cree el wizard.

### G.2 Crear una segunda empresa

Reusa los pasos 3–8 en `/dashboard/empresas/nueva`. Requiere:
- permiso `configuracion:manage` **a nivel account** (rol `owner` o `admin` en `account_memberships`),
- cupo de plan (`max_companies`),
- crea `organizations` + `app.seed_default_roles` + `app.seed_default_permissions` + `memberships(creador, 'Administrador')` en una transacción — el mismo trío que hoy hace `handle_new_user`, extraído a `app.provision_company(account_id, ...)`.

### G.3 Backfill de cuentas existentes

Cada `organization` existente recibe **su propio `account`** (1:1), con el `plan` copiado y el owner del account = quien tenga `configuracion:manage` más antiguo. `onboarding_completed_at = now()` para que ninguna cuenta viva sea empujada al wizard. Nadie nota nada.

---

## H. Navegación dinámica

1. **Derivar `NAV` del registro de módulos** (sección E.1). Elimina cuatro listas paralelas.
2. **Selector de empresa** en el Sidebar (encima de la navegación, no en el menú de usuario — cambiar de empresa es una acción de contexto, no de perfil). Muestra: logo/inicial + nombre + sector. Al cambiar:
   - se escribe la cookie `kigyo_ctx`,
   - se hace `revalidatePath('/dashboard', 'layout')`,
   - se navega a `/dashboard` (no a la ruta actual: el módulo actual puede no existir en la empresa destino).
3. **Guard de ruta central.** `ROUTE_PERMISSIONS` deja de ser decorativo: un helper `guardModuleRoute(segment)` que cada `page.tsx` llama en una línea, más el test de E.2 que verifica que las 37 lo hacen.
4. **Sucursal:** cuando exista, segundo selector, solo visible si la empresa tiene más de una `site`.

**Regla de UI que el plan no menciona pero importa:** el selector de empresa debe mostrar la empresa activa **siempre visible**, no oculta tras un click. El error clásico de las apps multiempresa es que el usuario registra una factura en la empresa equivocada porque no había señal persistente de contexto.

---

## I. Multi-tenancy

### I.1 Cómo se resuelve el contexto activo

```
1. cookie httpOnly `kigyo_ctx` = org_id
2. getMember() lee TODAS las membresías del usuario
3. si cookie ∈ membresías        → esa es la empresa activa
   si no                          → default = last_active_at más reciente, o la primera por created_at
4. member.orgId = empresa activa  (mismo campo, mismo significado que hoy)
5. member.companies = [...]       (nuevo: para el selector)
6. member.plan = account.plan     (cambia de origen)
```

**Nunca** se acepta la empresa activa desde un header, un query param o el body. Solo cookie httpOnly validada contra membresías en el servidor.

### I.2 Qué garantiza qué

| Garantía | Dónde se aplica | Estado |
|---|---|---|
| No ver datos de un tenant al que no perteneces | RLS (`app.orgs_with`) | **Ya existe y está probado** |
| No ver datos de una empresa donde no eres miembro | RLS — es el mismo mecanismo | **Ya existe y está probado** |
| No mezclar empresas en la vista activa | Capa de query (`.eq('org_id', member.orgId)`) | **Ya existe en los 787 call sites** |
| El plan es correcto | `accounts.plan` + `guard_plan_change` (a mover) | A migrar |

Esta tabla es el argumento central a favor de la Opción 2: **las tres primeras filas no requieren ningún cambio.**

### I.3 Tests de no-fuga a añadir

`supabase/tests/rls/005_multi_company.sql`:
1. Usuario A miembro de empresa 1 y 2 del mismo account: ve filas de ambas al consultar sin filtro, y **solo** de la activa cuando la capa de app filtra.
2. Usuario B miembro solo de empresa 1: **cero filas** de empresa 2, aunque compartan account.
3. Owner del account **sin** membresía en empresa 2: cero filas de empresa 2. (Decisión M4.)
4. Storage: objeto bajo `{org2}/…` invisible para miembro de org1.
5. `next_code`: los correlativos siguen siendo únicos por empresa, no por account.

---

## J. Roles y permisos

### J.1 Tres alcances

| Alcance | Tabla | Granularidad | Estado |
|---|---|---|---|
| Cuenta | `account_memberships.role` | 3 roles fijos: `owner`, `billing`, `admin` | Nuevo |
| Empresa | `memberships.role` + `roles` + `role_permissions` | Roles custom, matriz `<module>:<action>` | **Ya existe completo** |
| Sucursal | `membership_sites` | Filtro sobre lo que ya concede la empresa | Fase posterior |

**Deliberadamente asimétrico.** El alcance de cuenta tiene tres roles fijos porque solo decide tres cosas (¿quién paga? ¿quién crea empresas? ¿quién invita al grupo?). Darle una matriz de permisos sería complejidad sin demanda.

### J.2 Resolución efectiva

```
permisos_efectivos(usuario, empresa_activa, sucursal_activa)
  = role_permissions[empresa_activa, memberships[usuario, empresa_activa].role]
  ∩ (sucursal_activa == null ? TODO : sucursales_asignadas(usuario, empresa_activa))
```

El alcance de sucursal **restringe**, nunca amplía. Sin sucursales asignadas = acceso a todas (comportamiento por defecto de una empresa que no usa sucursales).

### J.3 Herencia del owner de la cuenta

**Recomendación: sin herencia automática.** Ser `owner` del account **no** concede permisos sobre los datos de una empresa. Concede: ver la lista de empresas, crear empresas, gestionar el plan, y un botón explícito **"Unirme a esta empresa"** que crea una `membership` — auditada, visible para los demás administradores.

Razón: el caso "el contador del grupo ve las historias clínicas de la clínica del grupo" debe requerir un acto deliberado y visible, no ser un efecto lateral de la jerarquía. Si el cliente lo pide al revés, es un toggle por cuenta (`accounts.owner_inherits_companies`), no un cambio de arquitectura. Ver decisión M4.

### J.4 Arreglar la doble fuente de rol (P10)

`employees.access_role` debe dejar de existir como fuente independiente. Dos opciones:
- (a) Eliminarlo y derivar de `memberships` cuando `employees.user_id` no es null.
- (b) Mantenerlo como "rol previsto cuando esta persona reciba cuenta" y sincronizarlo al vincular.

Recomiendo (b), que es lo que el campo realmente quiere ser, con un rename a `intended_role` y un comentario que diga que no es autoridad.

---

## K. Billing

### K.1 Qué se mueve

`plan` sube de `organizations` a `accounts`. `app.guard_plan_change` se reapunta a `accounts`. `getMember()` lee el plan del account de la empresa activa.

**Consecuencia importante:** el plan es del grupo, no de la empresa. Todas las empresas de una cuenta comparten tier. Es la elección correcta comercialmente (se vende una suscripción, no N) y es lo que dice el plan actual en su punto I.1.

### K.2 Límites por plan

```ts
export interface PlanDef {
  key: PlanKey
  label: string
  description: string
  modules: string[]
  /** Miembros totales de la cuenta (no por empresa). null = sin límite. */
  seats: number | null
  /** Empresas simultáneas. Starter = 1. */
  maxCompanies: number | null
  /** Sucursales por empresa. null = sin límite. */
  maxSitesPerCompany: number | null
}
```

Propuesta inicial (a aprobar, decisión M6):

| | Starter | Growth | Enterprise |
|---|---|---|---|
| Empresas | 1 | 3 | ilimitadas |
| Sucursales / empresa | 1 | 5 | ilimitadas |
| Asientos (cuenta) | 10 | 50 | ilimitados |
| Módulos | 8 | 32 | 35 |

**Enforcement de `maxCompanies` en la base de datos**, no solo en la app: a diferencia de los asientos, crear una empresa es un objeto de facturación y merece un trigger. Los asientos pueden quedarse a nivel app (el razonamiento existente en `settings.ts:616` es correcto).

### K.3 Downgrade sin pérdida de configuración

Regla: **el downgrade nunca borra.** Cuando el plan baja:
- Las empresas por encima del límite pasan a `organizations.status = 'suspended'` (columna nueva): visibles, de solo lectura, con un aviso claro. No se borran ni se ocultan.
- Los módulos fuera del plan salen de `member.modules` (ya lo hace `resolveModules`) pero **permanecen en `enabled_modules`**, para que al volver a subir de plan reaparezcan exactamente como estaban. Verificar que `updateModules` no los pise al guardar — hoy guarda la lista completa del formulario, que ya viene filtrada por plan en la UI: **esto es un bug latente que la migración expone.**
- Las sucursales por encima del límite se marcan de solo lectura, no se eliminan.

### K.4 Proveedor de pagos

No existe. Hoy: `npm run db:plan` (`scripts/set-plan.mjs`). Decisión pendiente (M7). Sea cual sea, la superficie de integración ya está bien acotada: una columna, un trigger que bloquea a `authenticated`, y `service_role` como único escritor.

---

## L. Migración por fases

Principio rector: **ninguna fase anterior a la 6 toca una política RLS ni un call site de query.**

### Fase 0 — Decisiones (bloqueante)
Cerrar las decisiones de la sección M. Sin código.

### Fase 1 — `accounts`, aditiva y silenciosa
- `accounts`, `account_memberships`, RLS de ambas.
- `organizations.account_id` (nullable primero).
- Backfill 1:1: un account por organization, plan copiado, owner = admin más antiguo, `onboarding_completed_at = now()`.
- `account_id` pasa a `not null`.
- `getMember()` lee el plan del account con fallback a `organizations.plan` (dual-read).
- **Sin cambios de UI. Sin cambios de RLS de datos. Sin cambios de queries.**
- *Verificación:* toda la suite pasa sin modificar un test. Si algo cambia de comportamiento, la fase está mal hecha.

### Fase 2 — Contexto activo
- Quitar `.limit(1)` de `getMember()`; leer todas las membresías.
- Cookie `kigyo_ctx` + validación server-side + `memberships.last_active_at`.
- `member.companies` en el contexto de cliente.
- Selector de empresa en el Sidebar, **oculto cuando hay una sola empresa**.
- *Verificación:* un usuario con una empresa no percibe ninguna diferencia. Un usuario con dos (creado a mano en staging) puede alternar y los datos cambian por completo.

### Fase 3 — Crear empresas
- `app.provision_company(account_id, …)` extraída de `handle_new_user`.
- Mutation `createCompany` con chequeo de `maxCompanies` + trigger en DB.
- Pantalla `/dashboard/empresas`.
- *Verificación:* test RLS 005 (sección I.3) completo y en verde.

### Fase 4 — Registro único de módulos, sectores en DB, dependencias
- `registry.ts` + generación de `NAV`/`PERMISSIONS`/`ROUTE_MAP` + script de seed SQL.
- `sectors` / `sector_modules` / `module_dependencies` + reemplazo del CHECK de `company_type` por FK.
- Subsectores y el sector Fitness & Bienestar.
- Arreglo de P14 (modo manual) y del test faltante de `valid_module_keys`.
- Guard de ruta central + test que verifica las 37 páginas.
- *Verificación:* pura refactorización; ninguna capacidad nueva visible salvo subsectores y dependencias.

### Fase 5 — Onboarding
- Wizard `/onboarding`, `handle_new_user` simplificado, layout guard.
- Branding y datos fiscales por empresa.
- *Verificación:* e2e de signup → wizard → dashboard, y de "crear segunda empresa".

### Fase 6 — Sucursales
- `sites`, `site_id` en las tablas donde la sucursal es un hecho del negocio, `membership_sites`.
- **Primera fase que toca RLS.** Se hace tabla por tabla, con test por tabla, no en bloque.
- Migración de `employees.location` (texto libre) a `sites` — semiautomática, con revisión manual del mapeo.

### Fase 7 — Billing real
- Proveedor de pagos, webhooks, `guard_plan_change` sobre `accounts`, eliminación de `organizations.plan`.
- Flujo de downgrade con suspensión en vez de borrado (K.3).

### Fase 8 — Hardening
- e2e de cambio de empresa cubriendo cada módulo.
- Test estructural: todo query de `src/server/queries/` filtra por `org_id`.
- Helper `scoped(supabase, member, table)` que aplique el filtro de contexto por construcción y elimine la posibilidad de olvidarlo.
- Auditoría final de autorización.

### Diferencias frente al plan original

| Punto del plan actual | Recomendación |
|---|---|
| Fase 1: crear `companies` bajo `organizations` | **Invertir:** crear `accounts` encima. Cero tablas operativas tocadas. |
| Fase 5: `company_id` en tablas operativas + RLS endurecido | **Eliminar la fase.** El aislamiento entre empresas ya es el aislamiento entre organizations. |
| C: `sector_templates` en DB | Sí para el catálogo y los presets; **el registro de módulos se queda en TS**. |
| No menciona | P1 (`.limit(1)`) — es el bloqueante real y es de una línea. |
| No menciona | P6 (vocabulario en 5 sitios) y el test faltante de `valid_module_keys`. |
| No menciona | P14 (modo manual arranca con 35 módulos). |
| No menciona | P10 (`employees.access_role` duplica `memberships.role`). |
| No menciona | Bug latente de downgrade en `updateModules` (K.3). |
| Riesgo 6.2 "fugas si `company_id` no llega a RLS" | Correctamente identificado. La Opción 2 lo elimina de raíz en vez de mitigarlo. |

---

## M. Decisiones que necesitas aprobar

**M1 — Dirección de la jerarquía.** ⭐
`accounts` por encima de `organizations` (Opción 2), o `companies` por debajo (Opción 1, el plan actual).
→ **Recomiendo Opción 2.** Cero tablas operativas tocadas, cero políticas RLS reescritas, cero riesgo de fuga nuevo. Coste: `org_id` pasa a significar `company_id`, deuda de nombres reversible.

**M2 — Alcance inicial.**
¿`account + company` primero y `site` después, o los tres a la vez?
→ **Recomiendo account + company primero.** Sucursales en fase 6, con `sites` declarada desde la fase 1 para fijar la forma. La mayoría de clientes no necesita sucursales al lanzar.

**M3 — Estrategia de migración.**
Dual-read temporal (fase 1: plan leído del account con fallback a organization) vs cutover.
→ **Recomiendo dual-read** para `plan`, con eliminación de la columna vieja en fase 7. Es la única parte donde el dual-read hace falta.

**M4 — Herencia de permisos del owner de la cuenta.**
¿El owner del account ve automáticamente los datos de todas las empresas, o necesita una membresía explícita?
→ **Recomiendo membresía explícita**, con botón "Unirme" auditado. Si el mercado lo exige al revés, se convierte en un toggle por cuenta, no en un cambio de arquitectura.

**M5 — Alcance del plan.**
¿El plan es del account (todas las empresas comparten tier) o por empresa?
→ **Recomiendo por account.** Se vende una suscripción. Coincide con el punto I.1 del plan original.

**M6 — Límites iniciales.**
Tabla propuesta en K.2 (Starter 1 empresa / 1 sucursal / 10 asientos; Growth 3 / 5 / 50; Enterprise ilimitado). ¿Se aprueba? ¿Starter debe permitir 1 o 2 empresas?

**M7 — Proveedor de pagos.**
No existe integración. Hay que elegir uno antes de la fase 7 (o decidir que el plan se sigue cambiando manualmente por soporte durante más tiempo).

**M8 — Catálogo de subsectores.**
El propuesto en F.2 cubre 12 sectores. ¿Se aprueba tal cual, se recorta a los 4-5 prioritarios, o hay que ajustar la lista por mercado?

**M9 — Sector Fitness & Bienestar.**
El plan lo pide y no existe. ¿Se añade como sector propio con módulo vertical nuevo (`membresias`/`clases`), o como subsector de "servicios" reutilizando módulos existentes?
→ **Recomiendo empezar como sector con preset de módulos existentes**, sin módulo vertical nuevo hasta que haya demanda.

**M10 — Desactivación de módulos con dependientes.**
¿Bloquear ("desactiva Ecommerce primero") o cascada con confirmación?
→ **Recomiendo bloquear.** La cascada confirmada es la que produce el "yo no apagué eso".

**M11 — Renombrado cosmético `org_id` → `company_id`.**
¿Se hace nunca, se hace en una fase 9 puramente mecánica, o se deja documentado permanentemente?
→ **Recomiendo dejarlo documentado** en `AGENTS.md` y `comment on column`, y reevaluar tras la fase 8.

---

## Anexo — Referencias de archivo

| Tema | Ruta |
|---|---|
| Primitivo de RLS | `supabase/migrations/20260806090000_01_core.sql:227` (`app.orgs_with`) |
| Generador de políticas | `supabase/migrations/20260806090000_01_core.sql:265` / `:304` |
| Resolución de sesión | `src/lib/auth/session.ts:43` (el `.limit(1)` en `:86`) |
| Las tres puertas | `src/lib/auth/session.ts:203` (`requirePermission`) |
| Espejo cliente | `src/lib/context/MemberContext.tsx:61` |
| Espejo API | `src/lib/api/handler.ts:52` |
| Catálogo de módulos | `src/lib/modules.ts:63` |
| Presets de sector | `src/lib/modules.ts:168` |
| Resolución de módulos | `src/lib/modules.ts:341` (`resolveModules`) / `:324` (`presetFor`, bug P14) |
| Planes | `src/lib/plans.ts:98` |
| Permisos | `src/lib/auth/permissions.ts:16` |
| Navegación | `src/lib/data/nav.ts` |
| Roles por tenant | `supabase/migrations/20260810220000_24_custom_roles.sql` |
| Módulos y sector en org | `supabase/migrations/20260808100000_11_org_modules.sql`, `…_14_plans_and_sectors.sql` |
| Guard del plan | `supabase/migrations/20260810120000_14_plans_and_sectors.sql` (`app.guard_plan_change`) |
| Mutaciones de configuración | `src/server/mutations/settings.ts` |
| Onboarding actual | `src/app/(auth)/register/page.tsx` |
| Storage por tenant | `supabase/migrations/20260806090600_07_storage.sql` |
| Tests RLS | `supabase/tests/rls/00{1,2,3,4}_*.sql` |
| Drift guards existentes | `src/lib/auth/permissions.test.ts`, `src/lib/modules.test.ts:93` |
