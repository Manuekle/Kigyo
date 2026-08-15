# Contexto de sesión — para retomar

Fecha: 2026-08-15. Rama: `feat/design-system-refresh` (~14 commits ahead de origin).
Working tree: limpio tras commit POS offline. Plan CRM/ERP/POS completo (18/18 filas ejecutadas). Próximo: Fase 7 RAG documental o e2e smoke pendiente.

---

## Estado

Suite re-corrida tras POS offline: vitest 256/256 · tsc 0 · build verde. db-verify local NO válido: mig 86 (`vector` extension) no instalada en homebrew PG; migs 87–93 validan por apply remota + psql policy check directo. E2e smoke (nómina + marketing + DIAN + POS offline + cola IndexedDB) **deferido** (ver pendiente 1).
Remota: migraciones 1–93 aplicadas. Tipos regenerados (201 tablas) tras mig 93; `pos_sales.client_uuid` añadido por generador; `register_pos_sale` firma nueva (8 params, último `p_client_uuid uuid default null`) — el generador NO peeka firmas RPC, esa cambia manualmente si se necesita el signature reflejado en TS, pero el proyecto rutea por `.rpc('register_pos_sale', {...})` sin tipar firma, así que no hay toques a mano en este caso.
tipos `lock_payroll_period`/`export_payroll_pila` añadidos a mano al bloque `Functions` (mig 90).

Branch ahead ~14 commits orig no pusheados desde cuts anteriores (usuario decide cuándo push).

## Commits de esta jornada

| Commit | Qué |
|---|---|
| `8eeef8e` `0f3cabb` `40e3f8e` `a6bfd22` `ee5f8fc` | previos (design refresh) |
| `690cd84` | feat(compras): directorio de proveedores (mig 87) |
| `a4869be` | feat(comercial): pedidos B2B (mig 88 sales_orders/items, RPC create_order_from_quote, módulo `pedidos`) |
| `49f97aa` | feat(soporte): portal público de tickets (mig 89, /soporte/[token], mutations portal.ts, botones en ficha cliente) |
| `feat(nomina)` (este jorna) | feat(nomina): nómina legal con cierre de periodo y PILA (mig 90 payroll_rules/concepts/concept_lines/locked_at, employees.tax_id, RPCs lock_payroll_period + export_payroll_pila; queries/mutations nomina.ts; client.tsx desglose+cierre+reglas+conceptos+desprendible+PILA; tipos RPC a mano) |
| `chore(docs)` (este jorna) | chore(docs): poda de planes históricos y refs (borra 5 docs absorbidos en AGENTS.md/AUDITORIA; actualiza refs en AUDITORIA/FASE_0/PLAN_CRM_ERP_POS/CONTEXTO) |
| `feat(marketing)` (este jorna) | feat(marketing): plantillas reusables y segmentación de destinatarios (mig 91 marketing_templates; queries/mutations addTemplate/deleteTemplate; generateRecipients firma nueva con filters {status,kind,city,hasEmail}; client.tsx con sección Plantillas + panel inline de filtros por campaña borrador) |
| `feat(dian)` (este jorna) | feat(dian): facturación electrónica DIAN en modo demo (mig 92 dian_documents 1:1 invoices + dian_events append-only; integration_settings kind='dian' + provider 'dian_demo'; RPCs del vault reescritas para aceptar namespace dian; lib/dian/ubl.ts genera XML UBL 2.1 + simula CUFE SHA-256 — NO válido ante la DIAN; sendInvoiceToDian genera/inserta/actualiza doc + eventos envío/aceptación/rechazo; ruta nueva /dashboard/dian con panel + picker facturas Emitidas sin doc + modal detalle (XML + bitácora); sección DIAN en integraciones client; ROUTE_MAP register dian; actions/dian.ts envoltura para getDianDetalle y no romper build con next/headers). **Modo demo, sin firma digital ni envío real — prod DEFERIDO** (proveedor homologado + certificado + revisor fiscal). |
| `feat(pos)` (este jorna) | feat(pos): cola offline con idempotencia por client_uuid (mig 93 pos_sales.client_uuid + index unique parcial; register_pos_sale p_client_uuid early-return idempotente; lib/pos/offline-queue.ts IndexedDB sin Dexie; mutations/pos.ts replayPosSale sobre RPC; pos/client.tsx listeners online/offline + auto-replay + modal cola con badge; banner 'Sin conexión · N en cola'). DefFer: resolver conflictos timestamp + límite inventario offline (valida servidor al ejecutar, KG103 rechaza). |

## Commit pendiente (sin stage)

— (limpio) —

## Hecho antes (condensado — jornadas 1–3)

- Multiempresa: `accounts` → `organizations` (`org_id` = empresa) → `sites`. RLS congelado (`app.orgs_with` / `apply_standard_rls` / `apply_child_rls`).
- 48 módulos conmutables (migraciones 42–70), 10 verticales, 23 sectores / 84 subsectores / 95 presets. Roles sugeridos por subsector.
- 3 planos transversales (mig 62–64): portal firmado, marketing fidelización, integraciones (Wompi/WhatsApp, secretos en vault).
- Plan CRM/ERP/POS ejecutado 9/9 (mig 73–85): aging, barcode, recibo, leads, pipeline kanban, CxP, contabilidad, tickets cliente, pasarela QR. Pagos 100% simulados.
- Nómina base (mig 02): payroll_periods + payroll_lines con gross/deductions/net por empleado y periodo.

## Documentación vinculante / NO borrar

- `AGENTS.md`, `CLAUDE.md`, `README.md` — instrucciones del repo.
- `docs/FASE_0_CONTRATOS.md` — contratos vinculantes (citado en AGENTS.md).
- `docs/AUDITORIA_ARQUITECTURA_KIGYO.md` — razonamiento arquitectura (citado en AGENTS.md).
- `docs/SETUP.md` — setup.
- `docs/PLAN_CRM_ERP_POS.md` — plan en ejecución (no terminado: nómina, marketing, DIAN, POS offline).
- `docs/CONTEXTO_SESION.md` — este archivo.

## Pendiente (orden sugerido)

### 1. Smoke e2e (nómina + marketing + DIAN + POS offline) — DEFERIDO, arrancar próxima sesión

- Único spec existente: `e2e/company-switch.spec.ts`. Smoke de módulos nuevos requiere `e2e/{nomina,marketing,dian,pos}.spec.ts` (nuevos archivos `.ts`, permitidos) + `npm run dev` + creds demo de `.env.local` (org `f8eafe69…`, admin `eb711727…`).
- **Mínimo nómina**: abrir periodo → añadir concepto → editar monto línea → cerrar → verificar read-only → exportar PILA.
- **Mínimo marketing**: crear plantilla → aplicar a formulario → crear campaña → armar lista con filtros (status + hasEmail) → marcar enviada → verificar audienceCount.
- **Mínimo DIAN**: habilitar integración en /dashboard/integraciones → Abrir panel DIAN → elegir factura Emitida → Enviar a DIAN demo → verificar doc + CUFE + bitácora (envío + aceptación) → descargar XML.
- **Mínimo POS offline**: devtools offline ( throttle network → Offline) → crear carrito → cobrar Efectivo → verificar banner 'venta encolada' + badge +1 → devtools online → verificar auto-replay (toast 'Cobrado hoy' actualiza, cola vacía, venta aparece en lista Ventas) → NO habilitar QR Wompi offline (se niega explícito).
- `npm run playwright test` tras specs.

### 2. Nómina legal — commiteado (DONE); queda validación contador

- Pase A+B commiteados (`a24d84c`). Mig 90 aplicada a remota. Vitest 256, build 0.
- `payroll_concept_lines` tipado OK en `types.ts`. RLS `nomina:read`/`nomina:write` vía `apply_standard_rls`.
- Validación con **contador laboral colombiano OBLIGATORIA** antes de producción (plan 4.3): salario mínimo, auxilio transporte, porcentajes salud/pensión/ARL/caja todo a 0 por defecto. Banner "parámetros en cero" en UI cuando minWage=0 (ya hecho). NO inventar cifras.

### 3. Marketing automation — commiteado (DONE); conversión DEFERIDA

- **Commiteado** este jorna (`c921da7`). Mig 91 aplicada a remota. Tabla `marketing_templates` + 4 policies RLS. Tipos regenerados (199 tablas).
- Plantillas: CRUD completo (addTemplate/deleteTemplate via mutations, sección en client.tsx, "Aplicar" rellena formulario).
- Segmentación: `generateRecipients` recibe `filters {status?, kind?, city?, hasEmail?}` opcional. Retrocompatible (sin filtros = todos los clientes con phone, como antes). Panel inline por campaña en borrador.
- **Conversión DEFERIDA**: medir respuestas/compras post-campaña requiere integración real (WhatsApp/email delivery receipts). No se puede medir sin proveedor real (integraciones mig 64 tiene config pero sin envío real aún). Tabla `marketing_events` futura cuando haya proveedor. **No inventar métricas sin fuente de datos real.**
- Brecha sin cubrir: **ownerId filter** (segmentar por vendedor/encargado) — requiere roster en client.tsx. Deferido por scope; easy follow-up (sustituir text input por Select con `rosterFor`).

### 4. Facturación electrónica DIAN — commiteado (DONE, modo demo); producción DEFERIDA

- **Commiteado** este jorna (`27e52e3`). Mig 92 aplicada a remota. Tablas `dian_documents` (1:1 con invoices) + `dian_events` (append-only — UPDATE/DELETE revocados a authenticated). RLS `facturacion:read`/`facturacion:write` (4 policies cada tabla, verificadas via `pg_policies`).
- `integration_settings` ahora permite `kind='dian'` + `provider='dian_demo'` (extenderon `provider_check` y `kind_check`). Las 3 RPCs del vault (`integraciones_set_secret`/`get_secret`/`has_secret`) reescritas para aceptar `dian` en el namespace regex; raíz de firma XAdES-EPES pendiente (en prod iría al vault).
- **lib/dian/ubl.ts** genera XML UBL 2.1 simplificado + simula CUFE (SHA-256 determinista de campos canónicos). **NO es válido ante la DIAN** — el documento deja explícita la advertencia fiscal en comentarios y en la UI.
- **sendInvoiceToDian**: carga invoice+items+org+client via RLS (cliente del usuario) → genera CUFE+XML → inserta `dian_documents` status='procesando' → lanza `dian_events` envío → llama `dianDemoSend()` (mock síncrono) → actualiza documento + inserta evento aceptacion/rechazo.
- **Ruta nueva `/dashboard/dian`** (panel dedicado, no en menú nav — alcanzado desde Integraciones): KPIs (aceptadas/rechazadas), picker de facturas Emitidas pendientes (sin doc), tabla de documentos DIAN, modal detalle con XML UBL + bitácora de eventos + descargar CUFE/XML.
- **Sección DIAN en integraciones client.tsx**: checkbox de habilitación + Probar (solo valida `enabled=true`) + link "Abrir panel DIAN" (disable si no habilitado).
- **ROUTE_MAP register `dian`** en `src/lib/data/nav.ts` (mismo patrón que `empresas` — cuenta-level route, no módulo conmutable). Sino `route-guard.test` fallaba "directory has no entry in ROUTE_MAP".
- **actions/dian.ts** envuelve `getDianDetalle` en `'use server'` — Query `queries/dian.ts` es `server-only` (importa `next/headers`); client no puede importarla directo y build rompe con "importing a module that depends on next/headers in Pages Router". Mismo patrón que `actions/facturacion.ts`.
- **Brechas intencionalmente DEFERIDAS a prod**:
  - **Firma digital XAdES-EPES** — sin librería, sin certificado ICP Colombia. El XML tiene `<!-- demo: firma digital XAdES-EPES y slot DIAN pendientes -->` donde iría el slot.
  - **Envío real a la DIAN** — `dianDemoSend` retorna respuesta mock (acepta siempre si hay CUFE+XML). En prod: reemplazar `src/lib/dian/ubl.ts` por cliente del proveedor homologado — mismas tablas, mismo panel, no tocar UI.
  - **Representación gráfica PDF** — el plan mencionaba PDF con representación visual; deferred (el XML es descargable desde el modal). Futuro: generar PDF con el CUFE y QR en el documento.
  - **Address/city en organization snapshot** — `organizations` no tiene address ni city (solo `country`). XML usa `'—'` como placeholder. Deferred: añadir columnas a organizations o usar `setup_completed_at` snapshot.
  - **Validación con revisor fiscal OBLIGATORIA** antes de prod.
- 0 filas en `integration_settings where kind='dian'` (aún no habilitada para ninguna empresa demo — el admin debe activarla en Integraciones).

### 5. POS offline — commiteado (DONE); conflictos y límite inventario DEFERIDOS

- **Commiteado** este jorna (`400919e`). Mig 93 aplicada a remota. `pos_sales.client_uuid` uuid nullable + unique index parcial `(org_id, client_uuid) where client_uuid is not null`. `register_pos_sale` extendido con `p_client_uuid uuid default null`: early return si existe → reintento no duplica, no recobra stock.
- `lib/pos/offline-queue.ts` wrapper IndexedDB crudo (sin Dexie — sin nueva dependencia). Store `pos_outbox` keyPath `clientUuid`, indices `createdAt` y `status`. Operaciones: `enqueuePosSale`/`listPendingPosSales`/`countPendingPosSales`/`clearPosSale`/`markPosSaleError`/`clearAllPosOutbox`.
- `mutations/pos.ts replayPosSale` — envoltura sobre RPC con `clientUuid` obligatorio. Reusa `saleSchema` via `.extend({clientUuid})`. Mismo mapeo de errores KG10x.
- `pos/client.tsx`:
  - Listeners `online`/`offline` (navigator.onLine + eventos) → `setOnline`.
  - `charge()`: offline + paymentMethod no-QR → `enqueuePosSale`, toast "Venta encolada". QR Wompi offline → niega explícito (no webhook offline).
  - `useEffect([online])`: auto-replay cuando regresa red.
  - Banner `Sin conexión · N en cola` con `aria-live="polite"`.
  - Modal cola con tabla (líneas/medio/estado/error, total "—" porque precio se decide en server).
- **DEFERIDO**: **resolución de conflictos por timestamp** (plan 16) — ahora FIFO simple, sin merge si dos cajeros vendieron offline la última unidad: `register_pos_sale` rechaza con KG103, marca error para revisión manual.
- **DEFERIDO**: **límite de inventario offline** — el navegador asume "hay stock" y encola; el servidor valida al ejecutar. UI no advierte "stock potencial bajo" mientras offline.
- **DEFERIDO**: **PWA service worker** — manifest ya existe, pero no hay SW que cache catálogo para uso sin red. IndexedDB almacena solo outbox, no catálogo.

## Siguiente (post-plan CRM/ERP/POS — decisión)

- **Plan CRM/ERP/POS fila 1–18 completo**. Fases 5 y 6 (multiempresa + sites + plan CRM/ERP/POS) cerradas.
- **Fase 7 RAG documental nativo** (PLAN_CRM_ERP_POS.md 7.1): RAG sobre `documents` como fuente principal, Foundry IQ como fallback. Pipeline: ingestión + chunking + embeddings en `vault` (no columnas públicas). XL nuevo.
- **Sites como contexto operativo** (mig 31 ya existe tabla `sites`, pero `site_id` no está propagado a `pos_sales`/`invoices`): deferred desde plan 16. Pre-requisito si se quieren cierres por sucursal oficiales.
- **Módulos verticales**: 10 verticales existentes con crumbs; sin cobertura adicional 6 pendiente en PLAN.
- **Push remoto**: ~14 commits sin push (usuario decide).

## Gotchas nuevos de esta jornada (nómina + marketing)

### Nómina

- **BEFORE DELETE trigger que retorna `new` aborta el DELETE en silencio**: en DELETE, NEW es NULL → `return new` = `return NULL` = skip fila. Fix: en el guard, `if tg_op = 'DELETE' then return old; end if; return new;`. Bug que costó 30 min depurando smoke (DELETE 0 con periodo desbloqueado, sin error).
- **psql `-c` no soporta `\gset`**: pasar psql -c HEREDOC o split. Si necesitas variable de un INSERT, usar `\gset` requiere psql interactivo/HEREDOC, no `-c "..."`.
- **psql sin `set_config` → RLS niega en silencio (DELETE 0)**: el rol de la URL de service bypass RLS solo si no hay FORCE. Heredoc con `select set_config('request.jwt.claims', ...)` ANTES de inserts/deletes para que la sesión tenga identidad.
- **El cierre de periodo congela las líneas para siempre, incluido el cascade**: borrar un periodo cerrado dispara el guard en cada línea via cascade → aborta → FK violation. Diseño intencional: periodos cerrados son inmutables, no hay desbloqueo expuesto.
- **`round(numeric * numeric / 100)` devuelve numeric, no bigint**: el `returns table (..., bigint)` casca con "structure of query does not match". Fix: cast `::bigint` en cada round.

### Marketing

- **`scoped()` retorna `PostgrestFilterBuilder` (post-`.select().eq()`), NO tiene `.update()`/`.delete()`**: para writes usa `supabase.from(table).update({...}).eq('org_id', member.orgId).eq(...)` patrón directo, no `scoped()`. `scoped` solo para selects que esperan filter builder.
- **`.delete()` en child table sin org_id (e.g. `marketing_recipients`)**: filtra por `campaign_id` (path por padre). No existe `org_id` en la child; `apply_child_rls` hereda aislamiento por FK. No intentar `.eq('org_id', ...)` en child — falla column no exist.
- **`server-only` in `queries/shared.ts` NO bloquea import en mutations `'use server'`**: 33 mutations ya lo hacen (`belongsToOrg`, `currentEmployeeId`). `'use server'` archivos son server-resident. Confirma patrón antes de dudar.
- **Fragment` con key en `.map()` cuando cada iteración emite múltiples `<tr>` hermanos**: `<>` shorthand no acepta key; debe ser `<Fragment key={id}>...</Fragment>`. Caso: expansión inline de filtros como segunda fila de tabla bajo la fila de campaña.
- **db-verify local falla en mig 86 (`vector` extension)**: homebrew PG no tiene `vector`. Migs 87–92 validan por apply remota + psql policy check, no db-verify local. No gastar tiempo arreglando PG local; rompe solo en mig 86 onwards.

### DIAN

- **Client component NO puede importar runtime query server-only** — `import { fn } from queries/x.ts` (con `import 'server-only'` o que importa `next/headers`) rompe build con "importing a module that depends on 'next/headers' in Pages Router". Solution: `import type { Type }` (borrado por compilador) si solo importas tipos, o envolver la query en `actions/x.ts` con `'use server'` para runtime calls. Patrones: marketing client.tsx usa `import type` solo; dian client.tsx usa `actions/dian.ts` + `import type`.
- **`route-guard.test.ts` exige toda página en `/dashboard/<x>/page.tsx` registrada en `ROUTE_MAP`** — ruta nueva sin entrada en `ROUTE_MAP`cae el test "directory has no entry". Patrón: añadir entrada manual en `src/lib/data/nav.ts` ROUTE_MAP (junto a `empresas`) cuando el módulo no es conmutable (no entra en FLAT.nav). Lo mismo aplica a META (título topbar) y META_SUB (subtítulo).
- **`REVOKE UPDATE, DELETE FROM table FROM authenticated`** — confirma vía `pg_class.relacl`: `authenticated=arDxtm` (sin `w` ni `d`) = append-only enforcement. RLS adicional a `apply_child_rls`. Útil para bitácoras fiscales (`dian_events`).
- **Mig con `CREATE OR REPLACE FUNCTION` sobre RPC ya aplicada** — idempotente. Mig 92 reemplazó las 3 RPCs del namespace vault (`integraciones_set_secret`/`get_secret`/`has_secret`) sin drop explícito. Fallar al aplicar una mig parcial por typo en grants nombre firma (e.g. `integraciones_get_secret(text, text)` vs `(text)`) rompe ahí; corregir y reejecutar archivo completo — las sentencias anteriores son idempotentes.
- **`integration_settings` check constraint nombre exacto** — `\d integration_settings` o `pg_constraint` lookup. Para alter: `alter table ... drop constraint integration_settings_kind_check`, `add constraint integration_settings_kind_check check (kind in (...))`. Mig 92 hace eso para añadir 'dian' sin recrear la tabla.

### POS offline

- **`drop function` antes de `create or replace function` cuando la firma cambia** — Postgres distingue funciones por (nombre, tipos de args). Cambiar el número de params requiere `drop function if exists <name>(<old args>)` y luego `create or replace <name>(<new args>)`. Mig 93 hace eso con `register_pos_sale` (7→8 params). Sin drop, quedan dos versiones y `.rpc()` puede llamar la antigua.
- **Unique index parcial con `where ... is not null`** permite múltiples nulls — `client_uuid`nullable, ventas online no lo envían, no chocan. Si también requisitas `org_id` dentro del unique, es `(org_id, client_uuid) where client_uuid is not null`: dos empresas con même uuid no colisionan (next a impossible, pero diseño sound).
- **`store.index()` retorna `IDBIndex` no `IDBRequest`** — wrapper helper `tx('readonly', fn)` que retorna `req.result` no sirve para `index.count()`. Para index access hay que hacer la transacción manualmente en lib/lib: `db.transaction(STORE).objectStore(STORE).index('status').count('pending')`. Mi wrapper crudo solo cubre getAll/add/put/delete/get.
- **`navigator.onLine` NO garantiza red realmente arriba** — un `true` puede falso positivo (WiFi conectado, sin DNS, sin ruta). El `cobrarPago` falla por timeout y toast errurso. Mejor UX: capturar el fetch y ofrecer encolar manual si falla 2 veces seguidas. Defense-in-depth.
- **Auto-replay no debe disparar si ya está corriendo** — `outboxRunning` ref guarda el lock; `useEffect([online])` lo checkea. Sin eso, dos `online` events seguidos disparan dos loops y duplican llamadas (idempotencia RPC lo protege, pero consume ancho de banda).
- **Generador TS no peeka firmas RPC** — `src/lib/supabase/types.ts` lista tablas + check-constraints; funciones RPC deben hand-mantained en bloque `Functions` si se quiere tipar la llamada. El proyecto rutea `.rpc('register_pos_sale', {...})` sin tipar firma, así que cambio de firma no requiere toque a mano — pero un dev que la espera tipada va a buscar fantasmas.

## Gotchas previos que siguen vigentes

- **psql `-c` multi-sentencia = transacción única**: un error revierte todo. Para data-fixes, verificar con select al final del bloque o de a una.
- **RPC de módulos en `public`, no en `app`** (PostgREST solo expone esquemas expuestos).
- **Migraciones ya aplicadas a remota NO se re-aplican**: cambios → SQL manual a remota + editar archivo local para bases frescas (patrón 57/58, ahora 90).
- **Tipos a mano en `Functions`**: el generador solo pone tablas + check-constraints; las firmas RPC se mantienen a mano.
- **`enabled_modules` explícito pisa el preset**: probes en demo usan `enabled_modules || array['<key>']`.
- **PostgREST "function not found without parameters"** = undefined en payload o falta grant, casi siempre lo primero.
- **Supabase MCP apunta a otro proyecto** — todo por psql con `SUPABASE_DB_URL` de `.env.local`.
- **vault en db-verify**: funciones plpgsql con `vault.*` crean OK en PG plano (cuerpo se valida en ejecución). No referenciar vault en migraciones de tablas.
- **Mutations: `'use server'`, NO `'server-only'`** — server-only en archivo importado por client component rompe build.

## Receta módulo (condensada — ver commit previo para detalle)

Registry (`src/lib/modules/registry.ts`) → gen-module-sql (`node --experimental-strip-types scripts/gen-module-sql.mjs --module <key>`) → migración (tablas + `apply_standard_rls` + bloque generado + `module_dependencies` + backfill + `sector_modules` formato `select '<s>', k, 'add' from unnest(...)`) → presets en `src/lib/modules.ts` → deps en registry → plan en `src/lib/plans.ts` → queries + mutations → page/client → apply remota + gen-types → db-verify → vitest → tsc → e2e → commit.

### Receta nómina (de esta jornada)

- No hay módulo nuevo (nómina ya existe como clave del preset).
- Tablas hijas (payroll_concept_lines): `apply_standard_rls('payroll_concept_lines', 'nomina:read', 'nomina:write')` con `org_id` directo (no child_rls — tiene su propio org_id).
- Valores por defecto a 0 (reglas): el contador los fija. Banner "parámetros en cero" en la UI cuando minWage=0.
- Cierre congela para siempre. No exponer desbloqueo.

### Receta marketing tablas hijas (de esta jornada)

- Mismo módulo (clave `marketing` ya en `valid_module_keys` desde mig 63). Mig nueva NO toca `valid_module_keys`/`permissions`/`sector_modules`/`module_dependencies`.
- Tabla con `org_id` propio (`marketing_templates`): `apply_standard_rls('marketing_templates', 'marketing:read', 'marketing:write')`. Genera 4 policies (select/insert/update/delete) — verificado vía `pg_policies`.
- Para writes en `scoped()`-like filter, usar `supabase.from(table).update({...}).eq('org_id', member.orgId).eq(...)` (NO `scoped().update()` — filter builder no expone `.update`).
- `generateRecipients` antes extendía `clients` sin filtros firma `(campaignId: string)`; ahora firma `(input: {campaignId, filters?})`. Cambio retrocompatible: filters undefined = todos los clientes con phone.

### Receta DIAN tablas + integración (de esta jornada)

- No hay módulo nuevo (DIAN es integración, no conmutable). Ruta nueva `/dashboard/dian` no entra en FLAT.nav — añadir a `ROUTE_MAP`/`META`/`META_SUB` en `src/lib/data/nav.ts` junto a `empresas` (cuenta-level).
- Ampiar `integration_settings` existente: alter `kind_check`/`provider_check` (drop + add constraint); no recrear la tabla. `CREATE OR REPLACE FUNCTION` para extender el namespace regex de las 3 RPCs del vault — idempotente.
- Tabla fiscal + hijo append-only: `apply_standard_rls` para `dian_documents` (org_id directo, `facturacion:read`/`facturacion:write`), `apply_child_rls` para `dian_events` (child de dian_documents por `dian_document_id`). Append-only enforcement extra: `revoke update, delete on public.dian_events from authenticated;` — verifica con `pg_class.relacl` aparece `authenticated=arDxtm` (sin `w` ni `d`).
- Lib UBL/CUFE en `src/lib/<modulo>/` (no en `server/queries/`). Generador puro, sin supabase ni next/headers. Server action puede importarla; client también si fuera necesario (no es este caso).
- RLS-route para server query reads en client: envolver en `actions/<modulo>.ts` con `'use server'`. Patrón `actions/facturacion.ts`. Query mutations (`'use server'`) ya son importables desde client directo; queries (`server-only`) requieren la envoltura.
- Snapshot fiscal debe almacenar copia (invoice_code, client_name, total_cents) en la tabla fiscal, no solo FK — una invoice editada después no altera el histórico fiscal (mismo patrón que `invoices.client_name` snapshot).

### Receta POS offline idempotencia (de esta jornada)

- No hay módulo nuevo (`pos` ya existe). No ruta nueva (pane POS existente). Mig toca tabla + RPC existente.
- Columnas nuevas nullable + unique index parcial `where <col> is not null` para idempotencia sin romper filas antiguas. Default null en el parámetro RPC para callers previos (retrocompatible).
- Firma RPC cambia (pora Idempotency-Key) → `drop function if exists <name>(<old args>); create or replace <name>(<new args>)` SIN saltar drop deja dos versiones en paralelo y `.rpc('name')` puede disparar la antigua.
- Early return idempotente: `select * from public.t where org_id = p_org_id and client_uuid = p_client_uuid; if found then return query select <existing fields>; return; end if;`. Sin recobrar existencias, sin reescrebir — el reintento duplicado no daña.
- Lib offline wrapper en `src/lib/<modulo>/offline-queue.ts` sin dependencias externas (IndexedDB crudo). Store con `keyPath = clientUuid`, indices `createdAt`/`status`. Operaciones saga: `enqueue`/`listPending`/`count`/`clear`/`markError`. Helper `disponible()` comprueba `typeof indexedDB`.
- Mutation `replayPosSale` como envoltura sobre RPC con `clientUuid` obligatorio. Reusa `saleSchema` via `.extend({clientUuid})` — no redefinir todo. Mismo mapping de códigos error.
- UI: listeners `online`/`offline` (`navigator.onLine` + window events) en `useEffect([])`. Auto-replay en `useEffect([online])` con `outboxRunning` ref guard. Banner `aria-live="polite"`. Modal cola con tabla — total "—" si el precio se decide en server (no confías en browser).
- **QR Wompi offline niega explícito** en `charge()`: el webhook no garantiza offline; el pago en línea inherente no puede encolarse.

## Estado demo (datos remota)

- Usuario: `DEMO_ACCOUNT_EMAIL`/`DEMO_ACCOUNT_PASSWORD` en `.env.local`.
- Dos empresas: «IPS Bogota» (tecnologia), «Kigyo Demo Dos» (salud, `salud-veterinaria`, flagship), plan growth.
- «Kigyo Demo Dos» `enabled_modules` explícito con módulos de las tres jornadas. Para probes: `|| array['<key>']`.
- Smoke creds (contraseña NO hardcodear aqui): org `f8eafe69-c415-479c-8eac-c17b1a29c6db`, admin `eb711727-43fe-46a2-b8f5-f63b914191ea`. JWT claims vía `set_config('request.jwt.claims', '{"sub":"...","role":"authenticated"}', false)` en cada sesión psql.

## Comandos rápidos

```
npm test                                    # vitest
npm run typecheck                           # tsc --noEmit
npm run build                               # build de producción
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

Nómina legal (fila 12), marketing automation (fila 14), facturación electrónica DIAN modo demo (fila 15) y POS offline con cola IndexedDB + idempotencia client_uuid (fila 16) ya commiteados y verificados (vitest 256/256, tsc 0, build verde). Plan CRM/ERP/POS completo (18/18 filas). Working tree limpio. Branch ahead origin ~14 commits (no push).

Próximo paso: decisión abierta. Opciones:
  (a) E2e smoke DEFERIDO de los 4 módulos nuevos (`e2e/{nomina,marketing,dian,pos}.spec.ts`) — cubrir deuda pendiente.
  (b) Fase 7 RAG documental nativo (PLAN_CRM_ERP_POS.md 7.1): RAG sobre `documents` como fuente principal, Foundry IQ como fallback. Pipeline: ingestión + chunking + embeddings en vault.
  (c) Propagar `site_id` a `pos_sales`/`invoices` (mig 31 ya tiene `sites`, falta propagar) — pre-requisito para cierres por sucursal.
  (d) Push remoto de los ~14 commits pendientes (usuario decide).

Pasos sugeridos, en orden si opción elegida = (a) e2e smoke:
1. Escribir primer spec `e2e/dian.spec.ts` (más aislado — invierte Integraciones → DIAN → Enviar factura Emitida → verificar CUFE + bitácora).
2. Replicar para nomina/marketing/pos.
3. `npm run playwright test` verde.
Si opción = (b) Fase 7 RAG:
1. Mig [nueva]: `documents.chunks` (parent doc FK, chunk_index, content, content_hash, token_count) + `documents.embeddings` (chunk_id FK, vector stored en vault no columna por seguridad — embeddings clave encriptada).
2. Pipeline ingestión server action: extract texto → normalizar → chunk 800 tokens overlap 120 → guardar.
3. Server action retrieve (Foundry IQ fallback) con `documents:read` gate.
4. UI IA consume chunks (rag tool ya existe).
Si opción = (c) sites propagation:
1. Mig 94: `pos_sales.site_id` + `invoices.site_id` (`employees.site_id` ya existe).
2. RLS chain via `app.may_access_site` ya existe (mig 31).
3. UI: site picker en POS / Facturación; por defecto "todas" para admin.
Si opción = (d) push:
1. `git push origin feat/design-system-refresh` (revisar si hay commits conflictivos primero).

Reglas vinculantes (AGENTS.md):
- org_id = empresa, nunca company_id. Sin public.companies ni CompanyId.
- app.apply_standard_rls/apply_child_rls/orgs_with congelados.
- Supabase MCP apunta a otro proyecto — TODO vía psql con SUPABASE_DB_URL de .env.local.
- Mutations: 'use server', no 'server-only'.
- Migraciones ya aplicadas a remota: cambios → SQL manual a remota + editar archivo local para bases frescas (patrón 57/58/90/91/92/93).
- Tipos RPC a mano en Functions; tablas + check-constraints por generador. NOTA: firmas RPC cambiantes (como register_pos_sale) no se tipan a mano si el proyecto rutea via `.rpc('name', {...})` sin tipar signature.
- db-verify local falla en mig 86 (vector extension) — validar migs nuevas aplicando remota + psql policy check.
- Nómina 4.3: validación contador laboral OBLIGATORIA antes de producción. Valores por defecto a 0; NO inventar cifras regulatorias.
- Marketing conversión DEFERIDA (sin proveedor real). No inventar métricas sin fuente.
- DIAN: ambiente demo, NO producción. Producción DEFERIDA — requiere proveedor tecnológico homologado por la DIAN + certificado firma digital + revisor fiscal. Misma lib `src/lib/dian/ubl.ts` será la puerta de reemplazo.
- POS offline: conflictos timestamp y límite inventario DEFERIDOS (valida server al ejecutar, KG103 rechaza). navigator.onLine puede falsear positive.
- Client component NO importa runtime query server-only — usar `import type` o envolver en `actions/x.ts` con `'use server'`.
- Ruta nueva en /dashboard/<x>/page.tsx requiere entrada en ROUTE_MAP (src/lib/data/nav.ts), mismo patrón que `empresas`.
- Drop function required cuando firma RPC cambia — `drop function if exists <name>(<old args>); create or replace <name>(<new args>)`.

Modo caveman ultra. No crees archivos .md nuevos (los planificamos). Updatea CONTEXTO_SESION.md al terminar para que la próxima sesión arranque con el prompt de acá.
```