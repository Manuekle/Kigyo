# Contexto de sesión — para retomar

Fecha: 2026-08-15. Rama: `feat/design-system-refresh` (~14 commits ahead de origin).
Working tree: **NO limpio** — 5 archivos sin commit (pendiente 1): 4 specs e2e nuevos + 2 fixes producto + playwright.config (workers=1). Plan CRM/ERP/POS completo (18/18 filas). E2e smoke de los 4 módulos nuevos **TERMINADO — suite 5/5 verde**.

---

## Estado

Suite e2e completa **5/5 verde** (secuencial): company-switch + dian + marketing + nomina + pos (~1.7m). vitest 256/256 · tsc 0 · build verde. db-verify local NO válido: mig 86 (`vector` extension) no instalada en homebrew PG; migs 87–93 validan por apply remota + psql policy check directo.
Remota: migraciones 1–93 aplicadas. Tipos regenerados (201 tablas) tras mig 93; `pos_sales.client_uuid` añadido por generador; RPC `lock_payroll_period`/`export_payroll_pila` añadidas a mano al bloque `Functions` (mig 90). `register_pos_sale` firma nueva (8 params) ruteada por `.rpc('name', {...})` sin tipar firma — sin toque manual.
**Playwright `workers: 1` obligatorio** — todos los specs comparten usuario demo + DB demo + org activa; paralelo revienta fixtures ajenos (teardown de un spec quita `enabled_modules` que otro está usando; signIn puede aterrizar en org equivocada por last_active_at). `fullyParallel: false` NO basta (workers>1 corre files en paralelo igual).
Residuos DB manualmente limpiados post-suite: 5 periodos nómina 2035+ cerrados + 5 empleados `E2E Nomina QA` (disable trigger temporal + delete + re-enable, verificado) y fila residual `integration_settings kind='dian'` de Kigyo Demo Dos (residuo de una corrida paralela rota, ver gotchas e2e).
Branch ahead ~14 commits orig no pusheados (usuario decide cuándo push).

## Commits de esta jornada

| Commit | Qué |
|---|---|
| `8eeef8e` `0f3cabb` `40e3f8e` `a6bfd22` `ee5f8fc` | previos (design refresh) |
| `690cd84` | feat(compras): directorio de proveedores (mig 87) |
| `a4869be` | feat(comercial): pedidos B2B (mig 88 sales_orders/items, RPC create_order_from_quote, módulo `pedidos`) |
| `49f97aa` | feat(soporte): portal público de tickets (mig 89, /soporte/[token], mutations portal.ts, botones en ficha cliente) |
| `a24d84c` | feat(nomina): nómina legal con cierre de periodo y PILA (mig 90 payroll_rules/concepts/concept_lines/locked_at, employees.tax_id, RPCs lock_payroll_period + export_payroll_pila; queries/mutations nomina.ts; client.tsx desglose+cierre+reglas+conceptos+desprendible+PILA; tipos RPC a mano) |
| `514c7d7` | chore(docs): poda de planes históricos y refs (borra 5 docs absorbidos en AGENTS.md/AUDITORIA; actualiza refs en AUDITORIA/FASE_0/PLAN_CRM_ERP_POS/CONTEXTO) |
| `c921da7` | feat(marketing): plantillas reusables y segmentación de destinatarios (mig 91 marketing_templates; queries/mutations addTemplate/deleteTemplate; generateRecipients firma nueva con filters {status,kind,city,hasEmail}; client.tsx con sección Plantillas + panel inline de filtros por campaña borrador) |
| `27e52e3` | feat(dian): facturación electrónica DIAN en modo demo (mig 92 dian_documents 1:1 invoices + dian_events append-only; integration_settings kind='dian' + provider 'dian_demo'; RPCs del vault reescritas para aceptar namespace dian; lib/dian/ubl.ts genera XML UBL 2.1 + simula CUFE SHA-256 — NO válido ante la DIAN; sendInvoiceToDian genera/inserta/actualiza doc + eventos envío/aceptación/rechazo; ruta nueva /dashboard/dian con panel + picker facturas Emitidas sin doc + modal detalle (XML + bitácora); sección DIAN en integraciones client; ROUTE_MAP register dian; actions/dian.ts envoltura para getDianDetalle y no romper build con next/headers). **Modo demo, sin firma digital ni envío real — prod DEFERIDO** (proveedor homologado + certificado + revisor fiscal). |
| `400919e` | feat(pos): cola offline con idempotencia por client_uuid (mig 93 pos_sales.client_uuid + index unique parcial; register_pos_sale p_client_uuid early-return idempotente; lib/pos/offline-queue.ts IndexedDB sin Dexie; mutations/pos.ts replayPosSale sobre RPC; pos/client.tsx listeners online/offline + auto-replay + modal cola con badge; banner 'Sin conexión · N en cola'). Defer: resolver conflictos timestamp + límite inventario offline (valida servidor al ejecutar, KG103 rechaza). |
| `6822a70` | docs(contexto): POS offline hecho, plan completo; próximos pasos decisión-abierta |

## Commit pendiente (sin stage)

| Archivo | Qué |
|---|---|
| `e2e/dian.spec.ts` | nuevo — smoke DIAN: seed factura Emitida → habilitar integración → enviar → CUFE + bitácora + XML + empty-state |
| `e2e/nomina.spec.ts` | nuevo — smoke nómina: empleado + periodo 2035 libre → concepto → línea → editar monto → cerrar → read-only → PILA (waitForResponse) |
| `e2e/marketing.spec.ts` | nuevo — smoke marketing: 3 clientes → plantilla → aplicar → campaña → filtros → audienceCount=1 → enviada |
| `e2e/pos.spec.ts` | nuevo — smoke POS offline: producto → setOffline → cobrar Efectivo → cola IndexedDB → auto-replay → Ventas Pagada → stock 4 UN |
| `playwright.config.ts` | workers: 1 (secuencial obligatorio, ver Estado) + comentario |
| `src/app/(dashboard)/dashboard/nomina/client.tsx` | 2 fixes producto: (1) PILA export usa módulo `'nomina'` no `'pila'` (ROUTE_PERMISSIONS no tiene clave `'pila'` → 403); (2) LineAmount onBlur re-sync optimista `setValue(String(n/100))` tras commit |

Sugerencia de mensaje: `feat(e2e): smoke DIAN, nómina, marketing y POS offline; fixes PILA y LineAmount`.

## Hecho antes (condensado — jornadas 1–3)

- Multiempresa: `accounts` → `organizations` (`org_id` = empresa) → `sites`. RLS congelado (`app.orgs_with` / `apply_standard_rls` / `apply_child_rls`).
- 48 módulos conmutables (migraciones 42–70), 10 verticales, 23 sectores / 84 subsectores / 95 presets. Roles sugeridos por subsector.
- 3 planos transversales (mig 62–64): portal firmado, marketing fidelización, integraciones (Wompi/WhatsApp, secretos en vault).
- Plan CRM/ERP/POS ejecutado 18/18 (mig 73–93): aging, barcode, recibo, leads, pipeline kanban, CxP, contabilidad, tickets cliente, pasarela QR, proveedores, pedidos B2B, soporte, nómina legal, marketing automation, DIAN demo, POS offline.
- Nómina base (mig 02): payroll_periods + payroll_lines con gross/deductions/net por empleado y periodo.

## Documentación vinculante / NO borrar

- `AGENTS.md`, `CLAUDE.md`, `README.md` — instrucciones del repo.
- `docs/FASE_0_CONTRATOS.md` — contratos vinculantes (citado en AGENTS.md).
- `docs/AUDITORIA_ARQUITECTURA_KIGYO.md` — razonamiento arquitectura (citado en AGENTS.md).
- `docs/SETUP.md` — setup.
- `docs/PLAN_CRM_ERP_POS.md` — plan en ejecución (18/18 filas; restan fases post-plan: RAG, sites, verticales).
- `docs/CONTEXTO_SESION.md` — este archivo.

Poda de `.md` revisada al cierre de jornada: **nada que eliminar** — los 8 archivos son vigentes o vinculantes (la poda grande ya ocurrió en `514c7d7`). No hay planes históricos muertos ni docs de fases cerradas sin referenciar.

## Pendiente (orden sugerido)

### 1. Commit de la tanda e2e — SIN HACER (usuario decide si commitear y/o push)
- 4 specs nuevos + playwright.config (workers=1) + 2 fixes producto en nomina/client.tsx. Todo verificado: suite 5/5 verde, vitest 256/256, tsc 0.
- Push sigue siendo decisión del usuario (~14 commits ahead origin).

### 2. Nómina legal — commiteado (DONE); queda validación contador
- Mig 90 aplicada a remota. Vitest 256, build 0.
- `payroll_concept_lines` tipado OK en `types.ts`. RLS `nomina:read`/`nomina:write` vía `apply_standard_rls`.
- Validación con **contador laboral colombiano OBLIGATORIA** antes de producción (plan 4.3): salario mínimo, auxilio transporte, porcentajes salud/pensión/ARL/caja todo a 0 por defecto. Banner "parámetros en cero" en UI cuando minWage=0 (ya hecho). NO inventar cifras.

### 3. Marketing automation — commiteado (DONE); conversión DEFERIDA
- Mig 91 aplicada a remota. Tabla `marketing_templates` + 4 policies RLS. Tipos regenerados (199 tablas).
- Plantillas: CRUD completo. Segmentación: `generateRecipients` con `filters {status?, kind?, city?, hasEmail?}` retrocompatible.
- **Conversión DEFERIDA**: medir respuestas/compras requiere proveedor real (WhatsApp/email delivery receipts). Tabla `marketing_events` futura. **No inventar métricas sin fuente de datos real.**
- Brecha sin cubrir: **ownerId filter** (segmentar por vendedor) — requiere roster en client.tsx. Easy follow-up (Select con `rosterFor`).

### 4. Facturación electrónica DIAN — commiteado (DONE, modo demo); producción DEFERIDA
- Mig 92 aplicada a remota. `dian_documents` (1:1 invoices) + `dian_events` (append-only — UPDATE/DELETE revocados a authenticated, verificado `pg_class.relacl`). RLS `facturacion:read`/`facturacion:write`.
- `integration_settings` acepta `kind='dian'` + `provider='dian_demo'`; 3 RPCs del vault reescritas para namespace dian.
- **lib/dian/ubl.ts** genera XML UBL 2.1 simplificado + CUFE simulado (SHA-256 determinista). **NO válido ante la DIAN** — advertencia explícita en UI y comentarios.
- **sendInvoiceToDian**: carga via RLS → CUFE+XML → `dian_documents` status='procesando' → `dian_events` envío → `dianDemoSend()` mock → actualiza + evento aceptacion/rechazo.
- **Ruta `/dashboard/dian`** (fuera de menú nav — desde Integraciones): KPIs, picker facturas Emitidas sin doc, tabla documentos, modal detalle con XML + bitácora + descarga.
- **Brechas DEFERIDAS a prod**: firma XAdES-EPES (sin certificado ICP), envío real (reemplazar `ubl.ts` por cliente de proveedor homologado — mismas tablas/panel, no tocar UI), PDF con CUFE+QR, address/city en organization snapshot (XML usa `'—'`), **validación con revisor fiscal OBLIGATORIA**.
- Estado demo: 0 filas en `integration_settings where kind='dian'` (ninguna empresa con DIAN habilitada tras limpieza).

### 5. POS offline — commiteado (DONE); conflictos y límite inventario DEFERIDOS
- Mig 93 aplicada a remota. `pos_sales.client_uuid` + unique index parcial `(org_id, client_uuid) where client_uuid is not null`. `register_pos_sale` con `p_client_uuid` early-return idempotente.
- `lib/pos/offline-queue.ts` IndexedDB crudo (sin Dexie). `mutations/pos.ts replayPosSale`. UI: listeners online/offline, auto-replay con `outboxRunning` ref guard, banner `aria-live`, modal cola (total "—" porque precio decide server).
- **DEFERIDO**: resolución de conflictos por timestamp (FIFO simple; KG103 rechaza y marca error), límite de inventario offline (server valida al ejecutar), PWA service worker (no hay SW que cache catálogo).

### 6. Fase 7 RAG documental nativo (post-plan — decisión abierta)
- RAG sobre `documents` como fuente principal, Foundry IQ como fallback. Pipeline: ingestión + chunking + embeddings en `vault` (no columnas públicas). XL nuevo. Detalle en prompt para retomar (opción b).

### 7. Sites como contexto operativo (post-plan — decisión abierta)
- `sites` ya existe (mig 31), `site_id` no propagado a `pos_sales`/`invoices`. Pre-requisito para cierres por sucursal oficiales. `app.may_access_site` ya existe. Detalle en prompt (opción c).

## Siguiente (post-plan CRM/ERP/POS — decisión)

- **Plan CRM/ERP/POS fila 1–18 completo**. Fases 5 y 6 cerradas. E2e smoke de los 4 módulos nuevos cerrado (deuda #1 saldada).
- Opciones abiertas: (a) commit de la tanda e2e (usuario decide), (b) Fase 7 RAG documental nativo, (c) propagar `site_id` a pos_sales/invoices, (d) push remoto ~14 commits.
- **Módulos verticales**: 10 verticales con crumbs; sin cobertura adicional 6 pendiente en PLAN.

## Gotchas nuevos de esta jornada (e2e smoke)

### E2e — infraestructura

- **`workers: 1` obligatorio** — specs comparten usuario demo, org activa (last_active_at del server decide la org por defecto tras signIn) y DB demo (seeds/teardowns por psql sobre los mismos fixtures). En paralelo: el teardown de nomina quita `integraciones` de `enabled_modules` mientras dian lo usa (timeout en card DIAN); el spec dian aterrizó en Kigyo Demo Dos (tiene `integraciones` de fábrica), habilitó DIAN AHÍ y el picker de facturas vacío → timeout + residuo. `fullyParallel: false` NO basta — con `workers>1` los files corren en paralelo igual.
- **`test.slow()` en todos los specs de módulo** — timeout default 30s se queda corto: dian ~24s, marketing ~26s, nomina ~32s, pos ~15-18s (medido secuencial con dev server caliente). Sin slow, dian/marketing/nomina cojean al límite.
- **Los toasts también usan `role=status`** — assert de banner offline con `[role=status]` falla strict mode (2 elementos). Usar `.pos-warn[role=status]` (el banner tiene clase; los toasts no). La nota de caja sin turno también es `.pos-warn` pero `role=note` — por eso el selector compuesto.
- **TabBar usa `role="tab"`, no `<button>` accesible por role button** — `getByRole('button', { name: 'Ventas' })` nunca encuentra. Usar `getByRole('tab', { name: ..., exact: true })`. Mismo para Vender.
- **Evento `download` flaky** — `URL.revokeObjectURL` en el mismo tick del click cancela el download event del headless. Assert via `waitForResponse` en `/api/v1/export*` + check `content-disposition` en vez de `page.waitForEvent('download')`.
- **Seed/teardown por psql heredoc con `set_config('request.jwt.claims', ...)`** — el rol de `SUPABASE_DB_URL` bypass RLS solo si no hay FORCE; sin identidad jwt, DELETE/UPDATE en silencio 0 filas. Siempre `-v ON_ERROR_STOP=1`.
- **Limpieza de residuos inmutables (periodos nómina cerrados)**: el guard trigger corre para cualquier rol (no es RLS) — para borrar periodos E2E 2035+: `alter table ... disable trigger <guard>` → delete → `enable trigger`. Verificado re-habilitados (`pg_trigger.tgenabled = 'O'`).

### E2e — producto (bugs encontrados y corregidos)

- **PILA export 403**: `runExport` usaba módulo `'pila'`, pero `ROUTE_PERMISSIONS` no tiene esa clave → `permissionsMiddleware` devolvía 403. Fix: `'nomina'`. El badge/gotcha: el nombre del módulo export no siempre coincide con el permiso.
- **LineAmount stale tras commit**: el input mostraba la prop vieja (monto en centavos) porque el estado local nunca se re-sincronizaba después del server action. Fix: `onBlur → setValue(String(n/100))` optimista.
- **`'Habilitada'` es substring de `'Deshabilitada'`** — `toContainText('Habilitada')` pasa con la integración apagada. Match exacto `/^Habilitada$/` en el badge.
- **Link `Abrir panel DIAN` con `aria-disabled`** — Playwright click respeta aria-disabled; esperar `toBeEnabled` tras habilitar.
- **`Ver cola (n)` disabled offline por diseño** (`!online` + `outboxCount>0` → botón deshabilitado, modal no abrible) — NO es bug; el spec solo asserta badge + disabled. Al volver online el botón habilita.
- **Input de monto en pesos, no centavos** — `page.fill` con 150000 (no 15000000). El valor se convierte a centavos server-side.
- **Backticks dentro de template literals SQL en psql heredoc** — el heredoc usa `'SQL'` quoted, pero strings con backtick dentro del spec (ej. `content-disposition`) requieren escape o `String.raw`.

## Gotchas previos que siguen vigentes

- **psql `-c` multi-sentencia = transacción única**: un error revierte todo. Para data-fixes, verificar con select al final del bloque o de a una.
- **RPC de módulos en `public`, no en `app`** (PostgREST solo expone esquemas expuestos).
- **Migraciones ya aplicadas a remota NO se re-aplican**: cambios → SQL manual a remota + editar archivo local para bases frescas (patrón 57/58/90/91/92/93).
- **Tipos a mano en `Functions`**: el generador solo pone tablas + check-constraints; las firmas RPC se mantienen a mano.
- **`enabled_modules` explícito pisa el preset**: probes en demo usan `enabled_modules || array['<key>']`.
- **PostgREST "function not found without parameters"** = undefined en payload o falta grant, casi siempre lo primero.
- **Supabase MCP apunta a otro proyecto** — todo por psql con `SUPABASE_DB_URL` de `.env.local`.
- **vault en db-verify**: funciones plpgsql con `vault.*` crean OK en PG plano (cuerpo se valida en ejecución). No referenciar vault en migraciones de tablas.
- **Mutations: `'use server'`, NO `'server-only'`** — server-only en archivo importado por client component rompe build.
- **BEFORE DELETE trigger que retorna `new` aborta el DELETE en silencio** — en DELETE, NEW es NULL → `return new` = skip fila. Guard: `if tg_op = 'DELETE' then return old; end if; return new;`.
- **El cierre de periodo congela las líneas para siempre, incluido el cascade** — diseño intencional: periodos cerrados inmutables, sin desbloqueo expuesto.
- **`scoped()` retorna `PostgrestFilterBuilder`, NO tiene `.update()`/`.delete()`** — para writes patrón directo `supabase.from(table).update({...}).eq('org_id', ...)`.
- **`.delete()` en child table sin org_id** (marketing_recipients): filtrar por `campaign_id` (path por padre). No intentar `.eq('org_id', ...)` en child.
- **Client component NO puede importar runtime query server-only** — `import type` o envolver en `actions/x.ts` con `'use server'` (patrón actions/dian.ts, actions/facturacion.ts).
- **`route-guard.test.ts` exige toda página en `/dashboard/<x>/page.tsx` registrada en `ROUTE_MAP`** (+ META/META_SUB en `src/lib/data/nav.ts`).
- **`REVOKE UPDATE, DELETE FROM table FROM authenticated`** — verifica via `pg_class.relacl`: `authenticated=arDxtm` (sin `w` ni `d`).
- **`drop function` antes de `create or replace` cuando la firma cambia** — Postgres distingue por (nombre, tipos de args). Mig 93 hace eso con `register_pos_sale` (7→8 params).
- **`navigator.onLine` NO garantiza red realmente arriba** — falso positivo (WiFi sin DNS). Defense-in-depth: capturar fetch fallido y ofrecer encolar.
- **Auto-replay no debe disparar si ya corre** — `outboxRunning` ref guard; dos `online` events seguidos dispararían loops dobles.
- **Generador TS no peeka firmas RPC** — firmas hand-mantained en bloque `Functions` si se quiere tipar.
- **`round(numeric * numeric / 100)` devuelve numeric, no bigint** — `returns table (..., bigint)` casca; cast `::bigint`.
- **psql `-c` no soporta `\gset`** — usar heredoc interactivo para variables de INSERT.

## Receta módulo (condensada — ver commit previo para detalle)

Registry (`src/lib/modules/registry.ts`) → gen-module-sql (`node --experimental-strip-types scripts/gen-module-sql.mjs --module <key>`) → migración (tablas + `apply_standard_rls` + bloque generado + `module_dependencies` + backfill + `sector_modules` formato `select '<s>', k, 'add' from unnest(...)`) → presets en `src/lib/modules.ts` → deps en registry → plan en `src/lib/plans.ts` → queries + mutations → page/client → apply remota + gen-types → db-verify → vitest → tsc → e2e → commit.

### Receta e2e smoke (de esta jornada)

- Specs en `e2e/`, patrón: helpers `localEnv` (lee `.env.local`), `signIn`, `ensureOrg` (switcher `.cswitch-trigger` + `[role=menuitemradio]`; re-elegir la activa cierra el menú sin navegar), `psql` heredoc con `set_config('request.jwt.claims', '{"sub":"...","role":"authenticated"}', true)`.
- Cada spec: seed en `beforeEach`-style con IDs uuid4 propios, teardown en `finally` (idempotente, borra solo lo propio). Prefijo `E2E `/`E2E-` en nombres para filtrar.
- El teardown NO puede borrar periodos nómina cerrados (inmutables por guard) ni empleados con líneas (FK) — residuo aceptado y documentado, limpiable a mano con disable trigger (ver gotchas).
- Nómina: periodo futuro libre = `2035-XX-01` (mes sin periodo existente). Employee dedup por nombre para no pisar residuos de corridas previas.
- DIAN: el seed debe añadir `integraciones` a `enabled_modules` de IPS Bogota (no lo tiene de fábrica) y el teardown lo remueve (`array_remove`).
- `npm run playwright test` con dev server corriendo (`webServer: npm run dev` reuse).

## Estado demo (datos remota)

- Usuario: `DEMO_ACCOUNT_EMAIL`/`DEMO_ACCOUNT_PASSWORD` en `.env.local`.
- Dos empresas: «IPS Bogota» (`1b82cb7c-ea6a-4b84-9388-0dceb40e5b5f`, tecnologia) y «Kigyo Demo Dos» (`f8eafe69-c415-479c-8eac-c17b1a29c6db`, salud-veterinaria, flagship, plan growth).
- «Kigyo Demo Dos» `enabled_modules` explícito con `integraciones` y `marketing` (marketing spec usa esta org). «IPS Bogota»: `nomina`, `facturacion`, `pos`, `catalogos` — `integraciones` SOLO durante el spec dian (seed/teardown).
- Smoke creds (contraseña NO hardcodear aqui): org `f8eafe69-c415-479c-8eac-c17b1a29c6db`, admin `eb711727-43fe-46a2-b8f5-f63b914191ea`. JWT claims vía `set_config('request.jwt.claims', '{"sub":"...","role":"authenticated"}', true)` en cada sesión psql.
- Tras la suite e2e: 0 residuos E2E en remota (limpieza manual al cierre; la suite por sí sola deja 1 periodo 2035 cerrado + 1 empleado `E2E Nomina QA` — esperado, no es fuga).

## Comandos rápidos

```
npm test                                    # vitest
npm run typecheck                           # tsc --noEmit
npm run build                               # build de producción
npx playwright test                         # e2e (requiere dev server; workers=1)
npx playwright test e2e/pos.spec.ts         # un spec
./scripts/db-verify.sh                      # migraciones contra PG desechable
set -a; source .env.local; set +a
DB_URL="$SUPABASE_DB_URL"; node scripts/gen-db-types.mjs "$DB_URL"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL' ... SQL
```

---

## Prompt para retomar (nueva sesión)

Copia este bloque como primer mensaje del próximo chat para arrancar con contexto mínimo y evitar la ventana de contexto lleno:

```
Retoma Kigyo. Lee docs/CONTEXTO_SESION.md (actualizado 2026-08-15): estado, commits de la jornada, pendientes ordenados y gotchas.

Nómina legal, marketing automation, DIAN demo y POS offline (filas 12/14/15/16 del plan) commiteados. Plan CRM/ERP/POS completo (18/18). E2e smoke de los 4 módulos nuevos TERMINADO: suite 5/5 verde (company-switch + dian + marketing + nomina + pos), vitest 256/256, tsc 0. Playwright workers=1 (specs comparten estado demo). Residuos E2E limpiados de remota.

Working tree NO limpio — pendiente 1: commitear 4 specs e2e + playwright.config (workers=1) + 2 fixes producto en nomina/client.tsx (PILA module 'nomina', LineAmount optimista). Branch ahead origin ~14 commits (no push).

Próximo paso: decisión abierta. Opciones:
  (a) Commit de la tanda e2e (y/o push remoto de los ~14 commits) — usuario decide.
  (b) Fase 7 RAG documental nativo (PLAN_CRM_ERP_POS.md 7.1): RAG sobre `documents` como fuente principal, Foundry IQ como fallback. Pipeline: ingestión + chunking + embeddings en vault.
  (c) Propagar `site_id` a `pos_sales`/`invoices` (mig 31 ya tiene `sites`, falta propagar) — pre-requisito para cierres por sucursal.
  (d) Módulos verticales: cobertura de los 6 verticales pendientes en PLAN.

Pasos sugeridos, en orden si opción elegida = (b) Fase 7 RAG:
1. Mig [nueva]: `documents.chunks` (parent doc FK, chunk_index, content, content_hash, token_count) + `documents.embeddings` (chunk_id FK, vector stored en vault no columna por seguridad).
2. Pipeline ingestión server action: extract texto → normalizar → chunk 800 tokens overlap 120 → guardar.
3. Server action retrieve (Foundry IQ fallback) con `documents:read` gate.
4. UI IA consume chunks (rag tool ya existe).
Si opción = (c) sites propagation:
1. Mig 94: `pos_sales.site_id` + `invoices.site_id` (`employees.site_id` ya existe).
2. RLS chain via `app.may_access_site` ya existe (mig 31).
3. UI: site picker en POS / Facturación; por defecto "todas" para admin.
Si opción = (a) commit:
1. `git add e2e/*.spec.ts playwright.config.ts "src/app/(dashboard)/dashboard/nomina/client.tsx"` → commit tipo `feat(e2e): smoke ...`.
2. Push solo si usuario lo pide.

Reglas vinculantes (AGENTS.md):
- org_id = empresa, nunca company_id. Sin public.companies ni CompanyId.
- app.apply_standard_rls/apply_child_rls/orgs_with congelados.
- Supabase MCP apunta a otro proyecto — TODO vía psql con SUPABASE_DB_URL de .env.local.
- Mutations: 'use server', no 'server-only'.
- Migraciones ya aplicadas a remota: cambios → SQL manual a remota + editar archivo local para bases frescas (patrón 57/58/90/91/92/93).
- Tipos RPC a mano en Functions; tablas + check-constraints por generador. Firmas RPC cambiantes no se tipan a mano si el proyecto rutea via `.rpc('name', {...})`.
- db-verify local falla en mig 86 (vector extension) — validar migs nuevas aplicando remota + psql policy check.
- Nómina 4.3: validación contador laboral OBLIGATORIA antes de producción. Valores por defecto a 0; NO inventar cifras regulatorias.
- Marketing conversión DEFERIDA (sin proveedor real). No inventar métricas sin fuente.
- DIAN: ambiente demo, NO producción. Producción DEFERIDA — proveedor homologado + certificado firma digital + revisor fiscal. `src/lib/dian/ubl.ts` es la puerta de reemplazo.
- POS offline: conflictos timestamp y límite inventario DEFERIDOS (valida server al ejecutar, KG103 rechaza). navigator.onLine puede falsear positive.
- E2e: workers=1 SIEMPRE (specs comparten estado demo). test.slow() en specs de módulo. TabBar = role tab, no button. Toasts también role=status.
- Client component NO importa runtime query server-only — `import type` o envolver en `actions/x.ts`.
- Ruta nueva en /dashboard/<x>/page.tsx requiere entrada en ROUTE_MAP (src/lib/data/nav.ts).
- Drop function required cuando firma RPC cambia.
- No crees archivos .md nuevos (los planificamos). Updatea CONTEXTO_SESION.md al terminar para que la próxima sesión arranque con el prompt de acá. Poda de .md revisada: nada que eliminar.

Modo caveman ultra.
```