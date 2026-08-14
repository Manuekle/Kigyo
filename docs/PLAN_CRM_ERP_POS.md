# Plan — Cierre de brechas CRM / ERP / POS

Estado: propuesta. Fecha: 2026-08-14.
Base: auditoría contra la matriz clásica CRM/ERP/POS (ver `REVISION_MULTIEMPRESA_2026-08.md` para el estado del multiempresa).

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

1. **No se construye un ERP contable completo ni un motor de marketing.** Se construye
   lo que una pyme colombiana usa a diario y se deja el resto como extensión futura.
2. **Facturación electrónica DIAN queda fuera** de este plan. La factura actual es un
   documento interno con pagos. La DIAN es un proyecto propio (proveedor, resolución,
   eventos, CUDE) que merece su plan aparte.
3. **Hardware POS = first-party barato primero**: lector de código de barras por
   teclado (keyboard wedge) y impresora térmica vía diálogo de impresión del navegador.
   Integraciones de pago (QR/tarjeta) por seam de proveedor, no acopladas.
4. Cada fase entrega valor independiente y desplegable por separado.

## 3) Diagnóstico resumido

| Área | Hoy | Brecha |
|---|---|---|
| CRM | clientes, interacciones, cotizaciones, tickets internos | leads, oportunidades como entidad, portal de cliente, marketing |
| ERP | inventario, compras, producción, RRHH, nómina (registro), proyectos, caja | contabilidad, antigüedad de cartera, calendario de pagos, reportes financieros |
| POS | venta de mostrador, cobro, arqueo, descuento de existencias | código de barras, impresión de recibo, pagos tarjeta/QR |

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
con dos nombres, y el 100% del valor del pipeline llega sin migración de datos.

### 1.3 Portal de cliente (tickets externos)

Los `tickets` actuales son help desk interno (áreas TI/Nómina/Personas/Legal).
Extensión en dos pasos:

1. **Paso barato**: campo `client_id` nullable en `tickets` + origen
   (Interno / Cliente). Un ticket puede referenciar un cliente y aparecer en su ficha.
2. **Portal público** (fase posterior, decisión separada): ruta pública
   `/soporte/[token]` con lista y creación de tickets por token mágico por contacto.
   Requiere su propio análisis de abuso (rate limit, captcha) — no se compromete
   fecha en este plan.

**Marketing automation** (campañas de correo, automatizaciones): **fuera de este
plan**. Es el gap más caro de cerrar bien (distribibilidad, opt-out, anti-spam,
métricas) y el que menos duele a corto plazo. Se reevalúa después de la Fase 3.

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

## Fase 4 — Consolidación (post-entrega)

1. Presets de sector revisados: `leads` entra al preset de `comercio`, `servicios`,
   `tecnologia`, `inmobiliario`, `medios`, `financiero`; `contabilidad` no entra a
   ningún preset (un contador la pide, no la propone el sector).
2. `SUBSECTOR_PRESETS` ajustado (ej. `comercio-retail` gana barcode en catálogos).
3. Matriz de la auditoría original re-evaluada y publicada en este doc.
4. Marketing automation: decisión explícita construir/comprar/esperar con datos de
   uso de `leads`.

---

## 4) Orden de ejecución y dependencias

```
Fase 1 (CRM)  ──independiente──► desplegable sola
Fase 2 (ERP)  ──independiente──► desplegable sola; 2.2 (aging) es quick win de 1 semana
Fase 3 (POS)  ──independiente──► 3.1 y 3.2 baratos; 3.3 (pagos) el más largo por proveedor
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

## 5) Riesgos y decisiones abiertas

| Riesgo / decisión | Mitigación |
|---|---|
| Asientos automáticos descuadran con operaciones manuales del contador | Flag por concepto (`org_account_mappings` con `auto: bool`); el contador puede apagar la automatización y registrar a mano |
| Credenciales de pasarela en la DB | Solo referencias; secretos en vault. Revisión de seguridad del seam antes de producción |
| Webhook de pago falsificado | Verificación de firma del proveedor, idempotencia por `event_id`, y RLS: el webhook escribe por service role únicamente la fila de pago que le corresponde |
| Módulos nuevos hinchan el sidebar de sectores que no los usan | Presets conservadores (regla existente: "lean under"); `leads` solo donde se vende; `contabilidad` en ningún preset |
| `plan_limits` y `lib/plans.ts` divergen | Ambos lados se cambian en el mismo PR; `plans.test.ts` y el pin de `public.plan_limits` ya existen — extenderlos, no crear un tercero |
| DIAN fuera de alcance se convierte en promesa verbal | Este doc lo dice explícitamente: NO está en este plan |
| ❓ Pricing de pasarela de pagos: Enterprise vs add-on | Decidir antes de iniciar 3.3; el código no cambia, el gate sí |
| ❓ Portal público de tickets (1.3 p2) | Decisiones de abuso/alcance pendientes; no comprometido |

## 6) Criterios de aceptación por fase

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

**Transversal**: `registry.test.ts`, `modules.test.ts`, `plans.test.ts` y el pin SQL
verdes; advisors de seguridad sin hallazgos nuevos; cada módulo nuevo aparece en
Configuración → Módulos, en la matriz de permisos y respeta plan/rol/enabled.
