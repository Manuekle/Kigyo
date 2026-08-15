# Plan — Cierre de brechas CRM / ERP / POS

Estado: en ejecución. Fecha: 2026-08-14.
Base: auditoría contra la matriz clásica CRM/ERP/POS (ver `REVISION_MULTIEMPRESA_2026-08.md` para el estado del multiempresa).

## Estado de ejecución

| # | Entregable | Estado |
|---|---|---|
| 1 | AR aging (2.2) | ✅ hecho — panel en Facturación, derivado de `invoices` |
| 2 | Barcode (3.1) | ✅ hecho — `products.barcode` (mig. 73) + escáner por teclado en POS |
| 3 | Recibo (3.2) | ✅ hecho — impresión 80/58mm + reimpresión + prefs por empresa (mig. 74) |
| 4 | Leads (1.1) | ✅ hecho — módulo completo con conversión RPC (mig. 75) |
| 5 | Etapas pipeline (1.2) | ✅ hecho — `pipeline_stages` + kanban en cotizaciones (mig. 76) |
| 6 | CxP calendario (2.3) | ✅ hecho — `supplier_payments` + RPC con cierre automático (mig. 77, 81) |
| 7 | Contabilidad (2.1+2.4) | ✅ hecho — PUC, asientos, mayor, P&G/Balance/Flujo, auto-asientos (mig. 79-82) |
| 8 | Tickets cliente (1.3 p1) | ✅ hecho — `client_id` + `origin` + ficha enlazada (mig. 78) |
| 9 | Pagos proveedor (3.3) | ✅ hecho — decisión de pricing: **Enterprise** (capability). Venta Pendiente + intent Wompi QR + webhook firmado idempotente (mig. 83-85). Falta probar en vivo con llaves de Wompi |
| 10 | RAG documental (7) | ✅ hecho — chunking, ingestión, embeddings (Azure `text-embedding-3-small`, mig. 86 aplicada), pgvector, retrieval local, citas, presupuesto y botón Indexar en documentos. Bucle real probado con documento en remoto |

Lo que queda: probar el loop de 3.3 con llaves reales de Wompi (sandbox
primero), pedidos B2B, directorio de proveedores, nómina legal, portal público,
marketing automation, DIAN y POS multi-sucursal/offline.

---

## 1) Objetivo

Kigyo ya cubre ~60-70% de cada uno de los tres sistemas. Este plan cierra lo que falta,
en el orden que maximiza valor por fase y respeta las reglas de arquitectura existentes:

- Registro (`src/lib/modules/registry.ts`) es la única fuente de verdad de módulos.
  Todo lo demás (NAV, permisos, SQL) se deriva y se pina con tests.
- Tablas nuevas con `org_id`, RLS con `app.apply_standard_rls` / `app.apply_child_rls` (congelados).
- El plan de precios (`lib/plans.ts`) es un gate más: cada módulo nuevo declara en qué tier vive.
- Cada módulo nuevo = entrada en registry + ruta + queries + mutations + migración
  (generada con `npm run db:module-sql`) + tests de catálogo.

## 2) Reglas de alcance

1. **No se construye una suite enterprise completa.** Se construye un MVP usable por
   una pyme colombiana y se dejan capacidades regulatorias o de escala como fases
   separadas, con sus propias pruebas y validaciones.
2. **Facturación electrónica DIAN es una fase separada.** La factura actual es un
   documento interno con pagos. DIAN requiere proveedor, resolución, eventos y CUDE;
   queda especificada en Fase 6.3, no mezclada con facturación base.
3. **Hardware POS = first-party barato primero**: lector de código de barras por
   teclado (keyboard wedge) y impresora térmica vía diálogo de impresión del navegador.
   Integraciones de pago (QR/tarjeta) por seam de proveedor, no acopladas.
4. Cada fase entrega valor independiente y desplegable por separado.

## 3) Diagnóstico resumido

| Área | Hoy | Brecha |
|---|---|---|
| CRM | clientes, interacciones, leads, cotizaciones, pipeline, tickets internos | portal público, marketing automation |
| ERP | inventario, compras, producción, RRHH, nómina, proyectos, caja, contabilidad, reportes | pedidos B2B, directorio de proveedores, nómina legal colombiana, DIAN |
| POS | venta, cobro, arqueo, stock, barcode, recibo, intent QR/tarjeta | prueba real de proveedor, multi-sucursal y offline |
| IA documental | Foundry IQ opcional, citas y uso básico por conversación | chunks propios, embeddings, pgvector, búsqueda híbrida, presupuestos y reindexación |

---

## Fase 1 — CRM comercial (leads, oportunidades, portal de cliente)

### 1.1 Módulo `leads` (seguimiento de prospectos)

**Tabla `public.leads`** (org_id):
- `name`, `company_name`, `email`, `phone`, `source` (Referido, Web, Campaña, Llamada, Otro),
  `stage` (Nuevo, Contactado, Calificado, Perdido, Convertido), `owner_id` → `memberships`,
  `lost_reason`, `notes`, timestamps.
- RLS estándar + índice por `(org_id, stage)`.

**Tabla `public.lead_activities`** (org_id): llamadas/notas/agenda por lead.

**Convertir lead → cliente**: mutation que crea fila en `clients` y copia datos de
contacto; el lead queda `Convertido` con referencia al cliente creado. Unidireccional
y auditable (`trazabilidad` lo registra si está activo).

**Registry**: grupo `Comercial`, acciones `read|write`, ruta `/dashboard/leads`.
**Plan**: Growth (misma lógica que `cotizaciones`: pipeline comercial es de tier operativo).
**Dependencias**: ninguna dura. Soft: `clientes` (convertir exige el directorio).

### 1.2 Oportunidades — decisión de diseño

No se crea tabla nueva. Se extiende `cotizaciones` con **etapas configurables**:

- Tabla `public.pipeline_stages` (org_id, name, position, active) sembrada con
  (Prospección, Propuesta, Negociación, Cerrado).
- `quotes` gana `stage_id` nullable; los estados actuales (`Borrador/Enviada/…`)
  se mantienen como estado del *documento* y la etapa como estado del *trato*.
  Son dos preguntas distintas y ya se contestan mal juntas.
- Vista kanban en `cotizaciones`; total por etapa en el header del módulo.

Esto evita la entidad duplicada oportunidad/cotización que en pymes es la misma cosa
con dos nombres. Cotizaciones existentes reciben la primera etapa activa mediante
migración; no se permite dejar `stage_id` nulo después del backfill.

### 1.3 Portal de cliente (tickets externos)

Los `tickets` actuales son help desk interno (áreas TI/Nómina/Personas/Legal).
Extensión en dos pasos:

1. **Paso barato**: campo `client_id` nullable en `tickets` + origen
   (Interno / Cliente). Un ticket puede referenciar un cliente y aparecer en su ficha.
2. **Portal público** (fase posterior, decisión separada): ruta pública
   `/soporte/[token]` con lista y creación de tickets por token mágico por contacto.
   Requiere su propio análisis de abuso (rate limit, captcha) — no se compromete
   fecha en este plan.

**Marketing automation** (campañas de correo, automatizaciones): diferido a la
Fase 6. Es el gap más caro de cerrar bien (distribibilidad, opt-out, anti-spam,
métricas), por eso depende de medir uso real de `leads`.

---

## Fase 2 — ERP financiero (contabilidad, cartera, pagos, reportes)

### 2.1 Módulo `contabilidad`

**Principio: partida doble sobre PUC colombiano, sin inventar el catálogo.**

Tablas (todas org_id, RLS estándar):

- `public.gl_accounts`: código PUC (ej. `1105`), nombre, naturaleza (Débito/Crédito),
  tipo (Activo, Pasivo, Patrimonio, Ingresos, Gastos, Costos), `parent_code` para
  jerarquía, `is_active`. Se siembra con el plan de cuentas básico PUC (las ~80
  cuentas que una pyme usa; el catálogo completo es data, no migración).
- `public.journal_entries`: `entry_date`, `memo`, `source` (Manual, Venta, Compra,
  Nómina, Caja), `source_id`, `status` (Borrador, Publicado), posted_at.
  `source` + `source_id` permiten que facturas y órdenes generen asientos sin
  duplicar la verdad: el asiento es derivado y reconstruible.
- `public.journal_lines`: `entry_id`, `account_id`, `debit_cents`, `credit_cents`.

**Reglas duras (en DB, trigger)**: asiento publicado es inmutable; suma débitos =
suma créditos por asiento; borrar línea rechazado si el asiento está publicado.

**Integración automática**: cuando `contabilidad` está activo, los mutations de
`facturacion` (venta a crédito/cobro), `compras` (factura de proveedor) y `caja`
(cierre con diferencia) generan asientos `source` automáticos con mapeo fijo de
cuentas (ventas → 4135, clientes → 1305, proveedores → 2205, caja → 1105, banco → 1110).
El mapeo vive en `public.org_account_mappings` (org_id, concepto, account_id) para
que el contador lo ajuste sin deploy.

**Registry**: grupo `Comercial` (la contabilidad es el lenguaje del área financiera;
discutir si prefiere `Operación`), acciones `read|write`, ruta `/dashboard/contabilidad`.
**Plan**: Enterprise. La contabilidad formal es la razón de mover de tier.
**Dependencias**: dura ninguna; soft `facturacion`, `compras`, `nomina` (sin ellas el
módulo funciona pero registra menos).

### 2.2 Antigüedad de cartera (AR aging)

Sin tablas nuevas. Query derivada sobre `invoices` (ya guarda `total_cents`,
`paid_cents`, `issued_on`, `due_on`): buckets corriente / 1-30 / 31-60 / 61-90 / +90
por cliente y total. Panel en `facturacion` con drill-in por bucket. Export CSV/Excel
por el seam existente (`useExport`).

### 2.3 Cuentas por pagar: calendario de pagos

`supplier_invoices` ya existe. Se agrega:

- `public.supplier_payments` (org_id): `supplier_invoice_id`, `amount_cents`,
  `method`, `reference`, `paid_on`, `scheduled_on` (para pagos programados a futuro).

Vista en `compras`: por pagar por proveedor, vencimientos próximos, pagos programados
de la semana. No se toca `compras` más allá de eso.

### 2.4 Reportes financieros

Derivados del mayor, sin tablas:

- **P&G simple** (ingresos − costos − gastos, mes a mes, por centro opcional).
- **Balance** (saldos por tipo de cuenta a una fecha).
- **Flujo de caja efectivo** (ya semi-existe en `caja`; se conecta con el mayor).

Ruta: pestañas dentro de `contabilidad`. Export PDF/Excel. La condición es que todo
cuadre contra la suma del mayor — el test de aceptación es aritmético, no visual.

---

## Fase 3 — POS de mostrador completo

Todo dentro del módulo `pos` existente. Sin módulos nuevos.

### 3.1 Código de barras

1. `products.barcode` (texto, unique por org, índice).
2. Campo en el formulario de `catalogos`; acepta EAN-13/EAN-8/Code128 sin validación
   dura de formato (los códigos internos son alfanuméricos y castigarlos no suma).
3. Input de captura en `pos/client.tsx`: foco permanente en el campo de búsqueda;
   un lector USB (keyboard wedge) teclea + Enter y agrega al carrito. Esto cubre el
   90% del caso físico sin librerías.
4. Escáner por cámara (opcional, posterior): librería tipo `@zxing/browser` solo en
   el POS, cargada dinámicamente para no engordar el bundle inicial.

### 3.2 Impresión de recibo

1. Plantilla de recibo de 80mm/58mm (HTML/CSS `@media print`, sin librerías):
   logo/nombre de la empresa, ítems, subtotal, descuento, total, medio de pago,
   cambio, y la referencia de la venta.
2. Al cobrar (`cobrarVenta` exitoso): acción "Imprimir recibo" + reimpresión desde
   el historial de ventas (la data ya vive en la fila de venta; recibo es una vista).
3. Configuración por empresa en Configuración → POS: ancho (80/58mm), texto del pie,
   mostrar logo. Guardado en la configuración de la organización, no tabla nueva si
   el seam de settings lo permite.

### 3.3 Pagos con tarjeta / QR — seam de proveedor

Problema real: integración de adquirente. Colombia → Wompi / MercadoPago / PayU.
Diseño:

1. **Tabla `public.payment_integrations`** (org_id): proveedor, credenciales cifradas
   (solo referencia; el secreto vive en el vault o Supabase secrets, nunca en la tabla
   en claro — ver riesgo en §5), estado, modo (test/producción).
2. **Edge function `pos-payment-intent`**: crea la intención de pago con el proveedor
   y devuelve QR/link; el POS lo muestra.
3. **Webhook entrante** (`pos-payment-webhook`, verify_jwt off + firma de proveedor):
   marca el pago, cierra la venta por el mismo camino que `cobrarVenta`.
   La venta NO se marca cobrada por sondeo del cliente; solo el webhook confirmado paga.
4. Sin integración configurada, el POS sigue exactamente como hoy (etiqueta "Tarjeta"
   manual). El seam es aditivo.

**Plan**: la integración de pagos es capability de Enterprise (o add-on comercial;
decisión de pricing pendiente — flag `❓`).

### 3.4 Operación en tienda física (offline-first) — explícitamente fuera

POS offline (PWA + cola de ventas) es el proyecto más caro del eje POS y hoy no hay
evidencia de demanda. Se documenta como candidato futuro, no como compromiso.

---

## Fase 4 — Brechas ERP pendientes

### 4.1 Pedidos B2B

`online_orders` cubre ecommerce público, no pedidos comerciales de clientes. Crear
módulo `pedidos` en `Comercial`:

- `public.sales_orders` (org_id): cliente, cotización origen, estado (Borrador,
  Confirmado, En preparación, Despachado, Entregado, Cancelado), fechas, totales,
  dirección y condiciones de pago.
- `public.sales_order_items`: producto, descripción, cantidad, precio, impuesto y
  subtotal.
- Conversión cotización aceptada → pedido; pedido → factura; no duplicar líneas sin
  guardar referencia de origen.
- Plan: Growth. Dependencias soft `clientes`, `cotizaciones`, `inventario` y
  `facturacion`.

### 4.2 Directorio de proveedores

Crear `public.suppliers` (org_id): razón social, identificación fiscal, contactos,
dirección, condiciones de pago, estado y notas. Agregar `supplier_id` nullable a
requisiciones, órdenes y `supplier_invoices`; conservar `supplier` textual para
histórico y migrar coincidencias exactas de forma revisable. No borrar texto histórico.

### 4.3 Nómina legal colombiana

Ampliar `nomina` sobre `payroll_periods` y `payroll_lines` existentes:

- conceptos salariales, novedades, deducciones, retención, seguridad social,
  prestaciones y aportes del empleador;
- reglas versionadas por periodo, parametrizadas por año;
- desprendible PDF, cierre de periodo e inmutabilidad posterior;
- exportes para PILA y contabilidad, sin prometer presentación automática ante operador.

Validación obligatoria con contador laboral colombiano antes de producción. Plan:
Enterprise o add-on regulatorio.

---

## Fase 5 — Consolidación (post-entrega)

1. Presets de sector revisados: `leads` entra al preset de `comercio`, `servicios`,
   `tecnologia`, `inmobiliario`, `medios`, `financiero`; `contabilidad` no entra a
   ningún preset (un contador la pide, no la propone el sector).
2. `SUBSECTOR_PRESETS` ajustado (ej. `comercio-retail` gana barcode en catálogos).
3. Matriz de la auditoría original re-evaluada y publicada en este doc.
4. Marketing automation: decidir construir/comprar/esperar con datos de uso de
   `leads`; si se construye, ejecutar MVP en Fase 6.1.

---

## Fase 6 — Extensiones diferidas, pero necesarias para matriz completa

### 6.1 Marketing automation

MVP después de medir `leads`:

- `campaigns`, `campaign_recipients`, `campaign_events` con consentimiento y opt-out;
- segmentos por etapa, fuente y actividad;
- plantillas, envío por proveedor externo, rebote, apertura, clic y auditoría;
- límites por plan, rate limit y suppression list global.

No enviar correo desde proceso web. Usar cola/Edge Function y proveedor transaccional.

### 6.2 Portal público de tickets

`/soporte/[token]` con token hash, expiración, revocación, rate limit, captcha,
consulta limitada al `client_id` y creación de respuestas. Nunca exponer `org_id`,
IDs internos ni datos de otros contactos. Requiere prueba de abuso antes de activar.

### 6.3 Facturación electrónica DIAN

Proyecto separado, dependiente de facturación y contabilidad:

- datos fiscales de empresa y resolución;
- proveedor tecnológico certificado o API homologada;
- XML, firma, CUFE/CUDE, envío, aceptación/rechazo, notas crédito/débito;
- reintentos idempotentes, representación gráfica y contingencia;
- almacenamiento de respuestas DIAN y auditoría inmutable.

No confundir factura interna actual con factura fiscal válida.

### 6.4 POS offline y sucursales

Antes de offline, implementar `sites`/sucursales como contexto operativo:
`site_id` en caja, POS, inventario, ventas y dispositivos. Después:

- PWA con catálogo sincronizado;
- cola local de ventas con UUID idempotente;
- resolución de conflictos y límite de inventario offline;
- sincronización de cierres por sucursal.

Offline no debe habilitarse sin prueba de doble venta, pérdida de red y recuperación.

---

## Fase 7 — RAG documental nativo

### 7.1 Estado actual y decisión

La IA ya consulta Foundry IQ cuando está configurado y guarda citas, pero Foundry IQ
es un servicio externo que debe indexarse aparte. El repositorio local todavía no
convierte archivos en unidades recuperables. La solución será híbrida:

- RAG nativo sobre `documents` como fuente principal cuando existan chunks;
- Foundry IQ como fallback para instalaciones que ya lo tengan configurado;
- datos operativos siempre mediante tools con RLS, nunca embebidos sin control.

### 7.2 Ingestión, extracción y chunking

Crear pipeline idempotente por documento:

1. leer archivo privado después de validar `documentos:read`;
2. extraer texto preservando título, página/sección y nombre del documento;
3. normalizar espacios, saltos y caracteres de control;
4. dividir en chunks de 800 tokens con solapamiento de 120;
5. guardar `content_hash`, `chunk_index`, `token_count` y versión del chunk;
6. generar embedding con deployment configurable;
7. marcar `ready`, `failed` o `stale` con error reintentable.

Primera entrega: TXT, CSV, Markdown y JSON. PDF, DOCX, XLSX e imágenes requieren
extractores/OCR separados; no se debe fingir que el modelo leyó un binario si no
hubo extracción real.

### 7.3 Almacenamiento y búsqueda vectorial

Habilitar `vector` en schema `extensions` y crear:

- `public.document_chunks` (org_id, document_id, chunk_index, content,
  embedding `extensions.vector(1536)`, embedding_model, token_count, content_hash,
  status, metadata, timestamps);
- índice HNSW con distancia coseno;
- RPC `match_document_chunks(query_embedding, p_org_id, threshold, count)` con
  filtro de organización dentro de la función y RLS invoker;
- índices B-tree para `org_id`, `document_id` y `status`.

El modelo de embeddings, dimensión y versión son configuración explícita. Cambiar
modelo obliga a re-embebido completo; nunca mezclar vectores de dimensiones distintas.

### 7.4 Retrieval y respuestas con citas

`/api/ai/chat` ejecuta:

1. búsqueda semántica nativa por `org_id`;
2. búsqueda lexical complementaria para códigos, nombres y fechas;
3. deduplicación por documento y selección de contexto dentro del presupuesto;
4. prompt con contexto delimitado y regla de no inventar;
5. citas con documento, chunk, nombre y fragmento verificable.

Si RAG nativo no tiene resultados, intenta Foundry IQ. Si ambas fuentes fallan,
la IA lo declara y responde solo con tools o reconoce falta de contexto.

### 7.5 Costos y límites

Crear:

- `public.ai_usage_events`: operación, modelo, tokens de entrada/salida/embedding,
  coste estimado, usuario, compañía, documento y metadata;
- `public.ai_monthly_budgets`: límite mensual por compañía, consumo reservado,
  periodo y modo (`soft`/`hard`).

Cada chat, revisión y lote de embeddings reserva coste antes de llamar al proveedor.
El límite duro rechaza la operación; el blando muestra advertencia. Cachear embeddings
por `content_hash + model + dimensions`; nunca cobrar dos veces el mismo chunk.

Tarifas viven en configuración del servidor, no en el navegador. El costo mostrado
es estimado y se conserva junto al evento para auditoría. `ai_messages.usage` sigue
siendo histórico de conversación; `ai_usage_events` es libro de costos.

### 7.6 Reindexación y ciclo de vida

- Crear/reemplazar archivo marca chunks `stale`.
- Borrar documento elimina chunks por cascade lógico o los marca `deleted` según
  retención configurada.
- Job reintentable procesa pendientes por lotes, con backoff y límite de concurrencia.
- Panel de Documentos muestra estado, fecha de indexación, chunks, errores y acción
  "Reindexar".
- Toda operación conserva `org_id`; ningún worker usa datos de otra compañía.

---

## 8) Trabajo transversal requerido por cada entrega

1. Actualizar `src/lib/plans.ts`, `public.plan_limits` y
   `src/app/pricing/PricingPlans.tsx` en el mismo cambio; no dejar pricing y gates
   desalineados.
2. Agregar herramientas o exclusiones explícitas en `src/lib/ai/tools.ts` para cada
   módulo nuevo; nunca permitir acceso IA por accidente.
3. Registrar tablas nuevas en `src/server/queries/audit.ts` y verificar exportes,
   notificaciones y trazabilidad.
4. Definir moneda, IVA y retenciones antes de asientos automáticos. `currency` y
   `tax_cents` existentes requieren cuentas fiscales y política de conversión; no
   asumir COP único sin decisión de producto.
5. Agregar cierre contable por periodo: periodo abierto/cerrado, fecha de cierre,
   reapertura solo con permiso de administrador y auditoría.
6. Migrar cotizaciones existentes a la primera etapa activa y probar backfill,
   rollback lógico y duplicados.
7. Diseñar `site_id` antes de convertir POS en operación multi-sucursal; un índice
   "un turno abierto" debe quedar limitado por empresa y sucursal.
8. Cubrir cada flujo crítico con Playwright en `e2e/`, además de tests unitarios,
   RLS, permisos, plan gate e idempotencia de webhooks.

## 9) Orden de ejecución y dependencias

```
Fase 1 (CRM)  ──independiente──► desplegable sola
Fase 2 (ERP)  ──independiente──► desplegable sola; 2.2 (aging) es quick win de 1 semana
Fase 3 (POS)  ──independiente──► 3.1 y 3.2 baratos; 3.3 (pagos) el más largo por proveedor
Fase 4 (ERP pendiente) ──depende de Fase 1/2──► pedidos, proveedores, nómina
Fase 5 (consolidación) ──depende de Fases 1-4──► presets, pricing, IA, auditoría
Fase 6 (extensiones) ──decisión y pruebas propias──► portal, marketing, DIAN, offline
Fase 7 (RAG) ──depende de Documentos + IA──► extracción, embeddings, retrieval, costos
```

Dentro de cada fase, orden por costo/beneficio:

| # | Entregable | Costo relativo | Notas |
|---|---|---|---|
| 1 | AR aging (2.2) | S | solo query + panel, sin migración |
| 2 | Barcode (3.1) | S | columna + índice + foco de input |
| 3 | Recibo (3.2) | S-M | plantilla print + settings |
| 4 | Leads (1.1) | M | 2 tablas + módulo completo |
| 5 | Etapas pipeline (1.2) | M | tabla + kanban + migración de estado |
| 6 | CxP calendario (2.3) | S-M | tabla + vista |
| 7 | Contabilidad (2.1 + 2.4) | L | el más grande; asientos automáticos detrás de flag |
| 8 | Pagos proveedor (3.3) | L | proveedor externo, webhook, cifrado |
| 9 | Tickets cliente (1.3 p1) | S | columna + vista en ficha |
| 10 | Pedidos B2B (4.1) | M | ✅ hecho — mig. 88 aplicada: `sales_orders` + `sales_order_items` con RLS `pedidos`, RPC `create_order_from_quote` (valida Aceptada, rechaza duplicados, copia líneas con `quote_item_id`), módulo `pedidos` en Comercial con página (estados, avance, cancelar, eliminar) |
| 11 | Directorio proveedores (4.2) | M | ✅ hecho — mig. 87 aplicada: `suppliers` + guardia de org, RLS inventario, página con deuda pendiente |
| 12 | Nómina legal (4.3) | L | reglas colombianas versionadas |
| 13 | Portal tickets (6.2) | M | ✅ hecho — mig. 89 aplicada: tokens por cliente (hash sha256, vence, revocable), rate limit 2s/120 lecturas/10 escrituras por hora, RPCs públicos anónimos (`/soporte/[token]`), botón en ficha de cliente. Sin captcha aún — decisión de activación pendiente |
| 14 | Marketing automation (6.1) | L | consentimiento, cola, proveedor externo |
| 15 | DIAN (6.3) | XL | proveedor fiscal y contingencia |
| 16 | Sites + POS offline (6.4) | XL | sincronización, conflictos, inventario |
| 17 | RAG documental (7) | L | chunks, pgvector, citas, presupuesto y reindexación |

## 10) Riesgos y decisiones abiertas

| Riesgo / decisión | Mitigación |
|---|---|
| Asientos automáticos descuadran con operaciones manuales del contador | Flag por concepto (`org_account_mappings` con `auto: bool`); el contador puede apagar la automatización y registrar a mano |
| Credenciales de pasarela en la DB | Solo referencias; secretos en vault. Revisión de seguridad del seam antes de producción |
| Webhook de pago falsificado | Verificación de firma del proveedor, idempotencia por `event_id`, y RLS: el webhook escribe por service role únicamente la fila de pago que le corresponde |
| Módulos nuevos hinchan el sidebar de sectores que no los usan | Presets conservadores (regla existente: "lean under"); `leads` solo donde se vende; `contabilidad` en ningún preset |
| `plan_limits` y `lib/plans.ts` divergen | Ambos lados se cambian en el mismo PR; `plans.test.ts` y el pin de `public.plan_limits` ya existen — extenderlos, no crear un tercero |
| DIAN diferida se convierte en promesa verbal | Este doc la mantiene como Fase 6.3 separada, con proveedor y alcance fiscal explícitos |
| ❓ Pricing de pasarela de pagos: Enterprise vs add-on | Decidir antes de iniciar 3.3; el código no cambia, el gate sí |
| ❓ Portal público de tickets (1.3 p2) | Decisiones de abuso/alcance pendientes; no comprometido |
| Nómina legal incorrecta | Validación con contador laboral y pruebas por año antes de producción |
| Proveedores históricos tienen nombres inconsistentes | `supplier_id` nullable, matching revisable y texto histórico preservado |
| IVA, retenciones y monedas descuadran mayor | Política fiscal y cuentas de impuestos aprobadas antes de auto-asientos |
| POS se usa en sucursales antes de `site_id` | Bloquear multi-sucursal hasta completar Fase 6.4 |
| Embeddings mezclan modelos o dimensiones | Guardar modelo/dimensión/version y forzar reindexación completa al cambiar |
| Búsqueda vectorial cruza compañías | RLS en `document_chunks` + filtro `org_id` dentro de RPC + prueba con compañía inexistente |
| Documentos binarios se presentan como leídos | Marcar extractor no soportado; revisar solo ficha hasta tener PDF/Office/OCR |
| Costos IA superan presupuesto | Reserva atómica mensual, límite hard, rate limit y cache por hash/modelo |

## 11) Criterios de aceptación por fase

**Fase 1**: un lead entra, se le registran actividades, se convierte en cliente y la
ficha del cliente muestra su origen; kanban de cotizaciones mueve etapa sin perder
estado documental; ticket con `client_id` visible en la ficha del cliente.

**Fase 2**: P&G y Balance cuadran contra la suma del mayor (test automático con datos
sembrados); asiento de venta automático se crea al cobrar una factura con
contabilidad activo; aging cuadra contra `total_cents - paid_cents` de invoices;
pago programado de proveedor aparece en vencimientos de la semana.

**Fase 3**: lector USB agrega ítem al carrito sin tocar el mouse; recibo imprime en
80mm y 58mm desde cobro y desde historial; venta con QR queda cobrada solo cuando
llega el webhook firmado (test con firma inválida rechazado); sin integración
configurada el POS no muestra nada nuevo.

**Fase 4**: cotización aceptada genera pedido sin duplicar líneas; pedido genera
factura y conserva referencias; proveedor queda seleccionado desde directorio o
texto histórico; nómina cerrada produce desprendible, PILA exportable y asiento
cuadrado para periodo aprobado.

**Fase 6**: campaña respeta consentimiento y opt-out; token de soporte no permite
cruzar clientes; documento DIAN conserva estados y respuestas idempotentes; POS
offline sincroniza una venta una sola vez después de recuperar red.

**Fase 7**: documento TXT/CSV/Markdown/JSON se divide en chunks reproducibles;
reindexar el mismo hash no duplica chunks; consulta devuelve solo contenido de la
compañía activa con cita verificable; cambio de modelo marca chunks stale; operación
sin presupuesto se rechaza antes de llamar al proveedor; costo queda en
`ai_usage_events`.

**Transversal**: `registry.test.ts`, `modules.test.ts`, `plans.test.ts`, pruebas RLS,
Playwright en `e2e/` y el pin SQL verdes; advisors de seguridad sin hallazgos nuevos;
cada módulo nuevo aparece en Configuración → Módulos, pricing, matriz de permisos,
IA y respeta plan/rol/enabled.
