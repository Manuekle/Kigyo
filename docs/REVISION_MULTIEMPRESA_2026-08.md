# Revisión — ¿la app ya hace lo que propones?

**Alcance:** verificación de la propuesta multiempresa/multisector contra el código real en `feat/design-system-refresh`.
**Estado:** análisis entregado y **fases 9 a 13 implementadas**, salvo el selector de sucursal (ver el registro al final).
**Fecha:** 2026-08-11
**Verificado con:** `npm run typecheck` limpio, `npm test` 238/238, 12 suites RLS (197 asertos), `npm run build` limpio.

Documentos previos: `AUDITORIA_ARQUITECTURA_KIGYO.md` (auditoría), `FASE_0_CONTRATOS.md` (decisiones cerradas), `PLAN_NUEVA_ARQUITECTURA_KIGYO.md` (plan original, ya superado).

---

## Resumen ejecutivo

**Sí, la app ya lo hace — con una diferencia de forma y cinco huecos reales.**

La propuesta que escribiste ya fue auditada, decidida y construida entre las migraciones 26 y 33. Existe hoy, en el repositorio, funcionando:

| Lo que pides | Estado |
|---|---|
| Un usuario administra varias empresas desde una cuenta | ✅ `accounts` → N `organizations`, selector en el sidebar |
| Cada empresa con su propio sector y sus propios módulos | ✅ `organizations.company_type` + `enabled_modules` por empresa |
| Cambiar de empresa cambia dashboard, sidebar, permisos y datos | ✅ cookie `kigyo_ctx` validada en servidor + `revalidatePath` |
| Sectores como plantilla, nunca como jaula | ✅ el sector solo propone; ningún guard lo consulta |
| Subsectores | ✅ 40+ subsectores en `public.sectors` (⚠️ ver hueco H3) |
| "Configurar manualmente" sin sector | ✅ `MANUAL_START`, 5 módulos |
| Dependencias entre módulos (POS→catálogo→inventario) | ✅ 22 dependencias `hard`/`soft`, validadas en DB y UI |
| Sucursales | ✅ `sites` + `membership_sites` + `site_id` en 7 tablas |
| Roles y permisos por empresa | ✅ roles custom por empresa, matriz `<módulo>:<acción>` |
| Aislamiento entre empresas | ✅ RLS generada por función, con suite de tests |
| Planes con límite de empresas/sucursales/usuarios | ✅ `maxCompanies` con trigger en DB, no solo en la app |
| Sector Fitness & Bienestar | ✅ migración 33 |
| Onboarding por pasos | ⚠️ parcial — 4 de los 8 pasos diseñados |

**La diferencia de forma, y es la decisión que importa:** tu propuesta pone la unidad de negocio *dentro* de la empresa (`Empresa legal → Unidad: Hotel → Sector: Hotelería`). La arquitectura construida pone el sector en la **empresa**, y la sucursal (`site`) debajo sin sector propio. En la práctica «Hotel ABC», «Restaurante XYZ» y «Consultorio XYZ» son **tres `organizations` bajo una `account`**, no tres unidades de una. Funcionalmente da el mismo resultado que dibujaste; lo único que se pierde es la agrupación jurídica explícita. Detalle y coste en §C.

---

## A. Estado actual (medido, no recordado)

- **120 tablas**, 871 usos de `org_id` en TS, 40 rutas de dashboard, 33 migraciones.
- **Jerarquía real:**

```
Account  public.accounts          plan, billing, límites, onboarding_completed_at
  ├── AccountMembership           owner | billing | admin  ← NO da acceso a datos
  └── Organization  ≡  EMPRESA    sector, subsector, módulos, branding, fiscales, status
        ├── Membership            rol del usuario EN esa empresa
        ├── Role / RolePermission roles custom por empresa
        ├── Site (sucursal)       + membership_sites (restringe, nunca concede)
        └── ~66 tablas operativas con org_id
```

- **Contexto activo:** cookie httpOnly `kigyo_ctx`, validada contra las membresías leídas del servidor en cada request (`src/lib/auth/active-company.ts`). Nunca se acepta de header, query ni body.
- **Tres puertas de autorización**, evaluadas de fuera hacia dentro con un error distinto cada una (`src/lib/auth/session.ts:380`): suspensión → plan → módulo → permiso.
- **RLS generada por función**, no escrita a mano por tabla: `app.orgs_with(permission)`, `app.apply_standard_rls`, `app.apply_child_rls`. Es el activo más valioso del repo y está congelado por contrato.
- **Registro único de módulos** (`src/lib/modules/registry.ts`): de ahí se derivan `MODULES`, `PERMISSIONS`, `NAV`, `ROUTE_MAP`, `ROUTE_PERMISSIONS` y las etiquetas. Antes eran cinco listas paralelas.
- **Sectores como datos** (`public.sectors`, 23 sectores + subsectores). Añadir un sector es un `INSERT`, no una migración de esquema.
- **Tests:** 207 unitarios en verde, 9 suites RLS (`supabase/tests/rls/001..009`), 1 e2e de cambio de empresa. Incluye un test estructural que verifica que **toda** query de `src/server/queries/` está acotada a la empresa activa.

---

## B. Problemas y huecos reales

Ordenados por lo que cuesta si no se arreglan.

**H1 — Un usuario no puede tener dos cuentas (dos «Grupo XYZ»).**
`account_memberships` lo permite en el esquema, pero las cuentas solo las crea el trigger de signup: no hay UI para crear una segunda, ni selector de cuenta, ni `member.accounts`. Hoy, dos grupos = dos registros con dos correos. Tu diagrama «Manuel → Organización A / Organización B» **no funciona todavía**.

**H2 — Onboarding: faltan 4 de 8 pasos.**
Implementado: Empresa (datos fiscales) → Sector → Subsector → Módulos. Faltan: nombre de la **cuenta/grupo** (hoy se llama igual que la primera empresa), **sucursales**, **invitar equipo**, y el paso de **pago**. Además el wizard solo lo ve el `owner` y solo mientras `onboarding_completed_at` sea null.

**H3 — El subsector se guarda pero no propone nada.**
`chosenSub` se almacena en `organizations.subsector` y no toca la selección de módulos (`src/app/onboarding/client.tsx:96`). El preset lo da solo el sector padre. Una panadería y un bar reciben lo mismo, que es exactamente lo que los subsectores existían para evitar. El diseño (`AUDITORIA §F.2`) pedía `preset(sector) ∪ sub.add − sub.remove`; falta la aritmética y faltan los datos.

**H4 — Los presets viven en TypeScript, los sectores en la base de datos.**
Un sector nuevo se inserta sin deploy, pero **llega sin preset** (`presetFor` devuelve el catálogo completo para una clave desconocida, y la UI cae en «configurar manualmente»). La mitad barata de la promesa está hecha; la otra mitad exige deploy igual. Falta `public.sector_modules` o equivalente.

**H5 — Sin proveedor de pagos (decisión M7, sigue abierta).**
El plan se cambia con `npm run db:plan`. La suspensión (`organizations.status`) está construida y el guard impide que un cliente se cambie el plan, pero no hay webhook, ni checkout, ni downgrade automático. Es lo único que separa la arquitectura de ser vendible.

**H6 — Deudas menores, ya calendarizadas y sin urgencia:**
- `employees.access_role` sigue duplicando `memberships.role` (P10). No es autoridad, pero nada lo dice en el nombre.
- `scripts/gen-module-sql.mjs` se cita en `registry.ts:21` y **no existe**; el pinning DB↔TS lo hace un test por regex, que funciona pero no es lo documentado.
- `seats` de Growth quedó en `null` mientras el contrato §7.2 decía 50. Decisión comercial pendiente, anotada en `plans.ts:139`.
- Sin selector de sucursal en la UI: `membership_sites` restringe por RLS, pero nadie puede «mirar solo la sucursal norte».
- Campos personalizados, workflows y estados propios: no existen (P2, fuera de alcance por diseño).
- «Kigyo aprende de las configuraciones manuales para crear sectores nuevos»: no hay ninguna medición de `enabled_modules` agregada. Idea buena, cero implementación.

---

## C. La única decisión de arquitectura que sigue abierta

### ¿Dónde vive el sector: en la empresa o en una unidad de negocio?

**Hoy:** en la empresa. Tu «Grupo XYZ» con hotel, restaurante y consultorio se modela como:

```
Account "Grupo XYZ"          plan, límites, facturación
  ├── Organization "Hotel ABC"          sector hoteleria    módulos propios
  ├── Organization "Restaurante XYZ"    sector alimentos    módulos propios
  └── Organization "Consultorio XYZ"    sector salud        módulos propios
```

Cada una tiene su NIT, su razón social, su moneda, su branding, sus roles y sus datos. El recepcionista del hotel tiene membresía solo en la primera y **la base de datos** —no el frontend— le devuelve cero filas de las otras dos. Es exactamente el comportamiento que describes en tu sección de roles.

**Lo que tu propuesta añadiría:** una entidad `LegalEntity` («Grupo Erazo SAS») entre la cuenta y las empresas, para que las tres compartan identidad jurídica y facturación consolidada.

**Coste de las tres opciones:**

| Opción | Qué cuesta | Qué gana |
|---|---|---|
| **1. Dejarlo como está** ⭐ | Cero | Las tres unidades ya funcionan aisladas. La identidad jurídica compartida se expresa repitiendo `tax_id` en las tres empresas, que es la verdad: comparten NIT |
| **2. Añadir `legal_entities` bajo la cuenta** | 1 tabla, 1 columna nullable en `organizations`, 0 políticas RLS tocadas, 0 queries tocadas | Agrupación jurídica explícita, reportes consolidados por entidad legal, un paso más en el onboarding |
| **3. Sector y módulos por `site`** ❌ | Reescribir la resolución de módulos, los permisos y las 264 políticas RLS para que el eje de aislamiento sea la sucursal | Nada que la opción 1 no dé ya |

**Recomiendo la opción 1 ahora y la 2 cuando un cliente real pida facturación consolidada.** La opción 3 es la trampa que la auditoría original ya evitó una vez: mueve el eje de aislamiento y es donde se producen las fugas entre empresas del mismo cliente.

---

## D–K. Lo que ya está resuelto (referencia rápida)

**D. Modelo de datos.** `accounts`, `account_memberships`, `organizations` (≡ Company), `memberships`, `roles`, `role_permissions`, `sites`, `membership_sites`, `sectors` (auto-referenciada, dos niveles), `module_dependencies`. `org_id` significa **id de empresa** — contrato en `AGENTS.md`, no negociable.

**E. Módulos.** 35 módulos en `registry.ts`, 5 grupos, 2 core (`dashboard`, `configuracion`) derivados de `group === null`. 22 dependencias: `hard` arrastra al activar y bloquea al desactivar; `soft` se ofrece marcada. Resolución transitiva (`ecommerce → tienda → catalogos`).

**F. Sectores.** 23 sectores + subsectores en DB. El sector no aparece en ningún guard: `requirePermission` no lo consulta y RLS tampoco. Cambiar de sector nunca borra datos.

**G. Onboarding.** Signup crea `account` + `organization` + roles + membresía en una transacción (`app.provision_company`). El wizard mejora, no habilita. «Saltar» en cada paso.

**H. Navegación.** Sidebar derivado de `member.modules`, filtrado por `member.can(...)` que ya pliega plan + módulos + permiso. Selector de empresa arriba del todo, oculto para quien tiene una sola.

**I. Multi-tenancy.** RLS es el **techo** (qué puedes ver jamás); la empresa activa es el **filtro dentro del techo** (qué ves ahora). Nunca se colapsan: una política que consulta una cookie es una política evadible.

**J. Roles.** Tres alcances: cuenta (3 roles fijos, **cero acceso a datos**), empresa (matriz completa, roles custom), sucursal (restringe, nunca concede). El owner de la cuenta necesita pulsar «Unirme» —acto auditado— para ver los datos de una empresa.

**K. Billing.** Plan por cuenta, escrito solo por `service_role`. Starter 1 empresa / Growth 3 / Enterprise ∞, con trigger en DB. Downgrade suspende, jamás borra.

---

## L. Plan propuesto — cinco fases pequeñas

Ninguna toca una política RLS de datos ni un archivo de `src/server/queries/`.

| Fase | Qué | Tamaño | Riesgo |
|---|---|---|---|
| ~~**9**~~ ✅ | **Presets de subsector** (H3 + H4): tabla `sector_modules` con `add`/`remove` por subsector, seed desde TS, test que pina ambos lados, aritmética en `presetFor(sector, sub)` | 1 migración + 2 archivos TS | Bajo |
| ~~**10**~~ ✅ | **Onboarding completo** (H2): paso de nombre de cuenta, paso de sucursales, paso de invitar equipo | 1 migración menor + wizard | Bajo |
| ~~**11**~~ ✅ | **Multi-cuenta** (H1): `member.accounts`, crear cuenta desde la UI, selector de cuenta sobre el de empresa | 2 mutaciones + 1 componente + tests RLS | Medio — es el primer cambio a `getMember()` desde la fase 2 |
| ~~**12**~~ ◐ | **Pagos reales** (H5): proveedor, webhook, checkout, downgrade automático con suspensión | Integración externa | Medio |
| ~~**13**~~ ◐ | **Pulido** (H6): `intended_role`, `gen-module-sql.mjs` o quitar la cita, selector de sucursal, decidir `seats` de Growth | Mecánico | Nulo |

Fases 9 y 10 son independientes entre sí y de las demás: se pueden hacer en cualquier orden o en paralelo.

---

## Decisiones que necesito aprobar

**D1 — Unidad de negocio.** ¿Se queda el sector en la empresa (opción 1, cero coste, ya funciona), o añadimos `legal_entities` para agrupar empresas bajo una razón social (opción 2)?
→ **Recomiendo opción 1 ahora**, opción 2 cuando un cliente pida facturación consolidada.

**D2 — Multi-cuenta.** ¿Un usuario debe poder crear y alternar entre varios grupos («Grupo XYZ» y «Mi Startup»), o basta con varias empresas dentro de un grupo?
→ Es la fase 11 y no es trivial: toca `getMember()`. **Recomiendo aplazarla** hasta que exista la demanda; hoy dos grupos = dos registros.

**D3 — Presets de subsector.** ¿Se hace la fase 9 completa (subsector amenda el preset del padre), o el subsector se queda solo como dato descriptivo para segmentar clientes?
→ **Recomiendo hacerla**: sin ella los subsectores le cuestan una decisión al cliente y no le devuelven nada.

**D4 — Orden de las fases.** ¿Primero producto (9 + 10: subsectores y onboarding) o primero negocio (12: pagos)?
→ **Recomiendo 9 y 10 primero.** Son baratas, visibles y no dependen de elegir proveedor.

**D5 — Proveedor de pagos (M7, abierta desde la Fase 0).** Sigue sin decidirse y bloquea la fase 12.

**D6 — `seats` de Growth.** El contrato decía 50, el código dice ilimitado. ¿Cuál es la oferta comercial?

**D7 — Sectores aprendidos.** ¿Se instrumenta la medición de configuraciones manuales para proponer sectores nuevos, o se deja fuera de alcance?
→ **Recomiendo dejarlo fuera** hasta tener volumen: con 20 cuentas no hay patrón que descubrir.

---

## Registro de implementación — 2026-08-11

Aprobado «hazlo» sobre la recomendación de D4: **fases 9 y 10 primero.** D1 queda en la opción 1 (nada que construir), D2 aplazada, D3 hecha. D5, D6 y D7 siguen abiertas y no bloquean nada de lo entregado.

### Fase 9 — Presets de sector y subsector

| Archivo | Qué |
|---|---|
| `supabase/migrations/…_34_sector_presets.sql` | Tabla `public.sector_modules` (sector → módulo, `add`/`remove`), RLS de solo lectura, CHECK contra `app.valid_module_keys`, trigger que rechaza `remove` en un sector raíz, y el seed completo: 23 sectores + 55 deltas de subsector |
| `src/lib/modules.ts` | `SUBSECTOR_PRESETS` (los 55 deltas), `applySectorDelta`, y `presetFor(sector, subsector)` |
| `src/lib/sectors.ts` (nuevo) | `presetFromCatalogue()`: resuelve DB → TS → `MANUAL_START`. Puro, sin `server-only`, para que el wizard y Configuración corran la misma aritmética que el servidor |
| `src/server/queries/sectors.ts` | Devuelve los presets junto con el catálogo |
| `src/server/queries/settings.ts` | Envía el catálogo entero en vez de la rama del sector cargado |
| `src/app/onboarding/client.tsx`, `…/configuracion/client.tsx` | Elegir subsector **re-propone** módulos; el selector de sector ya lista también los sectores que solo existen en la base de datos |
| `src/lib/sectors.test.ts` (nuevo) | 17 pruebas: DB↔TS en ambos sentidos, cierre bajo dependencias duras, que ningún `remove` rompa una dependencia, y que ningún subsector proponga exactamente lo mismo que su padre |
| `supabase/tests/rls/010_sector_presets.sql` (nuevo) | 12 asertos: lectura para cualquier miembro, escritura para nadie, `anon` sin acceso, y las dos reglas del trigger |

**Bug de producto cerrado de paso:** `presetFor()` respondía con **los 35 módulos** ante un sector desconocido. Un sector insertado como dato — que es justo lo que las migraciones 29 y 34 hacen posible — encendía todo el catálogo para quien lo eligiera. `presetFromCatalogue` cae a `MANUAL_START`.

### Fase 10 — Onboarding completo

Cuatro pasos pasaron a siete: **Cuenta → Empresa → Sector → Tipo → Módulos → Sucursales → Equipo.**

- `updateAccountName` en `src/server/mutations/onboarding.ts`, restringida al `owner` de la cuenta — `configuracion:manage` es permiso de *empresa* y no debe permitir renombrar el grupo que posee a las demás. La base de datos dice lo mismo por su cuenta (`accounts_update` sobre `app.is_account_owner`, y solo la columna `name` concedida).
- Sucursales e invitaciones reutilizan `createSite` e `inviteMember`, con sus límites de plan ya existentes.
- Los pasos dejaron de indexarse por número: el paso «Tipo» solo existe cuando el sector tiene subsectores, y con índices cada comparación era un off-by-one esperando su turno.

### Bug preexistente encontrado y corregido

`supabase/migrations/…_35_drop_stale_plan_guard.sql`.

La migración 32 eliminó `organizations.plan` y **dejó vivo** el trigger `organizations_guard_plan`, cuya función evalúa `new.plan`. plpgsql compila la expresión en la primera ejecución, así que la migración pasó limpia y falló después: **todo UPDATE sobre `public.organizations` moría** con `record "new" has no field "plan"` — renombrar la empresa, guardar módulos, elegir sector, datos fiscales, branding. Apareció en `supabase/tests/rls/005_account_isolation.sql`, que lleva fallando desde la 32.

No se reapunta el trigger: la regla que protegía ya vive donde vive el plan (`app.guard_account_plan_change` sobre `accounts`, más los grants por columna).

### Lo que estas dos fases NO hacen

- No tocan ninguna política RLS de una tabla de datos, ni `app.orgs_with`, ni `apply_standard_rls` / `apply_child_rls`.
- No tocan `src/server/queries/` ni `src/server/mutations/` salvo `sectors.ts`, `settings.ts` (una consulta) y `onboarding.ts`.
- No implementan multi-cuenta (fase 11), pagos (12) ni el pulido de H6 (13).
- No hay verificación en navegador del asistente: exige una cuenta con onboarding pendiente contra la base real. Sí está verificado que las rutas compilan y redirigen (`/onboarding` → `/login` sin sesión) y que `npm run build` pasa.

---

## Registro de implementación — fases 11 a 13 y los bugs preexistentes

Decisiones tomadas en este tramo: **D5 = solo el andamiaje** (sin proveedor de pagos elegido) y **D6 = Growth con asientos ilimitados**.

### Bugs preexistentes corregidos

**El guardián de un plan que ya no existe.** Migración 35, descrito arriba: bloqueaba **todo UPDATE sobre `public.organizations`** desde la migración 32.

**P10 — el rol duplicado del empleado.** Migración 36 renombra `employees.access_role` a `intended_role`, renombra su FK, y ambos comentarios de columna declaran cuál es la autoridad real (`memberships.role`, que es lo que lee `app.orgs_with` y por tanto toda política RLS). El comentario en `NuevoEmpleadoModal.tsx` afirmaba lo contrario — «`access_role` is what the person may open in Kigyo» — y esa clase de falsedad termina con alguien creyendo que degradar una ficha de RR. HH. revoca una sesión. La etiqueta de la UI pasó de «Rol / Permisos» a «Rol previsto».

**El generador citado que no existía.** `registry.ts` remitía a `scripts/gen-module-sql.mjs` desde hacía tres migraciones. Ahora existe (`npm run db:module-sql`): emite `app.valid_module_keys()` y las filas de `public.permissions` desde el registro, con `--module <key>` para el caso normal. Importa `registry.ts` directamente — no tiene imports propios, así que el type stripping de Node basta y no hay build de por medio.

**`updateSector` borraba módulos fuera del plan.** `updateModules` ya conservaba los módulos que el plan actual no cubre (contrato K.3); su gemelo del asistente no. Ahora también.

### Fase 11 — Multi-cuenta

| Archivo | Qué |
|---|---|
| `…_37_multi_account.sql` | `public.create_account(nombre, empresa, sector)`: grupo + `account_membership(owner)` + primera empresa por `app.provision_company`, plan fijo en `starter`, tope de 10 grupos por persona |
| idem | `public.create_company` gana `p_account_id`, validado con `app.can_manage_account`. Antes elegía **la cuenta más antigua** del llamante: con dos grupos, crear una empresa desde «Mi Startup» la habría puesto en «Grupo XYZ», gastando el plan equivocado |
| `src/lib/auth/session.ts` | `member.accounts` (grupos que gobierna) y `accountId`/`accountName` en cada `CompanyRef` |
| `CompanySwitcher.tsx` | Empresas agrupadas por cuenta, con encabezado solo cuando hay más de un grupo |
| `dashboard/empresas` | Una sección por cuenta, «Nueva empresa» por grupo, «Nueva cuenta» arriba |
| `supabase/tests/rls/011_multi_account.sql` | 13 asertos: el grupo nuevo nace en starter, su empresa queda completa, el tope corta en diez, y **no se puede crear una empresa dentro del grupo de otra persona** |

El tope de diez grupos no es comercial: una cuenta nueva nace en Starter, que es gratis, igual que registrarse otra vez con otro correo — algo que nadie impide ni debería. Es contra un script, no contra un cliente.

### Fase 12 — Andamiaje de facturación (sin proveedor)

| Archivo | Qué |
|---|---|
| `…_38_billing_seam.sql` | `public.billing_events` (un evento, una vez: la unicidad `(provider, event_id)` *es* la idempotencia) y `public.apply_subscription(cuenta, plan, estado)` — la única vía para cambiar un plan, y reconcilia la suspensión en la misma transacción |
| `src/lib/billing/provider.ts` | La interfaz `BillingProvider` (`verify` + `parse`) y el adaptador `manual`: HMAC-SHA256 real sobre el cuerpo crudo, comparación en tiempo constante |
| `src/app/api/billing/webhook/route.ts` | Verifica → registra → aplica, en ese orden. Sin secreto responde 503 |
| `scripts/set-plan.mjs` | Deja de llevar su copia de la lógica de suspensión y llama a `apply_subscription` |
| `src/lib/billing/provider.test.ts` + `supabase/tests/rls/012_billing.sql` | 14 + 14 asertos |

Reglas que los tests fijan: un downgrade **no borra nada** y deja activas las empresas más antiguas hasta el límite; una suscripción impaga suspende todas **sin tocar el plan comprado**; volver a pagar las devuelve; aplicar el mismo evento dos veces no mueve nada; y **el dueño de la cuenta no puede llamar `apply_subscription`** — si pudiera, el plan sería gratis.

Elegir proveedor es escribir `verify` y `parse` contra su documentación. Ni la ruta, ni el registro, ni la reconciliación cambian.

### Fase 13 — Pulido

Hecho: `intended_role`, el generador, la decisión de asientos de Growth (ilimitados, con el porqué escrito en `plans.ts`), y dos cosas que faltaban y no estaban en la lista:

- **Aviso de empresa suspendida** en el layout del dashboard. Antes, una empresa en solo lectura se descubría al fallar un guardado — un error sobre un permiso que sí se tiene, por un motivo que ninguna pantalla mencionaba.
- **Límites del plan como números** en Configuración → Módulos: «Empresas 2 de 3 · Sucursales 1 de 5 · Personas 4 · sin límite». «Hasta 10 colaboradores» era una regla; esto es una respuesta.

### Lo único que queda pendiente: el selector de sucursal

No lo hice, y es una decisión, no un olvido.

La mitad de *seguridad* ya existe y está probada: quien tiene sucursales asignadas en `membership_sites` solo ve las suyas, y lo impone RLS (`app.may_access_site`, 20 asertos en `009_sites.sql`). Lo que falta es la mitad de *comodidad*: que un administrador sin restricción pueda decir «muéstrame solo la sede norte».

Eso es un segundo eje de contexto, con la misma forma que la empresa activa (cookie, resolución en servidor, `member.activeSiteId`) **más** un filtro en las consultas de las 7 tablas con `site_id`, donde la semántica correcta no es `site_id = X` sino `site_id = X or site_id is null` — las filas sin sucursal son de toda la empresa y deben seguir apareciendo. Son ~6 archivos de `src/server/queries/`, cada uno con su verificación por pantalla, y solo 4 consultas del proyecto pasan hoy por el helper `scoped()`, así que no hay un punto único donde aplicarlo.

Es trabajo acotado, pero mezclarlo con todo lo anterior sin verificar pantalla por pantalla es donde el riesgo supera al valor. Queda como fase 14, y no bloquea nada.
