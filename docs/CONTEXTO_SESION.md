# Kigyo — contexto maestro (estado, historia y pendientes)

Único archivo de sesión. Actualizado: 2026-08-20. Rama `main`, push al día con origin.

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
- 59 módulos en el registro (48 conmutables en el catálogo visible), 10 verticales (obra, ecommerce, pacientes, estudiantes, restaurante, agro, inmobiliario, hoteleria, suscriptores, puestos), 23 sectores / 84 subsectores / 95 presets.
- 3 planos transversales: portal firmado, marketing fidelización, integraciones (Wompi/WhatsApp, secretos en vault).

## 2. Estado de verificación

- vitest 276/276 · tsc 0 · build verde · e2e 6/6 (`workers: 1` obligatorio).
- Remota: migraciones 1–103 aplicadas. Tipos regenerados (201 tablas) tras mig 94.
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

### Auditoría pre-venta (2026-08-20) — onboarding, dashboard, sectores, arquitectura

Auditoría completa de las 62 páginas, el registro de módulos, los 23 sectores, la
capa RLS y el copy comercial. Base de partida verde (tsc 0, 264 tests, build, e2e
5/5), lo que no impidió que hubiera un bloqueante de producto sin cubrir por
ninguna prueba.

**Bloqueante — el wizard no dejaba terminar a nadie salvo en Enterprise.**
`onboarding/client.tsx` sembraba `selected` con el preset crudo del sector,
mientras `updateSector` rechaza la escritura entera si una sola clave queda
fuera del plan. Los 23 sectores proponen módulos que Starter no lleva y 8
proponen módulos que solo lleva Enterprise, así que «Continuar» fallaba en el
paso de módulos — con un error que nombraba módulos que ni siquiera estaban en
pantalla, porque la lista de toggles sí venía filtrada por plan. Única salida:
«Saltar por ahora». Verificado contra `public.sector_modules` en remota, no solo
contra el fallback de TS.

- `proposalForPlan()` en `lib/sectors.ts` devuelve `{ included, locked }` y la
  usan la pantalla **y** el test — una copia de la regla en el test habría
  pasado feliz mientras la pantalla se iba por otro lado.
- Nota `.onb-locked` bajo la lista: nombra lo que el plan no cubre y desde qué
  plan se activa, en el momento en que el sector todavía es una decisión.
- Test `sectors.test.ts` › «the wizard proposes only what the plan can save»,
  para los 3 planes × 24 sectores. Comprobado que falla si se quita el filtro.

**Dinero — «Ventas de hoy» mostraba 100×.** `queries/dashboard.ts` formateaba
`total_cents` sin dividir; el resto de la app hace `cop(x.totalCents / 100)`. Un
día de $250.000 se leía $25.000.000, en la primera pantalla que abre un dueño.

**«Hoy» era UTC en toda la app.** `organizations.timezone` se pedía en
onboarding, se guardaba desde la migración 30 y **no lo leía nadie**: los ~30
cortes de día eran `new Date().toISOString().slice(0, 10)`. En Bogotá eso salta
a las 19:00, así que «Ventas de hoy» se vaciaba durante la cena de un
restaurante y todo lo fechado de noche quedaba al día siguiente. Ahora
`member.orgTimezone` viaja en la sesión (misma query, sin round trip) y
`todayIn(tz)` en `lib/domain.ts` resuelve el corte — 27 sitios migrados entre
queries y mutations, con test de las tres zonas.

**Copy comercial que no era cierto.** El FAQ público afirmaba cuatro cosas que
el producto no hace: «los tres planes cuestan $0» (contra $80.000/$300.000/
$600.000 en `/pricing`), «cumple con la legislación laboral colombiana: sí»
(los parámetros salen en cero a propósito y exigen validación de contador),
«importar tu nómina desde Excel» (la palabra solo existía en esa frase; no hay
importación en ningún módulo) y «eliminar tu cuenta desde la configuración» (no
existe). Reescritas a lo que el producto sí hace.

**Menores corregidos.** `isEmpty` comparaba contra `'0'` y el KPI de ventas
formatea `'$ 0'`, así que `PrimerosPasos` no aparecía nunca en empresas con POS
—justo las que más lo necesitan—; ahora el KPI declara `zero`. Las tarjetas de
Recomendaciones abrían `/dashboard/riesgos` fuera cual fuera el tema, y una
empresa sin ese módulo se topaba con una página de error desde su propio
dashboard; ahora abren el asistente, que es de donde salió la recomendación y
el único módulo que el panel ya demostró que está encendido. `Select` no
aceptaba `id`: 26 `<label htmlFor>` en 8 pantallas apuntaban a nada, y a un
lector de pantalla el control le llegaba como un botón sin nombre.

**Lo que sí está bien** (verificado, no asumido): 201 tablas, 0 sin RLS, 753
políticas; las 3 tablas sin política tampoco tienen grant a `authenticated`
(selladas a service_role) y las 6 sin `orgs_with` usan `app.current_org_ids()` /
`app.is_org_admin()`, que es el plano de identidad y es correcto. Registro de
módulos coherente: 59 módulos, 61 rutas, 0 rutas sin página y 0 páginas sin
ruta. 0 presets apuntando a módulos inexistentes. 0 mutaciones con el patrón
`const { error } = rawClient(...)` sin `await`. Ningún dato inventado en las
pantallas: los literales viejos están documentados en comentarios de por qué se
fueron.

### Jornada 2026-08-21 — plan de reparación, fase 0 y fase 1

Plan por fases sobre los 13 problemas de la auditoría, ordenado por dependencia:
0 red e2e · 1 embudo relacional · 2 suspensión en RPCs · 3 inventario real
(movimientos + sucursal + recepción) · 4 impuestos POS · 5 moneda · 6 limpieza.

Momento elegido a propósito: la base estaba **vacía** —0 quotes, 0 clients, 0
invoices, 0 sales_orders— así que reparar el modelo no costó ni un backfill.
Dentro de seis meses la misma migración es un proyecto de conciliación.

**Fase 0 — `e2e/embudo.spec.ts`.** cliente → cotización → Aceptada → pedido,
más KG105. Montarla destapó tres bugs que ninguna prueba veía.

**Migración 97 — un módulo nuevo alcanza a quien ya estaba.**
`app.seed_default_permissions` corre una sola vez, al crear la empresa, y
deriva Administrador de `select key from public.permissions`. Exacto ese día,
obsoleto al siguiente módulo. Medido: IPS Bogota y Demo Dos tenían 113/115 —
les faltaba `pedidos:*` desde la migración 88; Microsoft, creada después, 115.
Cada release dejaba atrás a toda la base instalada. Ahora un trigger
`AFTER INSERT` en `public.permissions` reparte la clave nueva al rol
Administrador de cada empresa. Solo Administrador: re-sembrar «Líder de equipo»
y «Empleado» resucitaría permisos revocados a propósito (`on conflict do
nothing` no distingue «nunca lo tuvo» de «se lo quitaron»).

**Migración 98 — embudo relacional.** `quotes.client_id` y
`invoices.sales_order_id` con FK y `on delete set null`, dos guards anti-cruce
de empresa (`quotes_client_same_org`, `invoices_order_same_org`), y
`create_order_from_quote` deja de insertar `client_id = null`. El nombre de
texto sobrevive: la ficha contesta *quién es*, el texto *cómo se llamaba* —
mismo patrón que `invoices.client_name`. UI: selector de ficha sobre el campo
de nombre en el editor de cotización, con «Sin ficha — cliente nuevo» para el
trato en frío.

**Bug: el módulo Pedidos nunca funcionó desde la interfaz.** `getPedidos`
excluía las cotizaciones ya convertidas con
`.not('id', 'in', supabase.from('sales_orders').select('quote_id')…)`.
PostgREST no tiene subconsultas y supabase-js no avisa: serializa el builder y
manda `id=not.in.[object Object]`, un 400. El error de esa consulta **no se
miraba** —solo el de `ordersResult`—, así que `quotes` quedaba `[]` siempre y
«Desde cotización» salía permanentemente deshabilitado con «No hay
cotizaciones aceptadas sin pedido todavía». Con 0 pedidos en la base, nadie lo
había notado. Ahora son dos consultas cruzadas en memoria, y los dos errores se
registran.

**Bug de plan: `pedidos` y `contabilidad` estaban en Enterprise sin que nadie
lo decidiera.** Ninguno aparecía en `plans.ts` ni una vez;
`Enterprise = [...MODULE_KEYS]` recoge en silencio lo que `GROWTH` olvide, así
que «olvidado» y «vendido caro» son indistinguibles desde fuera. Consecuencias
reales: una empresa Growth cotizaba y aceptaba pero no podía convertir; y
—peor— `compras`, `facturacion` y `caja` son los tres de Growth y los tres
llaman a `maybePostAutoEntry`, así que ya estaba *generando* asientos en un
libro que su plan no le dejaba abrir. Ambos movidos a GROWTH.

Pinneado con dos pruebas en `plans.test.ts`: «Enterprise solo añade lo que su
docstring nombra» (delta exacto = tienda, ecommerce, trazabilidad — fue la que
cazó `contabilidad`) y «la cadena comercial completa cabe en Growth».

Pendiente de la fase 1: no existe flujo «facturar un pedido». La columna
`invoices.sales_order_id` y su guard ya están, así que el enlace se puede
registrar; construir la pantalla es función nueva, no reparación.

### Fase 2 — la suspensión deja de ser decorativa (migs 99, 100)

`requirePermission` niega toda escritura de una empresa suspendida, y **cero de
las 753 políticas RLS mencionaban `organizations.status`**. Como la URL y la
anon key son `NEXT_PUBLIC_*`, cualquier usuario autenticado habla con PostgREST
directo sin pasar por TypeScript. Demostrado antes de tocar nada, como
`authenticated`: suspender IPS Bogota e insertar en `clients` → `INSERT 0 1`.
La suspensión era un banner, no una regla.

Tres agujeros independientes, tres arreglos:

**Mig 99 — RLS.** `app.company_is_active(org_id)` + dos emisores nuevos
(`apply_active_guard`, `apply_active_guard_child`) que ponen políticas
**RESTRICTIVE** solo para INSERT/UPDATE/DELETE. 543 políticas sobre 181 tablas
(126 con `org_id` + 55 hijas), derivadas del catálogo y no de una lista a mano —
la condición «tiene política permissive que consulta `orgs_with`» es la
definición operativa de tabla de negocio. La migración termina con un bloque que
vuelve a preguntar y falla si alguna quedó sin guardia. `apply_standard_rls`
intacta: sigue diciendo de qué empresa es la fila, esta capa dice si esa empresa
puede escribir hoy. SELECT nunca se toca — suspender no es confiscar, y una
empresa que no puede leer sus facturas lo tiene más difícil para pagar.

Fuera a propósito: el plano de identidad (`memberships`, `roles`,
`role_permissions`, `invitations`, `membership_sites`), porque bloquearlo puede
encerrar a alguien fuera de la empresa que intenta pagar.

**Mig 100 — los RPC `SECURITY DEFINER`.** Son de `postgres`, que tiene
`rolbypassrls = true` (verificado en `pg_roles`), así que no ven ninguna
política. Guard explícito con código `KG106` en las tres que crean negocio:
`register_pos_sale`, `place_storefront_order`, `void_pos_sale`. Los tres cuerpos
se generaron desde `pg_get_functiondef()` insertando el bloque por búsqueda
exacta del ancla — cada función crece 9 líneas y ni una más. Método adoptado
tras la mig 98, donde transcribir un RPC a mano se desvió en tres puntos.
Fuera y por decisión: `post_auto_entry`, `lock_payroll_period` y los tokens de
portal (no crean negocio nuevo); el ciclo de vida de la cuenta (encerraría al
que paga); y el portal público (castiga a un tercero por la deuda de otro).

**`lib/api/handler.ts` — `route()` no miraba la suspensión.** Seis de las siete
rutas de la API piden permiso de escritura (`ia:use`, `documentos:write`), así
que una empresa impaga seguía llamando al modelo y quemando crédito de Foundry.
Tercera puerta añadida, antes que módulo y permiso.

**Lo que deliberadamente sigue pasando por encima:** `service_role` tiene
`rolbypassrls = true`, así que ni las 543 políticas ni los guards de RPC lo
tocan. Es la propiedad que hace reversible todo esto — `apply_subscription`
siempre puede reactivar una empresa suspendida, y `confirm_pos_payment` /
`reject_pos_payment` pueden liquidar un cobro que ya ocurrió aunque la empresa
se suspendiera entre la venta y la confirmación del webhook. Un guard ahí
dejaría dinero cobrado sin venta registrada.

Pinneado en `guards.test.ts`: la regla es «no termina en `:read`», no «termina
en `:write`» — `ia:use` y `configuracion:manage` son escrituras que no se
llaman así, y una regla escrita sobre `:write` las dejaba pasar a las dos.

### Fase 3 — inventario auditable (migs 101, 102, 103)

`products.stock` era un `integer` mutado en sitio por cuatro escritores, sin
tabla de movimientos. A «¿por qué tengo 7 y no 9?» el sistema no tenía respuesta
—`audit_log` guarda que hubo un UPDATE, no la razón— y `products` no llevaba
`site_id`, así que dos locales compartían un saldo aunque la venta sí se
atribuyera a su sucursal.

**Mig 101 — el modelo.**

```
inventory_movements   el porqué   append-only, un delta con signo por hecho
       │ trigger
product_stock         el qué      saldo por (producto, sucursal)
       │ trigger
products.stock        el total    derivado; solo lo escribe el trigger
```

Decisiones: `qty` entero con signo (dos columnas entrada/salida admiten el
estado «ambas llenas»); `site_id` nullable donde null = la empresa, no «sin
asignar» (0 sucursales hoy, y una fila fantasma saldría en todos los selectores);
`products.stock` sobrevive como columna porque 5 archivos de consulta y la UI la
leen. Append-only por grants: `authenticated` queda con SELECT+INSERT en el
libro y solo SELECT en el saldo, y se revoca además TRUNCATE, que no pasa por
RLS ni por trigger.

Dos cosas que costaron encontrar y quedan escritas en la migración:
- El `on conflict … do update` de una línea **no sirve**: la unicidad vive en dos
  índices parciales (null no choca con null) y una cláusula no apunta a dos.
- La comprobación de saldo negativo va **antes** de aplicar. La primera versión
  sumaba con `update … returning` y miraba después; nunca llegaba, porque el
  UPDATE completa sus triggers AFTER y `check (stock >= 0)` saltaba primero, con
  un error que ni nombraba el producto. Ahora hay `for update` sobre la fila del
  saldo y un KG103 legible — y eso mueve el candado contra sobreventa del
  catálogo (`products`) a las existencias, que es lo que se disputa.

**Mig 102 — los tres RPC al libro.** `register_pos_sale`, `void_pos_sale` y
`place_storefront_order` dejan de mutar `stock`. En el POS el asiento se emite
*después* de crear la venta, que es cuando existen su id y su sucursal. Anular
añade un asiento de `anulacion`, no borra el de venta. Cuerpos generados desde
`pg_get_functiondef`, con aserción de que no queda un `update public.products`
en ninguna.

**Cuarto escritor, en código.** `mutations/productos.ts` escribía el número del
formulario. Ahora: al crear, asiento de `apertura`; al editar, `ajuste` por la
diferencia contra el saldo de empresa.

**Recepción de compras.** «Marcar recibida» solo cambiaba una palabra: comprar
no aumentaba existencias. Ahora emite asientos `compra`, solo de las líneas con
producto de catálogo (una orden puede pedir horas de consultoría) y leyendo el
estado actual antes de escribir, para que marcarla dos veces no sume dos veces —
en un libro append-only esa segunda entrada no se borra, solo se compensa.

**Mig 103 — regresión propia, cerrada estructuralmente.** El smoke de POS
destapó que `insert into products (…, stock, …)` escribía la columna sin crear
saldo: 5 en pantalla, 0 en el libro, y la venta rechazada. No era del fixture —
`seed-demo.mjs` hace lo mismo y cualquier carga inicial también. Trigger
`after insert` que convierte la existencia inicial en apertura. Solo INSERT: con
UPDATE se llamaría en círculo con el trigger de saldo.

**Test que estaba mudo.** `account-scope.test.ts` › «every site-scope policy is
RESTRICTIVE» iteraba `[, body]` sobre un regex **sin grupo de captura**, así que
`body` era `undefined` siempre. Pasaba porque no encontraba nada: hasta la 101
todas las políticas de sucursal salían de `app.add_site_scope`. Corregido a
`match[0]` y comprobado que ahora falla si se escribe una permissive.

### Deuda abierta que salió de la auditoría

1. **Moneda.** Onboarding ofrece 8 países y 7 monedas, las guarda, y `cop()` en
   `lib/utils.ts` está fijo en COP en los 41 archivos que lo usan. Un cliente
   mexicano elige MXN y ve pesos colombianos en todas las pantallas. O se cablea
   `organizations.currency` hasta el formateo, o el selector se reduce a lo que
   el producto de verdad soporta hoy. Es decisión de producto, no un bug suelto.
2. **Cobertura e2e.** 5 specs para 62 páginas. Ninguna cubre el onboarding, que
   es donde estaba el bloqueante.
3. **`daysUntil` está escrito 6 veces** (clientes de capacitación y flota,
   `notif-panel`, `odontologia`, `contratos`, `socios`); las de cliente siguen
   calculando sobre la fecha del navegador.
4. **Botones muertos** en Configuración: «Cambiar foto» y «Cambiar logo»
   responden «próximamente».
5. **Doc drift**: §1 decía 48 módulos conmutables; el registro tiene 59.

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
