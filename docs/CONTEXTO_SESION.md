# Contexto de sesión — para retomar

Fecha: 2026-08-14. Rama: `feat/design-system-refresh` (local, sin push).
Working tree limpio. Suite verde: vitest 248/248 · tsc 0 errores · e2e 1/1 · db-verify 56 migraciones limpias.

---

## 1. Qué está hecho (todo verificado y commiteado)

### Infraestructura
- Multiempresa: cuenta (`accounts`) → empresa (`organizations`, `org_id` = empresa) → `sites`.
  RLS con `app.orgs_with` / `app.apply_standard_rls` / `app.apply_child_rls` (congelados).
- Catálogo sectorial completo: **23 sectores, 51 subsectores, 62 presets**, presets en
  `public.sector_modules` (delta add/remove) espejo de `COMPANY_TYPES` + `SUBSECTOR_PRESETS`
  en `src/lib/modules.ts`. Pins de test en ambas direcciones.
- **Roles sugeridos por subsector**: `public.sector_roles` (migración 46), 61 de 62 presets
  con matriz (`otro` sin opinión por diseño). Espejo TS `src/lib/suggested-roles.ts` + test
  bidireccional. Seed automático al crear empresa (`app.seed_default_roles`) + botón en
  Configuración → Roles («Añadir roles sugeridos»).
- Planes: 3 tiers (starter/growth/enterprise) en `src/lib/plans.ts`; gate exterior
  plan → enabled_modules → role_permissions.

### Módulos nuevos esta jornada (migraciones 47-56, cada uno con pantalla completa)
| Migración | Módulo | Presets | Commit |
|---|---|---|---|
| 47 | `tiempos` | servicios, tecnologia, medios | be85cb2 |
| 48 | `suscripciones` | fitness, educacion, tecnologia, inmobiliario | a7b6f95 |
| 49 | `cartera` | financiero, salud, educacion, servicios | 7e98380 |
| 50 | `notificaciones` | salud, educacion, fitness, inmobiliario, hoteleria | 7d3918e |
| 51 | `reportes` | los 23 sectores (vía SPINE) | 8e35cff |
| 52 | `creditos` | financiero | 992cd42 |
| 53 | `donantes` | ong | 618a8c6 |
| 54 | `suscriptores` | telecomunicaciones (vertical) | 17466fe |
| 55 | `puestos` | seguridad (vertical) | 5e8da25 |
| 56 | `calidad` | manufactura, alimentos, agro | 74e1ca8 |

### UI
- Sidebar: sin buscador, sin Configuración (quedó solo en menú de usuario).
  Vertical arriba con nombre del negocio, orden de grupos por sector, colapso persistido.
- Fixes better-ui: radios concéntricos (items 10px en menús 16px/6px), sin will-change
  permanente, scale 0.96 en triggers.

### Docs
- `docs/SECTORES_SUBSECTORES_MODULOS.md` — catálogo vivo: 62 presets con módulos y roles,
  huecos por capa, orden de trabajo. **Necesita pase con los módulos 47-56** (aún dice
  «falta» para varios ya hechos).
- `docs/PLAN_CRM_ERP_POS.md` — plan de brechas CRM/ERP/POS (leads, pipeline, contabilidad,
  POS físico). **Guardado para después por decisión del usuario.**
- `docs/CATALOGO_SECTORES_Y_MODULOS.md`, `docs/PLAN_PROFUNDIDAD_SECTORIAL.md` — actualizados
  parcialmente; quedan menciones stale en tablas 2.3 y revisiones por sector.

---

## 2. Pendiente (orden sugerido)

1. **Verticales (3):** `obra` (construccion/energia/mineria — budgets, APU, avance por
   capítulo; el más grande), `ph` (inmobiliario — asambleas, cuotas, zonas comunes),
   `contratacion` (gobierno — procesos, pliegos, oferentes).
2. **Transversales (3):** `portal` (enlace público firmado — requiere análisis de abuso),
   `marketing` (campañas, fidelización), `integraciones` (pasarela, WhatsApp; secretos en
   vault, no en tabla).
3. **Profundidad (6):** veterinaria (mascota/propietario, vacunas, hospitalización —
   patrón odontología de migración 45), radiografías (storage), notas estudiantes,
   tarifas hoteleria por temporada, agro sanidad/riego, BOM en produccion.
4. **Roles sugeridos:** matrices existentes no incluyen los 10 módulos nuevos —
   pase para añadir `tiempos:*` a roles de servicios/tecnologia/medios, `cartera:*` a
   financiero/salud/educacion/servicios, etc. (patrón UPDATE en migración nueva o
   re-siembra; recordar el pin TS↔SQL en suggested-roles.test.ts).
5. **Docs:** pase completo del catálogo vivo + catálogo sectorial.
6. `test-results/` ya está en .gitignore.

---

## 3. Receta probada: añadir un módulo (14 pasos)

1. **Registry**: entrada en `src/lib/modules/registry.ts` (key, label, description, group,
   icon, route, actions ['read','write'], permissionNoun, title, subtitle). Si es vertical,
   declararlo también en `COMPANY_TYPES` (`vertical: 'key'` en el sector) y `SECTOR_NAV`
   (navLabel). Icono nuevo → añadir a `ICON_MAP` en `Sidebar.tsx`.
2. **Generar SQL de permisos**: `node --experimental-strip-types scripts/gen-module-sql.mjs --module <key>`
   → copiar bloque `valid_module_keys` + `permissions` en la migración.
3. **Migración** `supabase/migrations/<timestamp>_NN_<key>.sql`: tablas con `org_id`,
   `select app.apply_standard_rls('tabla', '<key>:read', '<key>:write')`, bloque generado,
   `module_dependencies`, backfill `role_permissions` a `configuracion:manage`,
   `sector_modules` (formato `select '<sector>', k, 'add' from unnest(array[...]) as k` —
   OBLIGATORIO este formato: el regex de sectors.test.ts no capta otras formas).
4. **Presets TS**: `src/lib/modules.ts` (o SPINE si va a todos).
5. **Deps registry**: `MODULE_DEPENDENCIES` en registry.ts.
6. **Plan**: `src/lib/plans.ts` (growth = operativo; enterprise = tienda/ecommerce/trazabilidad).
7. **Server**: `src/server/queries/<key>.ts` (scoped + embeds) y `src/server/mutations/<key>.ts`
   ('use server', zod, FK-validate contra org, revalidatePath, result type).
8. **UI**: `src/app/(dashboard)/dashboard/<key>/page.tsx` (RequirePermission + Loader split)
   y `client.tsx` (cards, Badge, toasts, state desde result.data).
9. **Tipos**: aplicar migración remota (`npm run db:push`) y regenerar
   `DB_URL=$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-); node scripts/gen-db-types.mjs "$DB_URL"`
   (el script exige la URL como argumento).
10. **Verificar**: `./scripts/db-verify.sh` → `npx vitest run` → `npx tsc --noEmit` →
    `npm run test:e2e`.
11. **Probar en vivo**: habilitar módulo en demo, Playwright script: crear fila, verificar,
    limpiar fila (los inputs de forms usan `.field` sin type; botones con nombres exactos;
    nselect usa `.nselect-trigger` + `.nselect-item`).
12. **Commit**: `feat(<key>): <resumen>` + cuerpo con migración/presets/pantalla.

---

## 4. Gotchas aprendidos (caros de redescubrir)

- **`trazabilidad:write` NO existe** — trazabilidad es solo lectura (la escriben triggers).
  Roles sugeridos usan solo `trazabilidad:read`.
- **e2e deja la empresa activa cambiada** — después de correrlo, la demo queda en
  «IPS Bogota». Para probes: `update public.memberships set last_active_at = now() where
  org_id = (select id from public.organizations where name = 'Kigyo Demo Dos');`
- **`enabled_modules` explícito pisa el preset** — la demo tiene lista explícita
  (`array_append` de cada módulo nuevo, no tocar el resto). Si está vacía/array, no cae
  al preset del subsector en `resolveModules` (usa `presetFor(type)` sin subsector).
- **PostgREST «function not found without parameters»** = le pasaste undefined o el grant
  falta — casi siempre es el primero (chequear el payload, no la función).
- **`hasNot` de Playwright no excluye el elemento mismo** (solo descendientes) — usar
  `:not([aria-checked="true"])` directo.
- **`account_companies` devuelve `org_id`, no `id`**.
- **Firma de `gen-db-types.mjs`**: `node scripts/gen-db-types.mjs <postgres-url>`.
- **db-verify** crea DB desechable `kigyo_verify_$$` y la dropea; `--keep` la deja.
- **Migraciones ya aplicadas a remota NO se re-aplican**: cambios a una migración aplicada
  requieren SQL manual a la remota (como los bloques nuevos de la 46) o migración nueva.
- **Supabase MCP apunta a otro proyecto** — no usar para este; todo por psql con
  `SUPABASE_DB_URL` de `.env.local`.
- **route-guard.test falla mientras no exista page.tsx** — normal a mitad del ciclo.
- **Tipos generados a mano por builders** quedan sobrescritos por `db:types` — correrlo
  siempre después de `db:push`.

## 5. Estado demo (datos en la remota)

- Usuario demo: `DEMO_ACCOUNT_EMAIL`/`DEMO_ACCOUNT_PASSWORD` en `.env.local`.
- Dos empresas: «IPS Bogota» (tecnologia) y «Kigyo Demo Dos» (salud, subsector
  `salud-veterinaria` — el caso flagship del pitch: tiene roles sugeridos Veterinario/a,
  Auxiliar veterinario, Recepción y caja).
- «Kigyo Demo Dos» tiene `enabled_modules` explícito con los módulos nuevos de la jornada.
- `BILLING_WEBHOOK_SECRET` sin valor en `.env.example` (el webhook responde 503 sin él).

## 6. Comandos rápidos

```
npm test                                    # vitest 248
npm run typecheck                           # tsc --noEmit
npm run test:e2e                            # playwright, arranca dev solo
./scripts/db-verify.sh                     # migraciones contra PG desechable
npm run db:push                             # aplicar migraciones pendientes a remota
node scripts/gen-db-types.mjs "$DB_URL"     # regenerar types desde remota
node --experimental-strip-types scripts/gen-module-sql.mjs --module <key>
```
