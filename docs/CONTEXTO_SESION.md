# Contexto de sesión — para retomar

Fecha: 2026-08-14 (jornada 3). Rama: `feat/design-system-refresh` (local, sin push).
Working tree limpio. Suite verde: vitest 248/248 · tsc 0 errores · e2e 1/1 · db-verify 70 migraciones limpias.

---

## 1. Qué está hecho (todo verificado y commiteado)

### Infraestructura
- Multiempresa: cuenta (`accounts`) → empresa (`organizations`, `org_id` = empresa) → `sites`.
  RLS con `app.orgs_with` / `app.apply_standard_rls` / `app.apply_child_rls` (congelados).
- Catálogo sectorial: **23 sectores, 51 subsectores, 62 presets**, presets en
  `public.sector_modules` (delta add/remove) espejo de `COMPANY_TYPES` +
  `SUBSECTOR_PRESETS` en `src/lib/modules.ts`. Pins en ambas direcciones.
- Roles sugeridos por subsector: `public.sector_roles` (migración 46) + pase 61.
  Espejo TS `src/lib/suggested-roles.ts` + test bidireccional (lee 46 + 61).
  Seed automático al crear empresa (`app.seed_default_roles`) + botón en
  Configuración → Roles («Añadir roles sugeridos»).
- Planes: 3 tiers (starter/growth/enterprise) en `src/lib/plans.ts`; gate exterior
  plan → enabled_modules → role_permissions.

### Módulos (48 conmutables + shell; migraciones 42-60)
- Jornada anterior: `socios` (42), caja/pos (43-44), odontología (45), `tiempos`
  (47), `suscripciones` (48), `cartera` (49), `notificaciones` (50), `reportes`
  (51), `creditos` (52), `donantes` (53), `suscriptores` (54), `puestos` (55),
  `calidad` (56).
- Esta jornada:
  | Migración | Módulo | Sector(es) | Commit |
  |---|---|---|---|
  | 57+58 | `obra` (vertical de construccion; presets construccion/energia/mineria) | presupuestos, capítulos, APU, avances con resync vía funciones SQL | 48ccf06 |
  | 59 | `ph` (subsector inmobiliario-ph) | asambleas, cuotas, zonas comunes | 53c831e |
  | 60 | `contratacion` (vertical de gobierno) | procesos, pliegos, oferentes | b395a4b |
  | 61 | pase de roles sugeridos | 76 roles ganan permisos de los módulos 47-60 | 3aa52d2 |
- Verticales totales: 10 (pacientes, estudiantes, restaurante, agro, inmobiliario,
  hoteleria, ecommerce, socios, obra, contratacion).

### Jornada 3 (esta)
| Migración | Módulo | Commit |
|---|---|---|
| 62 | `portal` (transversal): enlaces públicos firmados con análisis de abuso (token 24B, vencimiento 1-30d, max_views atómico, rate limit por enlace e IP, respuesta sin oráculo, auditoría). Ruta pública `/portal/[token]` | ed6da42 |
| 63 | `marketing` (transversal): campañas por canal con destinatarios desde clientes + fidelización por puntos (libro, saldo derivado) | f87fb42 |
| 64 | `integraciones` (transversal): pasarela (Wompi) y WhatsApp Cloud. Secretos SOLO en vault, RPCs de puerta grant service_role, navegador solo ve hasSecret | 739b2f1 |
| 65 | veterinaria bajo `pacientes` (patrón 45): mascota/propietario, vacunas con refuerzos, hospitalización con notas | bbcb4e2 |
| 66 | radiografías: bucket privado `radiographs` + `patient_images`, URL firmada 60s servidor | bbf5374 |
| 67 | notas estudiantes: cortes ponderados, trigger promedia la nota de la matrícula (ensanche numeric(5,2): 100.00 desbordaba) | 0bc2fdb |
| 68 | tarifas hotelería: temporadas + tarifa por tipo, RPC `hotel_rate_for` sugiere en reserva | e55c6ad |
| 69 | agro: sanidad (aplicaciones con carencia) y riego por lote | 2f967e1 |
| 70 | BOM producción: receta por producto, costo derivado de catálogo, sugiere en orden | f74f91e |

Transversales van en SPINE (los 23 presets); portal/marketing/integraciones
en plan growth; integraciones SIN filas de sector_modules (config técnica).

### Gotchas nuevos de esta jornada
- **psql `-c` con varias sentencias = una sola transacción**: un ERROR en la
  tercera revierte la primera (el UPDATE de enabled_modules se perdió dos
  veces). Para data-fixes multi-sentencia, verificar con `select` al final en
  el mismo bloque, o ejecutar de a una.
- **`storage.objects` protegido contra DELETE directo** (trigger
  storage.protect_delete). Borrar objetos de buckets usa la Storage API con
  service_role, no SQL.
- **Playwright `filter({ hasText })` NO tiene opción `exact`** — se ignora en
  silencio (esbuild no tipea). Exacto = regex `/^texto$/`.
- **Menús de nselect que persisten en el DOM**: durante el exit el menú
  anterior sigue vivo; un `.nselect-menu .nselect-item` puede matchear el
  viejo y el nuevo. Usar `.nselect-menu.is-open .nselect-item`.
- **Dos `page.on('dialog')` sobre el mismo diálogo** rompen el segundo accept
  («already handled»). Un solo handler por test, registrado temprano.
- **vault en db-verify**: funciones plpgsql con refs a `vault.*` crean OK en
  PG plano (cuerpo se valida en ejecución). No referenciar vault en
  migraciones de tablas.
- **`hotel_rate_for`/`portal_view` definer + RLS force**: postgres es
  superuser y salta RLS aunque la tabla tenga FORCE; el patrón definer
  funciona. Validar membresía dentro del definer (orgs_with) para no exponer
  datos a cualquier authenticated.

### Gotcha nuevo de la jornada anterior
- **Funciones RPC de módulos deben vivir en `public`, no en `app`**: PostgREST
  solo expone esquemas expuestos. La 57 las creó en `app` y la 58 las movió
  (migración 57 ya aplicada a remota → no re-editable; patrón: editar la vieja
  para bases frescas + migración nueva `create or replace` para la remota).
- **El guard de `sector_roles` valida permisos contra `public.permissions` al
  insertar** — por eso el pase de roles NO puede vivir en la 46 (los permisos
  47-60 no existen aún cuando corre). El pin TS↔SQL de suggested-roles.test.ts
  ahora lee 46 + 61 (filas base + UPDATEs encima).
- **Playwright + portales de nselect**: el menú del `<Select>` vive en portal,
  fuera de la card — `page.locator('.nselect-menu .nselect-item')`, y el primer
  item puede ser el placeholder vacío (usar `.nth(1)` cuando hay opción «Elige…»).
- **Probes con deletes encadenados**: esperar que la fila desaparezca
  (`toHaveCount(0)`) + pequeño `waitForTimeout` antes del siguiente delete, o el
  race de diálogos/pending muerde. `test.setTimeout(90_000)` para probes.

### UI
- Sidebar: sin buscador, sin Configuración (solo menú de usuario). Vertical
  arriba con nombre del negocio (`navLabel` por sector: «Obra», «Contratación»,
  «Clínica», etc.), orden de grupos por sector, colapso persistido.

### Docs
- `docs/SECTORES_SUBSECTORES_MODULOS.md` — catálogo vivo, pase completo con los
  48 módulos, verticales y revisiones por sector al día.
- `docs/CATALOGO_SECTORES_Y_MODULOS.md` — tabla maestra, tablas 2.1-2.3 y orden
  de trabajo actualizados.
- `docs/PLAN_PROFUNDIDAD_SECTORIAL.md` — conservado como plan histórico con nota
  de estado al inicio (no se reescribe el diagnóstico original).
- `docs/PLAN_CRM_ERP_POS.md` — plan de brechas CRM/ERP/POS. **Guardado para
  después por decisión del usuario.**

---

## 2. Pendiente (orden sugerido)

1. **Subsectores de los 11 sectores que no tienen** (energia, ecommerce,
   tecnologia, financiero, mineria, telecomunicaciones, seguridad, medios, ong,
   gobierno, logistica): el catálogo los soporta como datos; falta la decisión
   de producto. Propuesta preparada — pedir al usuario.
2. **CRM/ERP/POS:** `docs/PLAN_CRM_ERP_POS.md` cuando el usuario lo pida.
3. **Docs:** `docs/CATALOGO_SECTORES_Y_MODULOS.md` tabla maestra (2.1-2.3) con
   la columna de brechas parcialmente actualizada — repasar deltas en próximo
   pase.

---

## 3. Receta probada: añadir un módulo (14 pasos)

1. **Registry**: entrada en `src/lib/modules/registry.ts` (key, label, description, group,
   icon, route, actions ['read','write'], permissionNoun, title, subtitle). Si es vertical,
   declararlo también en `COMPANY_TYPES` (`vertical: 'key'` — SOLO UN sector puede
   reclamarlo, test lo exige) y `SECTOR_NAV` (navLabel). Icono nuevo → añadir a
   `ICON_MAP` en `Sidebar.tsx` + export en `src/lib/icons.tsx` (HugeIcons core-free).
2. **Generar SQL de permisos**: `node --experimental-strip-types scripts/gen-module-sql.mjs --module <key>`
   → copiar bloque `valid_module_keys` + `permissions` en la migración.
3. **Migración** `supabase/migrations/<timestamp>_NN_<key>.sql`: tablas con `org_id`,
   `select app.apply_standard_rls('tabla', '<key>:read', '<key>:write')`, bloque generado,
   `module_dependencies`, backfill `role_permissions` a `configuracion:manage`,
   `sector_modules` (formato `select '<sector>', k, 'add' from unnest(array[...]) as k` —
   OBLIGATORIO este formato: el regex de sectors.test.ts no capta otras formas).
   **Funciones RPC en `public`**, nunca en `app`.
4. **Presets TS**: `src/lib/modules.ts` (o SPINE si va a todos).
5. **Deps registry**: `MODULE_DEPENDENCIES` en registry.ts.
6. **Plan**: `src/lib/plans.ts` (growth = operativo; enterprise = tienda/ecommerce/trazabilidad).
7. **Server**: `src/server/queries/<key>.ts` (scoped + embeds) y `src/server/mutations/<key>.ts`
   ('use server', zod, FK-validate contra org, revalidatePath, result type).
8. **UI**: `src/app/(dashboard)/dashboard/<key>/page.tsx` (RequirePermission + Loader split)
   y `client.tsx` (cards, Badge, toasts, state desde result.data).
9. **Tipos**: aplicar migración remota (`npm run db:push`) y regenerar
   `DB_URL=$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-); node scripts/gen-db-types.mjs "$DB_URL"`.
   Las firmas RPC del bloque `Functions:` en types.ts son manuales (el generador las conserva).
10. **Verificar**: `./scripts/db-verify.sh` → `npx vitest run` → `npx tsc --noEmit` →
    `npm run test:e2e` → `npm run lint`.
11. **Probar en vivo**: habilitar módulo en demo (`enabled_modules || array['<key>']` en
    «Kigyo Demo Dos»), spec Playwright temporal en e2e/ (crear, verificar, limpiar;
    borrar el spec al terminar).
12. **Commit**: `feat(<key>): <resumen>` + cuerpo con migración/presets/pantalla.

---

## 4. Gotchas aprendidos (caros de redescubrir)

- **`trazabilidad:write` NO existe** — trazabilidad es solo lectura (la escriben triggers).
  Roles sugeridos usan solo `trazabilidad:read`.
- **e2e deja la empresa activa cambiada** — después de correrlo, la demo queda en
  «IPS Bogota». Para probes: `update public.memberships set last_active_at = now() where
  org_id = (select id from public.organizations where name = 'Kigyo Demo Dos');`
- **`enabled_modules` explícito pisa el preset** — la demo tiene lista explícita
  (añadir cada módulo con `enabled_modules || array['<key>']`, no tocar el resto).
  Si está vacía/array, no cae al preset del subsector en `resolveModules`.
- **PostgREST «function not found without parameters»** = le pasaste undefined o el grant
  falta — casi siempre es el primero (chequear el payload, no la función).
- **`hasNot` de Playwright no excluye el elemento mismo** (solo descendientes) — usar
  `:not([aria-checked="true"])` directo.
- **`account_companies` devuelve `org_id`, no `id`**.
- **Firma de `gen-db-types.mjs`**: `node scripts/gen-db-types.mjs <postgres-url>`.
- **db-verify** crea DB desechable `kigyo_verify_$$` y la dropea; `--keep` la deja.
- **Migraciones ya aplicadas a remota NO se re-aplican**: cambios a una migración aplicada
  requieren SQL manual a la remota o migración nueva (patrón 57/58).
- **Supabase MCP apunta a otro proyecto** — no usar para este; todo por psql con
  `SUPABASE_DB_URL` de `.env.local`.
- **route-guard.test falla mientras no exista page.tsx** — normal a mitad del ciclo.
- **Tipos generados a mano por builders** quedan sobrescritos por `db:types` — correrlo
  siempre después de `db:push`.
- **vitest se traga `console.log`** — para dumpear datos desde un test, `writeFileSync`.
- **`belongsToOrg` solo acepta tablas con `deleted_at`** — tablas nuevas sin soft-delete
  validan FK con consulta propia inline (ver `ownedByOrg` en mutations/obra.ts).

## 5. Estado demo (datos en la remota)

- Usuario demo: `DEMO_ACCOUNT_EMAIL`/`DEMO_ACCOUNT_PASSWORD` en `.env.local`.
- Dos empresas: «IPS Bogota» (tecnologia) y «Kigyo Demo Dos» (salud, subsector
  `salud-veterinaria` — el caso flagship del pitch: roles sugeridos Veterinario/a,
  Auxiliar veterinario, Recepción y caja).
- «Kigyo Demo Dos» tiene `enabled_modules` explícito con los módulos de las tres
  jornadas (incluye los 3 transversales + pacientes/estudiantes/hoteleria/
  agro/produccion/catalogos/clientes para probes). Cuenta demo en plan growth.
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
