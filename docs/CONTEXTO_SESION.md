# Kigyo — contexto maestro (estado, historia y pendientes)

Único archivo de sesión. Actualizado: 2026-08-16. Rama `feat/design-system-refresh`, push al día con origin.

---

## 1. Qué es Kigyo

Suite CRM/ERP/POS multiempresa para pymes colombianas. Next.js (App Router) + Supabase (Postgres, RLS, Auth, Storage) + Microsoft Foundry (chat IA, embeddings). Todo SaaS multi-tenant por fila con `org_id`.

Jerarquía y aislamiento (reglas de `AGENTS.md`, vinculantes):

```
Account    public.accounts          — plan, billing, límites
  └── Empresa public.organizations  — el negocio: sector, módulos, datos (org_id)
        └── Site  public.sites      — sucursal (fase sites)
```

- `org_id` = empresa, siempre. Nunca `company_id`, nunca tabla `companies`.
- En TS el vocabulario de producto es "empresa": `member.companies`, `createCompany()`; `member.orgId` conserva el nombre (~600 call sites).
- RLS congelado: `app.orgs_with`, `app.apply_standard_rls`, `app.apply_child_rls` — test de aislamiento: miembro de empresa A leyendo tablas de B recibe 0 filas.
- El scope account NUNCA otorga acceso a datos de empresa: hace falta fila en `public.memberships`.
- Registro de módulos (`src/lib/modules/registry.ts`) = única fuente de verdad; NAV, permisos y SQL se derivan y se pinean con tests (scope-guard, route-guard, account-scope, modules, plans).
- 48 módulos conmutables, 10 verticales (obra, ecommerce, pacientes, estudiantes, restaurante, agro, inmobiliario, hoteleria, suscriptores, puestos), 23 sectores / 84 subsectores / 95 presets.
- 3 planos transversales: portal firmado, marketing fidelización, integraciones (Wompi/WhatsApp, secretos en vault).

## 2. Estado de verificación

- vitest 256/256 · tsc 0 · build verde · e2e 5/5 (`workers: 1` obligatorio).
- Remota: migraciones 1–95 aplicadas. Tipos regenerados (201 tablas) tras mig 94.
- db-verify local NO válido: mig 86 (`vector`) no instalada en homebrew PG — validar migraciones nuevas aplicando remota + psql.
- Working tree limpio, branch pusheada.
- 0 residuos E2E en remota.

## 3. Historia — todo lo hecho

### Jornadas 1–3 (condensado)

- Multiempresa completa: accounts → organizations → sites, RLS congelado, memberships.
- 48 módulos conmutables (migs 42–70) + planos transversales (migs 62–64).
- Design refresh visual (serie `8eeef8e`…`ee5f8fc`).
- Nómina base (mig 02): payroll_periods + payroll_lines.

### Plan CRM/ERP/POS — 18/18 filas EJECUTADO (migs 73–93)

| # | Entregable | Estado |
|---|---|---|
| 1 | AR aging | ✅ panel en Facturación, derivado de `invoices` |
| 2 | Barcode POS | ✅ `products.barcode` (mig 73) + escáner teclado |
| 3 | Recibo 80/58mm | ✅ impresión + reimpresión + prefs (mig 74) |
| 4 | Leads | ✅ módulo + conversión RPC (mig 75) |
| 5 | Etapas pipeline | ✅ `pipeline_stages` + kanban cotizaciones (mig 76) |
| 6 | CxP calendario | ✅ `supplier_payments` + RPC cierre (migs 77, 81) |
| 7 | Contabilidad | ✅ PUC, asientos, mayor, P&G/Balance/Flujo, auto-asientos flag (migs 79–82) |
| 8 | Tickets cliente | ✅ `client_id` + `origin` + ficha (mig 78) |
| 9 | Pagos proveedor | ✅ Enterprise capability. Wompi QR + webhook firmado idempotente (migs 83–85). Falta probar con llaves reales |
| 10 | Proveedores | ✅ `suppliers` + RLS (mig 87) |
| 11 | Pedidos B2B | ✅ `sales_orders/items` + RPC desde cotización (mig 88) |
| 12 | Portal tickets | ✅ tokens sha256 + RPCs públicos anónimos `/soporte/[token]` (mig 89) |
| 13 | Nómina legal | ✅ reglas versionadas + cierre periodo + PILA (mig 90). Validación contador PENDIENTE |
| 14 | Marketing automation | ✅ plantillas + segmentación (mig 91). Conversión DEFERIDA |
| 15 | DIAN | ✅ modo demo (mig 92): XML UBL + CUFE simulado. Producción DEFERIDA |
| 16 | POS offline | ✅ cola IndexedDB + idempotencia `client_uuid` (mig 93). Conflictos/inventario DEFERIDOS |
| 17 | RAG documental | ✅ Fase 7 completa (mig 94) + híbrido + ingestión PDF/docx/xlsx |
| 18 | Sites multi-sucursal | ✅ 8/8 tablas del contrato (ver abajo) |

### Jornada 2026-08-15 — RAG híbrido + sites base + e2e

| Commit | Qué |
|---|---|
| `454ad30` | e2e smoke DIAN/nómina/marketing/POS offline (4 specs, workers=1) |
| `6cd2f71` | RAG híbrido: `content_tsv` + GIN + RPC `match_document_chunks_hybrid`; cache embeddings por content_hash |
| `e5d597b` | POS multi-sucursal: mig 95 `pos_sales.site_id`; `register_pos_sale` 9 params hereda site del turno |
| `80a8406` | Caja: turno con sucursal (abrirCaja siteId + picker + historial) |

### Jornada 2026-08-16 — sites 8/8 + RAG completo + auditoría verticales

| Commit | Qué |
|---|---|
| `d3198ac` | Inventario: activos con sucursal (picker + join + validación) |
| `c2c9fe6` | Restaurante: mesas con sucursal; comanda hereda site de la mesa |
| `bb22556` | Empleados: sucursal asignable (alta/edición + directorio) |
| `0b46c79` | Hotel + mantenimiento: habitaciones y órdenes con sucursal — CIERRA sites 8/8 |
| `34b7411` | RAG ingestión PDF/docx/xlsx (`unpdf`/`mammoth`/`xlsx`); antes solo texto plano. Smoke e2e real completo |
| `30e742b` | RAG umbral 0.68 → 0.60 calibrado con benchmark real (3 docs + 3 queries Azure) |
| `955901b` | Fix pacientes: 5 mutaciones sin `await` (fallos silenciosos) + `.eq('org_id')` explícito |

## 4. Detalle de features terminadas

### Sites (CERRADO — 8/8 tablas del contrato)

- Contrato FASE_0 §3.8: `pos_sales, cash_sessions, inventory_assets, restaurant_orders, dining_tables, employees, hotel_rooms, work_orders` llevan `site_id`. **`invoices` NO** (la factura no es propiedad de la sucursal; filtro por sucursal vía `pos_sales.site_id`).
- Mig 95 `add_site_scope('pos_sales')` + política RESTRICTIVE `app.may_access_site`.
- `register_pos_sale`: si hay turno abierto, la venta hereda el site del turno (gana el turno sobre el picker).
- Patrón UI en los 8 módulos: picker «Sucursal» solo si >1 site activa; `XxxData.sites` vía `scoped(supabase, member, 'sites')`; validación `belongsToOrg(supabase, 'sites', siteId, orgId)`; joins `sites ( name )` verificados bajo RLS real.
- Cierre Z por sucursal: pestaña «Sucursales» en `caja` (solo si `sites.length > 1`),
  agrega `historial` (turnos cerrados) por `site_id` — turnos, esperado, contado,
  diferencia. Sin migración ni consulta nueva, mismo dato que ya viajaba a la pantalla.

### RAG documental (Fase 7 CERRADA)

- Mig 94: chunks + pgvector + `content_tsv` GIN + RPC `match_document_chunks_hybrid` (blend 0.4·ts_rank + 0.6·coseno).
- `src/lib/ai/rag.ts`: chunking 600 palabras/90 overlap; embeddings Azure 1536d; cache por `content_hash` (nunca cobra 2× el mismo chunk); presupuesto mensual atómico (`reserve_ai_budget`), ledger `ai_usage_events`.
- Ingestión: `extractDocumentText` — PDF (unpdf), docx (mammoth), xlsx (SheetJS), texto plano/csv/md/json. `.doc` binario e imágenes sin OCR → no se indexan, no se rechazan. Botón Indexar en documentos.
- Umbral `AI_RAG_MATCH_THRESHOLD` default **0.60** (calibrado 2026-08-16: específicas 0.85/0.73 vs distractores 0.59/0.42; pregunta genérica 0.65 quedaba vacía con 0.68).
- Verificado e2e real: PDF → storage → `/api/ai/ingest` → chunk con embedding → recuperación híbrida.

### Nómina legal (DONE; validación externa PENDIENTE)

- Mig 90: `payroll_rules/concepts/concept_lines`, `employees.tax_id`, periodos cerrados inmutables (guard trigger), RPCs `lock_payroll_period` + `export_payroll_pila`.
- Todos los parámetros a 0 por defecto; banner «parámetros en cero» cuando minWage=0. **Validación con contador laboral colombiano OBLIGATORIA antes de producción — no inventar cifras regulatorias.**

### Marketing automation (DONE; conversión DEFERIDA)

- Mig 91: `marketing_templates` + segmentación `generateRecipients` con `filters {status, kind, city, hasEmail}`.
- Conversión (respuestas/compras) requiere proveedor real de delivery receipts.
- Filtro «Vendedor» (ownerId) al armar la lista: el mutation ya lo soportaba
  (`generateRecipients` → `clients.owner_id`); faltaba el `<Select>` en el
  panel de filtros y `roster` en `MarketingData` — ambos agregados.

### DIAN (DONE modo demo; producción DEFERIDA)

- Mig 92: `dian_documents` (1:1 invoices) + `dian_events` append-only (UPDATE/DELETE revocados a authenticated).
- `src/lib/dian/ubl.ts`: XML UBL 2.1 simplificado + CUFE simulado SHA-256. **NO válido ante la DIAN** — es la puerta de reemplazo para proveedor homologado.
- Ruta `/dashboard/dian` (desde Integraciones): KPIs, picker facturas Emitidas, tabla documentos, modal XML + bitácora.
- Producción requiere: proveedor homologado, certificado firma XAdES-EPES, PDF con CUFE+QR, revisor fiscal.

### POS offline (DONE; conflictos DEFERIDOS)

- Mig 93: `pos_sales.client_uuid` + unique parcial → idempotencia; `register_pos_sale` early-return por uuid.
- `lib/pos/offline-queue.ts` IndexedDB crudo; listeners online/offline; auto-replay con guard `outboxRunning`; banner + modal cola.
- DEFERIDO: resolución de conflictos por timestamp (FIFO, KG103 rechaza), límite inventario offline, PWA/service worker.

### Auditoría verticales (DONE 2026-08-16)

- 6 verticales no tocados por el plan auditados: obra, ecommerce, pacientes, estudiantes, suscriptores, puestos.
- Columnas verificadas contra DB, enums contra CHECK constraints, FKs validados, RLS completo, sin datos inventados.
- Único bug real: pacientes — 5 mutaciones `const { error } = builder` **sin await** (error siempre undefined, fallos silenciosos) + sin `.eq('org_id')` explícito. Corregido `955901b`.

### Facturación de Kigyo — Polar.sh (código listo 2026-08-20; llaves pendientes)

No confundir con Wompi (§5.2): Wompi cobra a los *clientes* de una empresa
desde el POS; Polar cobra a Kigyo su propia suscripción SaaS. El
`BillingProvider` de migración 38 (`src/lib/billing/provider.ts`) esperaba
justo esto — «swapping in a vendor means writing verify and parse against
their documentation, the webhook route does not change» — y así fue.

- `polarProvider()`: verifica Standard Webhooks a mano con el paquete
  `standardwebhooks` en vez del `validateEvent` tipado del SDK — ese switchea
  por tipo de evento y explota (`SDKValidationError`) en cualquiera que la
  versión instalada del SDK (0.49.0) no liste todavía, `subscription.paused`
  incluido. `accountId` sale de `customer.external_id` primero (sobrevive a
  renovaciones) y cae a `metadata.account_id`.
- `/api/billing/webhook`: Polar si `polarEnv()` existe, si no `manual`
  (`BILLING_WEBHOOK_SECRET`), si no 503. Nunca los dos a la vez.
- `src/lib/billing/polar.ts`: cliente Polar + mapa producto↔plan a partir de
  4 env vars (starter/growth × monthly/yearly). Enterprise sin checkout.
- `src/server/mutations/billing.ts`: `startPolarCheckout` (crea el checkout,
  `externalCustomerId` = accountId) y `openBillingPortal` (portal nativo de
  Polar para cambiar de plan/cancelar una suscripción ya activa — no hay
  swap-de-plan hecho a mano). Las dos exigen `account.role` owner o admin.
- UI: `/dashboard/empresas` → botón «Cambiar de plan» (solo en la cuenta
  activa) → drawer con toggle mensual/anual (`@/lib/pricing`, compartido con
  `/pricing` para que no diverjan los precios) y checkout por plan.
- `accounts.billing_provider`/`billing_status` siguen sin grant a
  `authenticated` (decisión de mig. 38, no tocada): el portal se ofrece sin
  saber si ya hay cliente Polar, y un 404 real de Polar (`ResourceNotFound`)
  se traduce a «todavía no tienes una suscripción activa».
- Pendiente puramente externo: `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`,
  `POLAR_PRODUCT_*` (4) en `.env.local` — plantilla y guía en `.env.example`.
  Sin ellos, el botón responde "todavía no está configurada" en vez de fallar.

## 5. Pendiente (todo requiere decisión o proveedor externo)

1. **DIAN producción** — proveedor homologado + certificado + revisor fiscal.
2. **Wompi en vivo** — llaves sandbox para probar loop 3.3 completo.
3. **Polar.sh** — crear cuenta, productos (4) y access token; pegar en `.env.local` (ver `.env.example`).
4. **Marketing conversión** — proveedor real de delivery.
5. **Nómina** — validación contador laboral.

Los dos ítems «opcional codeable» (cierres Z por sucursal; filtro ownerId en
marketing) quedaron hechos 2026-08-20 — ver §4.

## 6. Gotchas vigentes

### Base de datos / Supabase

- Supabase MCP apunta a otro proyecto — TODO por psql con `SUPABASE_DB_URL` de `.env.local`.
- Migraciones ya aplicadas a remota NO se re-aplican: cambios → SQL manual a remota + editar archivo local (patrón 57/58/90–95).
- Tipos a mano en bloque `Functions` de `types.ts`: el generador solo pone tablas + check-constraints.
- RPCs de módulos en `public`, no en `app` (PostgREST expone schemas públicos).
- `auth.uid()` en psql NO lee `request.jwt.claims` plural — usar `request.jwt.claim.sub` + `request.jwt.claim.role` DENTRO de `begin;…commit;` (autocommit descarta settings). Seeds RLS sí funcionan con claims plural (postgres bypass).
- Data-modifying CTE: un RAISE revierte TODO el statement.
- psql `-c` multi-sentencia = una transacción; `-c` no soporta `\gset`.
- RPC security definer: la política RLS no aplica dentro — validar site/FK explícito (KG101/KG102).
- `drop function` antes de `create or replace` cuando cambia la firma (mig 93: 7→8 params).
- `round(numeric)` devuelve numeric, no bigint — cast `::bigint` en `returns table`.
- `REVOKE UPDATE, DELETE FROM authenticated` — verificar `pg_class.relacl`: `authenticated=arDxtm` (sin w/d).
- BEFORE DELETE trigger que retorna `new` aborta el DELETE (NEW es NULL en DELETE) — `if tg_op='DELETE' then return old`.
- Guard de nómina corre para cualquier rol — borrar periodos E2E: `disable trigger` → delete → `enable`.
- `enabled_modules` explícito pisa el preset: probes usan `enabled_modules || array['<key>']`.

### App / Next.js

- Mutations: `'use server'`, NO `'server-only'` (rompe build si client lo importa).
- Client component NO importa runtime query server-only — `import type` o envolver en `actions/x.ts` `'use server'`.
- Toda página `/dashboard/<x>/page.tsx` exige entrada en `ROUTE_MAP` (`src/lib/data/nav.ts`) — route-guard.test.
- Toda query en `src/server/queries/` exige org-scope o `scoped()` — scope-guard.test rompe a propósito.
- `account-scope.test.ts` pinea tablas con site — añadir `add_site_scope` exige actualizar el expect.
- `scoped()` retorna FilterBuilder sin `.update()/.delete()` — writes directos con `.eq('org_id')`.
- `.delete()` en child sin org_id: filtrar por padre (`campaign_id`).
- **`const { error } = builder` sin `await` compila con client loose-typed (`rawClient` cast)** — runtime error siempre `undefined`, fallos silenciosos. Grep: `grep -n "= rawClient" src/server/mutations/*.ts | grep -v await`.
- Export module name ≠ permiso: `ROUTE_PERMISSIONS` debe tener la clave (bug PILA 403, fix módulo `'nomina'`).
- `navigator.onLine` falso positivo — defense-in-depth capturando fetch fallido.
- PostgREST "function not found without parameters" = payload undefined o falta grant.
- `Select` component no acepta `id` prop.

### E2e

- `workers: 1` SIEMPRE — specs comparten demo user/org/DB; paralelo revienta fixtures.
- `test.slow()` en specs de módulo (dian ~24s, marketing ~26s, nomina ~32s, pos ~15-18s).
- TabBar = `role="tab"`, no button. Toasts también `role=status` — selectores compuestos `.pos-warn[role=status]`.
- Download event flaky — assert vía `waitForResponse` `/api/v1/export*` + content-disposition.
- `'Habilitada'` es substring de `'Deshabilitada'` — match exacto en badges.
- Backticks en template literals dentro de heredoc psql — escape o `String.raw`.

## 7. Recetas

### Módulo nuevo

Registry (`src/lib/modules/registry.ts`) → `node --experimental-strip-types scripts/gen-module-sql.mjs --module <key>` → migración (tablas + `apply_standard_rls` + bloque generado + deps + backfill + `sector_modules`) → presets `src/lib/modules.ts` → plan `src/lib/plans.ts` → queries + mutations → page/client → apply remota + gen-types → db-verify → vitest → tsc → e2e → commit.

### E2e smoke

Specs en `e2e/`: helpers `localEnv`/`signIn`/`ensureOrg` (switcher `.cswitch-trigger` + `[role=menuitemradio]`); seeds con `set_config('request.jwt.claims', '{"sub":"…","role":"authenticated"}', true)`; uuids propios; teardown idempotente en `finally`; prefijo `E2E `/`E2E-`.

## 8. Estado demo (remota)

- Creds: `DEMO_ACCOUNT_EMAIL`/`DEMO_ACCOUNT_PASSWORD` en `.env.local` (no hardcodear aquí).
- «Kigyo Demo Dos» `f8eafe69-c415-479c-8eac-c17b1a29c6db` (flagship, growth) y «IPS Bogota» `1b82cb7c-ea6a-4b84-9388-0dceb40e5b5f`.
- Smoke admin: uid `eb711727-43fe-46a2-b8f5-f63b914191ea` en `f8eafe69`.
- Demo Dos `enabled_modules` explícito (sin `documentos`/`ia` por defecto — activar temporal para smokes RAG y revertir).

## 9. Comandos

```
npm test · npm run typecheck · npm run build
npx playwright test                      # e2e, workers=1, requiere dev server
./scripts/db-verify.sh                   # migraciones local (falla mig 86 vector)
set -a; source .env.local; set +a
node scripts/gen-db-types.mjs "$SUPABASE_DB_URL"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL' … SQL
```

## 10. Documentación vigente

| Archivo | Rol |
|---|---|
| `AGENTS.md`, `CLAUDE.md`, `README.md` | instrucciones repo (vinculantes) |
| `docs/FASE_0_CONTRATOS.md` | contratos vinculantes (citado por AGENTS.md, tests y plans.ts) — NO borrar |
| `docs/AUDITORIA_ARQUITECTURA_KIGYO.md` | razonamiento arquitectura (citado por AGENTS.md y tests) — NO borrar |
| `docs/SETUP.md` | puesta en marcha (citado por README y código) |
| `docs/CONTEXTO_SESION.md` | este archivo — único archivo de sesión |
| ~~`docs/PLAN_CRM_ERP_POS.md`~~ | absorbido aquí (18/18 ejecutado) — eliminado |

## 11. Prompt para retomar

```
Retoma Kigyo. Lee docs/CONTEXTO_SESION.md (maestro, 2026-08-16): qué es, todo lo hecho, gotchas y pendientes.

Estado: plan CRM/ERP/POS 18/18 + Fase 7 RAG completa (híbrido + ingestión PDF/docx/xlsx + umbral 0.60 calibrado) + sites 8/8 tablas del contrato + auditoría 6 verticales (fix pacientes). vitest 256/256, tsc 0, build verde, e2e 5/5 (workers=1), migraciones 1–95 en remota, branch pusheada, 0 residuos E2E.

Pendiente (todo requiere externo): DIAN prod (proveedor homologado + certificado + revisor), Wompi llaves reales, Polar.sh (cuenta + 4 productos + access token en .env.local), marketing conversión (proveedor), nómina (contador laboral). Facturación con Polar: código completo (checkout, portal, webhook, UI en /dashboard/empresas), solo faltan las llaves reales. Los opcionales codeable (cierres Z por sucursal, ownerId en marketing) ya están hechos.

Reglas: org_id = empresa, nunca company_id. app.apply_standard_rls/apply_child_rls/orgs_with congelados. Supabase MCP apunta a otro proyecto — todo vía psql SUPABASE_DB_URL. Mutations 'use server' no 'server-only'. Migs aplicadas: cambios = SQL manual remota + editar archivo local. Nómina/DIAN/marketing: NO inventar cifras ni métricas. E2e workers=1. Ruta nueva exige ROUTE_MAP. No crear .md nuevos — actualizar CONTEXTO_SESION.md.

Modo caveman ultra.
```
