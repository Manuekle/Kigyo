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

- vitest 290/290 · tsc 0 · build verde · lint 0/0 · e2e 6/6 (`workers: 1` obligatorio).
- Remota: migraciones 1–104 aplicadas. Tipos regenerados (201 tablas) tras mig 94.
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

### Fase 4 — IVA real, y `price_cents` con un solo significado (mig 104)

Dos hechos medidos: `pos_sales.tax_cents` existe desde la mig 43 y **nunca lo
escribe nadie** (ninguna función lo menciona, las 5 ventas lo tienen en 0); y
—lo grave— `products.price_cents` ya significaba dos cosas:

```
POS          cobra ese número tal cual   → precio CON IVA
Facturación  lo copia a la línea y suma  → precio SIN IVA
```

`facturacion/client.tsx` escribía `product.priceCents` en `unitPrice` y
`totalsOf()` hace `total = subtotal + tax`. **Facturar un producto a su precio
de góndola cobraba 19% de más.** Eso es peor que lo que la auditoría anotó como
§23-8, que además se equivocaba: dijo que la columna no existía.

**La decisión:** `price_cents` es el precio CON IVA — lo que se paga en
mostrador. Es lo que el POS ya hacía, lo que exige el etiquetado al público en
Colombia, y la única lectura que no sube ningún precio existente. La contraria
habría subido cada producto un 19% en silencio el día del despliegue.

- POS **extrae**: `impuesto = bruto × tasa / (100 + tasa)`. El total que paga el
  cliente es idéntico al de hoy; lo único que deja de ser 0 es `tax_cents`.
- Factura **convierte** al copiar: `neto = bruto ÷ (1 + tasa/100)`, y arrastra la
  tasa, así que su `total = subtotal + tax` vuelve al mismo precio de góndola.

**`pos_sales` NO adopta `total = subtotal + tax`, y está escrito en la migración
para que nadie lo «arregle»:** el recibo imprime `Subtotal − Descuento = Total`
y un cliente lo comprueba con la vista. `tax_cents` no se suma a nada — dice
cuánto de ese total ya era impuesto. Recibo de mostrador y factura B2B presentan
el IVA distinto en la vida real, y forzar una sola forma es lo que produjo el
bug del 19%.

`products.tax_rate` por producto (en Colombia conviven 19%, 5% y exentos) y por
defecto **0**, no 19: estrenar impuesto sobre catálogos que nadie revisó es
cambiarle los números a alguien sin preguntar. `pos_sale_items` guarda `tax_rate`
y `tax_cents` por línea — copiados, no referenciados, para que el recibo siga
diciendo lo mismo si el producto cambia de tasa mañana, y porque el UBL de DIAN
los pedirá por línea.

El descuento se reparte proporcionalmente antes de extraer: cobrar menos y
declarar el IVA del precio de lista sería declarar un impuesto que nadie pagó.
Verificado: 11.900@19% → IVA 1.900; con 1.000 de descuento → IVA 1.740; carrito
mixto 19%+exento → IVA 1.900 y la línea exenta en 0.

`taxWithin()` y `netFromGross()` en `lib/domain.ts` porque la fórmula la
necesitaban tres sitios. Pinneadas con la prueba que importa: **no** es
`bruto × tasa/100`, que sobre un precio con IVA declara 361 de más por unidad.

**Alcance corregido.** Dije que esto desbloqueaba el puente a DIAN desde
mostrador. No existe tal puente: `dian.ts` solo lee `invoices`. Una venta POS
tendría que convertirse en factura primero, y eso es función nueva, no
reparación. El dato por línea se guarda ahora porque solo existe en el momento
de la venta.

### Fase 5 — la moneda deja de ser un ajuste que no hace nada

Decisión delegada, y la tomé **al revés de lo que parecía obvio** — con los
números medidos, no antes.

Empecé cableando `organizations.currency` hasta el formateo, que es el arreglo
simétrico al de `timezone`: `Member.orgCurrency`, `cop(n, currency)`,
`useMoney()` en MemberContext, y un codemod sobre los 41 archivos. **Lo revertí
entero.** El codemod destapó que el coste real no era el que estimé: 30 de los
41 usan `cop` desde helpers de módulo o desde subcomponentes —`pos`,
`restaurante`, `pacientes` y `flota` tienen siete u ocho cada uno—, así que no
basta un hook, hay que enhebrar el formateador por toda la pantalla.

Y lo que se compraría con eso es un símbolo correcto para un mercado que el
producto no puede servir. Medido: **67 archivos fijan `es-CO`**, 25 tocan
DIAN/CUFE/UBL, 17 rotulan NIT, 14 Wompi, 5 nómina colombiana, y las tasas de IVA
de la mig 104 son las de Colombia. Arreglar el símbolo dejaría el producto
*pareciendo* portable y siendo colombiano — la misma clase de promesa falsa que
el FAQ del primer commit.

Un ajuste ofrecido que no hace nada tiene dos salidas: hacerlo funcionar, o
dejar de ofrecerlo. Se toma la segunda.

- Fuera el selector de moneda del onboarding. `organizations.currency` se
  conserva guardando COP, lista para el día en que internacionalizar sea una
  decisión de verdad.
- **El país se sigue preguntando**: de él sale `timezone`, y eso funciona desde
  que se corrigió el corte de día por UTC. Borrarlo habría sido tomar la
  decisión de mercado por el dueño, que no me toca.
- Nota honesta al elegir un país distinto de Colombia, en el onboarding y no en
  la letra pequeña: nómina, DIAN e importes son colombianos; el resto sirve.

**Bug encontrado de paso:** `mutations/dian.ts` pasaba `org.country` como
`organizationCity`, así que el `<cbc:CityName>` del XML salía con un código de
país. No rompe nada hoy (el UBL es de demostración y su archivo lo declara),
pero es un campo mapeado al dato equivocado y sobreviviría intacto hasta el
proveedor homologado. Puesto el mismo marcador que ya llevaba la dirección de al
lado: falta el dato y se dice, en vez de rellenarlo con otro. Producción exige
añadir ciudad y dirección a `organizations`.

### Fase 6 — limpieza, y tres ítems que no lo eran

De los cuatro que mi propia auditoría listó aquí, **solo uno era limpieza**. Los
otros tres se cierran sin tocar código, que es el resultado honesto: cambiarlos
habría sido churn para parecer productivo.

**`daysUntil` ×6 → 2. Era real.** Tres formas y dos respuestas distintas para la
misma fecha: `socios`/`odontologia` recibían el «hoy» por parámetro (bien);
`contratos`/`notif-panel` usaban `new Date()` del **servidor**, o sea UTC — un
contrato que vence mañana se leía «vence hoy» desde las 19:00 en Bogotá;
`capacitacion`/`flota` usaban `new Date()` del **navegador**, así que servidor y
cliente podían discrepar sobre la misma fecha.

Ahora una sola en `lib/domain.ts`, con el «hoy» siempre por parámetro — es lo
que obliga a quien llama a decidir de qué huso habla en vez de heredar el de la
máquina que ejecuta. `MemberContext` lleva `timezone` (un campo, no un
formateador: por eso sí salía a cuenta y la moneda no). `soonestDoc` en flota
pasó a recibir el hoy, porque es de módulo. Devuelve `null` en vez de `NaN` para
entrada inválida — las seis anteriores renderizaban «Vence en NaN d».

`notif-panel` **no se fusiona**, y queda escrito por qué: redondea hacia arriba,
acota en cero y su columna `when` mezcla `timestamptz`
(`patient_appointments.scheduled_for`) con `date` (`due_on`, `next_charge_on`).
Para una cita de hoy a las 15:00, `ceil` da 1 y la pantalla dice «en 1 día» de
algo que es hoy. **Eso es un bug abierto**, pero arreglarlo cambia lo que el
usuario lee, así que es decisión de producto y se anota. Lo que sí se corrigió
es su «hoy», que ya sale de la zona de la empresa.

**`sector_modules` doble fuente — NO es un defecto.** Es una cadena de respaldo
deliberada (DB → `COMPANY_TYPES` → `MANUAL_START`), documentada en
`lib/sectors.ts`, y con motivo: la página de registro previsualiza un sector
*antes de que haya sesión con la que consultar la tabla*. Y el drift ya está
pineado — `sectors.test.ts:72` «the presets in the database are the presets in
TypeScript» parsea las migraciones y compara ambos lados. Quitar el respaldo
dejaría el sector en `MANUAL_START` si faltara una fila: menos correcto, no más.

**`plan_limits.seats` — NO es un defecto.** La asimetría está razonada en
`plans.ts`: `maxCompanies` lo impone la base porque una empresa es un objeto que
se cobra y la fila no debería existir; los asientos se quedan en aplicación
porque solo un administrador escribe invitaciones, así que pasarse es una
discrepancia de facturación. Añadir la columna sin trigger que la imponga
crearía exactamente lo que la fase 5 acaba de quitar: una columna muerta.

**Service worker — no es limpieza, es una función.** El POS offline es real en
datos (IndexedDB + idempotencia por `client_uuid`) y ficticio en aplicación: sin
service worker el navegador no carga el bundle sin red. Construirlo es trabajo
de producto, no de limpieza, y sigue en la deuda abierta.

### Fase 7 — lint en verde, y dos hallazgos que el lint tapaba

`npm run lint` era el único rojo: 4 errores y 24 avisos. Se cierra entero, pero
el resultado que importa no es el cero — son las dos cosas que estaban dentro.

**Bug real: editar un proveedor escribía la entrada sin validar.**
`updateProveedor` hacía `const parsed = proveedorSchema.parse(rest)` y después
escribía `rest.*`. Solo el aviso «`parsed` asignado y nunca usado» lo delataba.
`createProveedor` sí escribe `parsed`, así que las dos mitades del mismo
formulario guardaban distinto: al crear se recortan espacios, el correo baja a
minúsculas y los opcionales vacíos se rellenan; al editar, nada de eso. Un
proveedor guardado como « Acme » conservaba el espacio, y el índice único de
nombre por empresa no lo veía como duplicado de «Acme».

**El candado del replay del POS no era candado.** `replayOutbox` se protegía
con `if (outboxRunning) return` sobre una variable de estado: dos llamadas en el
mismo tick leen el mismo `false` y entran las dos. Ahora el cerrojo es una ref y
el estado se conserva solo para lo que sirve — deshabilitar los botones.

Lo demás, por qué se hizo así:

- **`use-focus-trap`** escribía `onEscapeRef.current` durante el render. La
  asignación pasa a un efecto: el único lector es el listener de teclado, que no
  existe hasta después del commit.
- **`DocumentPreview`** reseteaba tres `useState` dentro del efecto al cambiar
  de documento, o sea un fotograma con la vista previa del archivo anterior. Las
  tres piezas pasan a un solo estado etiquetado con el id del documento del que
  hablan, y «esto todavía no es de este documento» se deriva en el render.
- **POS `online`** salía de un `useState(true)` que un efecto corregía al
  montar: el primer fotograma decía «en línea» aunque no lo hubiera. Pasa a
  `useSyncExternalStore`. El auto-replay cuelga ahora del evento `online` y no
  de un efecto sobre el booleano — es el mismo momento exacto, porque el efecto
  anterior solo disparaba en el flanco false→true (al montar, `outboxCount`
  todavía es 0 y salía por la guardia).
- **`hoy` faltaba en dos `useMemo`** (`capacitacion`, `flota`), herencia del
  refactor de `daysUntil`: con la pestaña abierta pasada la medianoche, los KPIs
  de «vence pronto» se quedaban en el día anterior.
- **`clientResult`** en `mutations/dian.ts` era un `Promise.resolve(null)`
  dentro del `Promise.all` — el receptor no cabe ahí porque su id sale de la
  propia factura. Fuera el hueco, y escrito por qué se pide después.
- **`pct`** en `mutations/nomina.ts` era un helper muerto: clampaba a 0–10000
  mientras el esquema Zod valida 0–100. Nada regulatorio se tocó.
- **Once `const member = await requirePermission(…)`** sin usar `member`. Se
  deja `await requirePermission(…)`: la guardia es la llamada. Verificado antes
  de tocarlas que ninguna necesitaba `member.orgId` — todas escriben en tablas
  hijas donde `apply_child_rls` decide por el padre.
- **`argsIgnorePattern: '^_'`** en `eslint.config.mjs`. `parse(rawBody, _headers)`
  cumple una firma; sin la regla, la única salida era borrar el nombre y perder
  la documentación de qué recibe la función.
- **Dos `<img>`** de iconos SVG locales de tamaño fijo, con la razón escrita al
  lado: `next/image` no optimiza SVG y exigiría `dangerouslyAllowSVG`.

**El e2e no es flaky por el servidor: es el límite de intentos de login.**
Durante la verificación, la suite falló dos veces con specs distintos
(`company-switch` una, `marketing` y `nomina` otra) y pasó 6/6 la tercera. El
spec que fallaba, corrido solo, pasa en 8s. `RATE_LIMITS.login` son **10
intentos por 300 s**, por dirección y por correo, y la suite hace **6 logins con
el mismo usuario demo**. Dos corridas dentro de la misma ventana de cinco
minutos son 12 y las últimas specs se quedan en `/login`. Ver §6.

### Revisión de `docs/ARQUITECTURA_ACTUAL.md` (2026-08-21)

El archivo apareció sin trackear al inicio de la jornada y no lo escribió esta
sesión. Se revisó entero contra la base remota, no solo contra los archivos.

**Su calidad es alta.** Se extrajeron los 198 nombres de tabla de su §7 y se
compararon con `pg_tables`: **cero inventados**. Los 23 sectores y 84
subsectores, correctos uno por uno. El conteo del registro, correcto.

Estaba al día hasta la migración 96 — actualizado a 104, con la capa de
suspensión, el libro de inventario, el IVA y el embudo relacional.

**Tres cosas que señalaba y estaban sin arreglar, corregidas al verificarlas:**

1. **JSON-LD con `price: '0'`** en `app/layout.tsx`, diciéndole a buscadores y
   rastreadores de IA que Kigyo es gratis mientras `/pricing` cobra desde
   $80.000. Es la afirmación falsa dicha donde más se propaga y donde menos se
   revisa, porque no se ve en pantalla. Ahora `AggregateOffer` con `lowPrice`
   derivado de `lib/pricing.ts` —la misma fuente que dibuja las tarjetas— y
   pineado en `plans.test.ts`.
2. **Wompi**: `integraciones.ts` guardaba `config: { publicKey }` y los dos
   lectores del POS leían `public_key`. La llave recién guardada no se
   encontraba nunca. Enmascarado porque el modo simulado no la consulta: el
   fallo esperaba al día de `WOMPI_REAL=true`. Corregidos los lectores; no hubo
   dato que migrar.
3. **IA y export sin gate de módulo**: `buildTools()` y `/api/v1/export`
   comprobaban permiso pero no `member.modules`. Como `role_permissions` no se
   toca al apagar un módulo, una empresa que apagaba Inventario lo veía salir
   del menú y seguía pudiendo preguntarle sus existencias al asistente y
   exportarlas. Corregidos, y pineado en `guards.test.ts`.

**Un falso positivo peligroso, marcado como tal en el propio doc:** decía que
`polarProvider()` re-encodea mal el secreto, severidad Alta. El SDK de Polar
hace exactamente lo mismo (`webhooks.ts:140-141`). Actuar sobre ese punto
rompería la verificación de webhooks de facturación. Se dejó escrito en vez de
borrarlo, para que nadie lo «arregle» leyendo una versión anterior.

**Un artefacto:** su «el workspace no pasa typecheck» era un scratch temporal de
la auditoría que corría en paralelo. Lo que sí sigue en rojo es `npm run lint`.

### Deuda abierta que salió de la auditoría

1. ~~**Moneda.**~~ RESUELTO en fase 5: se retiró el selector. Queda como deuda
   real, para el día que se internacionalice de verdad: cablear
   `organizations.currency` hasta el formateo cuesta 41 archivos, 30 de ellos con
   `cop` en helpers de módulo o subcomponentes. Y antes que eso están los 67
   archivos con `es-CO`, la nómina colombiana, DIAN y PILA — la moneda es lo
   último que haría falta, no lo primero.
2. **Cobertura e2e.** 5 specs para 62 páginas. Ninguna cubre el onboarding, que
   es donde estaba el bloqueante.
3. ~~**`daysUntil` ×6**~~ RESUELTO en fase 6: una sola en `lib/domain.ts`, con
   el «hoy» por parámetro. Queda `notif-panel` aparte a propósito, y con un bug
   abierto suyo: mezcla `timestamptz` y `date` en la misma columna, así que una
   cita de hoy a las 15:00 se anuncia «en 1 día». Arreglarlo cambia lo que el
   usuario lee — decisión de producto.
4. **Botones muertos** en Configuración: «Cambiar foto» y «Cambiar logo»
   responden «próximamente».
5. ~~**Doc drift**~~ corregido en la primera jornada.

6. **`sector_modules` y `plan_limits.seats` estaban mal listados como deuda.**
   Los dos son decisiones documentadas y, en el primer caso, con test que pinea
   el drift. La auditoría los llamó problemas y no lo son — anotado aquí para
   que nadie los «arregle» leyendo solo aquella lista.

7. **Service worker.** Sin él, «POS offline» es cierto en datos y falso en
   aplicación: la cola sobrevive, pero el navegador no carga el bundle sin red.
   Es función, no limpieza.

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
- **El login tiene límite de intentos y la suite lo agota.**
  `RATE_LIMITS.login` = 10 intentos por 300 s, contados por dirección **y** por
  correo. La suite hace 6 logins con el mismo usuario demo, así que una corrida
  sola cabe (6 ≤ 10) y **dos dentro de la misma ventana de cinco minutos no**
  (12 > 10). Las últimas specs se quedan en `/login` y falla
  `expect(page).not.toHaveURL(/\/login/)`. La firma que lo distingue del
  servidor degradado: los tiempos son normales (~2,2 min) y **las specs que
  fallan cambian de una corrida a otra**; la que falló, corrida sola, pasa en
  8 s. No se toca el límite —es una defensa real— se espera cinco minutos.
- **Nunca dos `npx playwright test` a la vez**, ni aunque cada uno lleve
  `workers: 1`: son dos procesos contra el mismo usuario, la misma empresa y la
  misma base. Pasó dos veces en la jornada del 21 y las dos se leyó como
  regresión: la primera dejó a `embudo` en la pantalla de login, la segunda
  tumbó `company-switch`. La señal para reconocerlo es el tiempo — la suite
  entera tarda ~2,3 min; si un archivo solo marca «Slow test file: 11.9m», hay
  otra corrida compitiendo.
- **El dev server se degrada en sesiones largas.** Tras ~100 recompilaciones HMR
  la suite pasó de 2,3 min a 16,8 y cayeron specs que no tocaban lo cambiado
  (`nomina` 34s → 15,1m, con 0% de CPU en el proceso). Reiniciarlo lo devuelve a
  la normalidad. Antes de investigar un fallo de e2e por lentitud, mirar cuánto
  lleva vivo el servidor.
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
| `docs/ARQUITECTURA_ACTUAL.md` | mapa técnico del sistema. Revisado y verificado contra la base remota el 2026-08-21; su §20 registra qué se comprobó, qué estaba mal y qué sigue abierto |
| `docs/SETUP.md` | puesta en marcha (citado por README y código) |
| `docs/CONTEXTO_SESION.md` | este archivo — único archivo de sesión |
| ~~`docs/PLAN_CRM_ERP_POS.md`~~ | absorbido aquí (18/18 ejecutado) — eliminado |

## 11. Prompt para retomar

```
Retoma Kigyo. Lee docs/CONTEXTO_SESION.md (maestro) y docs/ARQUITECTURA_ACTUAL.md
(mapa técnico, revisado y verificado contra la base remota el 2026-08-21; su §20
dice qué se comprobó y qué salió mal).

ESTADO
tsc 0 · vitest 290/290 · build verde · e2e 6/6 (workers: 1 SIEMPRE)
Migraciones 1–104 aplicadas en remota. Base casi vacía (1 producto, 0 sucursales).
Working tree limpio, 0 residuos E2E. Único rojo: npm run lint → 4 errores,
24 avisos (casi todo no-unused-vars sobre `member`/`parsed`).

QUÉ SE HIZO (auditoría + 6 fases de reparación, commits 862c28f…b185faf)
Bloqueantes cerrados: onboarding fallaba en 23/23 sectores en Starter · «Ventas
de hoy» mostraba 100× · «hoy» era UTC en ~30 sitios · 4 afirmaciones falsas en
el FAQ y una en el JSON-LD · un módulo nuevo no llegaba a las empresas
existentes · pedidos y contabilidad estaban en Enterprise por descuido · el
módulo Pedidos nunca funcionó desde la UI (subconsulta imposible en PostgREST) ·
la suspensión por impago era un banner · el inventario era un entero editable
sin libro · facturar a precio de góndola cobraba 19% de más · la llave de Wompi
se guardaba y se leía con nombres distintos · la IA y el export ignoraban el
apagado de módulos.

REGLAS VINCULANTES
- org_id = empresa, nunca company_id, nunca tabla companies.
- app.orgs_with / apply_standard_rls / apply_child_rls: CONGELADAS.
- products.price_cents es precio CON IVA. El POS extrae, la factura convierte.
  pos_sales NO cumple total = subtotal + tax, y es deliberado.
- products.stock es DERIVADA. Todo movimiento entra por inventory_movements.
- Mutations 'use server', nunca 'server-only'.
- Ruta nueva exige entrada en ROUTE_MAP. Query nueva exige scoped() o .eq(org_id).
- Módulo nuevo: registry.ts es la fuente; el resto se deriva.
- Nómina y DIAN: NO inventar cifras regulatorias.
- Supabase MCP apunta a otro proyecto: todo por psql con SUPABASE_DB_URL.
- Migración nueva: validarla primero dentro de `begin; … rollback;`.
- NO lanzar dos `npx playwright test` a la vez, ni con workers:1.
- No crear .md nuevos: actualizar CONTEXTO_SESION.md.

PENDIENTE, TODO EXTERNO
1. Nómina: validación de contador laboral colombiano. Parámetros en cero por
   diseño; hay banner cuando minWage=0.
2. Polar: crear cuenta, 4 productos y token; pegar 6 vars en .env.local.
3. DIAN producción: proveedor homologado, certificado XAdES-EPES, revisor
   fiscal, y añadir ciudad y dirección a organizations.
4. Wompi: llaves reales (hoy WOMPI_REAL !== 'true').
5. Marketing: proveedor de delivery receipts.

DEUDA TÉCNICA PRIORIZADA
1. Cobertura e2e: 6 specs para 62 pantallas. Es el riesgo meta — el bloqueante
   de onboarding vivía en ese hueco con todo verde.
2. ~~lint en rojo~~ RESUELTO en fase 7: 0 errores, 0 avisos.
3. Service worker: sin él el POS offline es cierto en datos y falso en app.
4. notif-panel mezcla timestamptz y date: una cita de hoy a las 15:00 dice
   «en 1 día». Cambiarlo cambia lo que el usuario lee.
5. Inventario sin decimales; validación de stock por sucursal llega tarde.
6. Moneda: si algún día se internacionaliza, cablear organizations.currency
   cuesta 41 archivos (30 con cop en helpers de módulo). Antes están los 67
   archivos con es-CO, la nómina colombiana, DIAN y PILA.

Modo caveman ultra.
```
