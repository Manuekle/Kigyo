# Catálogo: los 23 sectores, sus 45 subsectores, y qué le falta a cada uno

Inventario generado desde el código, no de memoria: `COMPANY_TYPES` y
`SUBSECTOR_PRESETS` en `src/lib/modules.ts`, `REGISTRY` en
`src/lib/modules/registry.ts`, y las tablas de `supabase/migrations/`.

**Estado hoy:** 23 sectores · 45 subsectores · **35 módulos conmutables** ·
**6 verticales** (`pacientes`, `estudiantes`, `restaurante`, `agro`,
`inmobiliario`, `hoteleria`).

`ecommerce` figura como vertical en `COMPANY_TYPES` pero su módulo vive en el
grupo *Comercial* del registro, no en *Sectoriales*. Es una inconsistencia menor
y real: el sector Ecommerce no tiene pantalla propia de sector, tiene la pantalla
de pedidos en línea que cualquier comercio puede encender.

---

## 1. Tabla maestra

| # | Sector | Vertical | Subs. | Preset | Qué le falta |
|---|--------|----------|-------|--------|--------------|
| 1 | construccion | — | 4 | 19 | `obra`, `tiempos`, `reportes` |
| 2 | energia | — | 0 | 20 | `obra`, `reportes`, subsectores |
| 3 | manufactura | — | 4 | 19 | `calidad`, BOM en `produccion`, `reportes` |
| 4 | comercio | — | 5 | 15 | `pos`, `caja`, `marketing`, `reportes` |
| 5 | ecommerce | ecommerce* | 0 | 16 | `marketing`, `integraciones`, `notificaciones`, subsectores |
| 6 | servicios | — | 5 | 15 | `tiempos`, `cartera`, `reportes` |
| 7 | tecnologia | — | 0 | 15 | `tiempos`, `suscripciones`, subsectores |
| 8 | salud | pacientes | 6 | 17 | profundidad por subsector, `caja`, `portal`, `notificaciones` |
| 9 | educacion | estudiantes | 4 | 15 | notas y boletines, `portal`, `suscripciones`, `cartera` |
| 10 | logistica | — | 3 | 18 | `rutas`, `guias`, `portal` (rastreo) |
| 11 | alimentos | restaurante | 5 | 14 | `caja`, `pos`, escandallo, `marketing` |
| 12 | agro | agro | 4 | 18 | sanidad, riego, certificaciones |
| 13 | inmobiliario | inmobiliario | 3 | 15 | `ph`, `portal`, `cartera` |
| 14 | hoteleria | hoteleria | 4 | 14 | tarifas, canales de reserva, `caja` |
| 15 | financiero | — | 0 | 17 | `creditos`, `cartera`, subsectores |
| 16 | mineria | — | 0 | 18 | `obra`, producción mineral, subsectores |
| 17 | telecomunicaciones | — | 0 | 16 | `suscriptores`, subsectores |
| 18 | seguridad | — | 0 | 18 | `puestos`, subsectores |
| 19 | medios | — | 0 | 15 | `tiempos`, subsectores |
| 20 | ong | — | 0 | 14 | `donantes`, `reportes`, subsectores |
| 21 | gobierno | — | 0 | 15 | `contratacion`, PQRS, subsectores |
| 22 | otro | — | 0 | 10 | nada — es el caso "sin opinión" |
| 23 | fitness-bienestar | **socios** ✅ | 4 | 13 | `caja`, `suscripciones`, `marketing` |

**Once sectores no tienen subsectores:** energia, ecommerce, tecnologia,
financiero, mineria, telecomunicaciones, seguridad, medios, ong, gobierno y
otro. Cinco son grandes (financiero, minería, telecomunicaciones, seguridad,
medios) y `otro` no debería tenerlos nunca.

Verificado contra la base: los 23 sectores tienen preset en
`public.sector_modules`, y los 12 que tienen subsectores los tienen sembrados
con sus deltas. `fitness-bienestar` incluido — sus cuatro (gimnasio, estudio,
spa, centro) entraron en la migración 33. Lo que le falta a fitness no es
catálogo: es el módulo con el que se opera un gimnasio.

---

## 2. Módulos nuevos propuestos

### 2.1 Transversales — sirven a muchos sectores

| Clave | Qué es | Sectores | Tablas |
|---|---|---|---|
| ~~`caja`~~ ✅ | **Hecho** — migración 43: `cash_sessions` sale de restaurante y gana `cash_movements` | comercio, alimentos, salud, hoteleria, fitness | |
| ~~`pos`~~ ✅ | **Hecho** — migración 43: `pos_sales`, `pos_sale_items`, `register_pos_sale`, `void_pos_sale` | comercio, alimentos, salud-veterinaria, fitness-spa | |
| `reportes` | Reportes y exportes por módulo, guardables y programables | todos | `saved_reports` |
| `notificaciones` | Recordatorio de cita, de pago y de vencimiento. Email y WhatsApp | salud, educacion, fitness, inmobiliario, hoteleria | `notification_rules`, `notification_log` |
| `portal` | Portal externo del tercero: paciente, acudiente, inquilino, huésped | salud, educacion, inmobiliario, logistica | `portal_invites`, enlace público firmado |
| `marketing` | Campañas, fidelización, cupones, referidos | comercio, ecommerce, alimentos, salud, fitness | `campaigns`, `loyalty_points` |
| `integraciones` | Pasarela de pago, facturación electrónica, WhatsApp, contabilidad | todos | `integrations`, `integration_events` |
| `sucursales` | Pantalla real para `public.sites`, que hoy solo se toca en el asistente | todos | ninguna — la tabla existe (mig. 31) |
| `tiempos` | Horas facturables por persona, proyecto y tarifa | servicios, tecnologia, medios, legal | `time_entries` |
| ~~`suscripciones`~~ ✅ | **Hecho** — migración 48: `subscription_plans` y `subscriptions` con ciclo, renovación y precio por cliente | fitness, educacion, inmobiliario, tecnologia | |
| ~~`cartera`~~ ✅ | **Hecho** — migración 49: `receivable_agreements` sobre `invoices` | financiero, salud, educacion, servicios | |

### 2.2 Verticales nuevos — uno por sector que hoy no tiene

| Clave | Sector | Qué es | Tablas |
|---|---|---|---|
| ~~`socios`~~ ✅ | fitness-bienestar | **Hecho** — migración 42: `fitness_members`, `fitness_plans`, `fitness_subscriptions`, `fitness_classes`, `fitness_bookings`, `fitness_checkins` | |
| `obra` | construccion, energia, mineria | Presupuesto por capítulo y APU, avance, actas, cortes, bitácora | `budgets`, `budget_chapters`, `budget_items`, `progress_cuts`, `site_log` |
| `suscriptores` | telecomunicaciones | Planes, activaciones, suspensiones, consumo | `subscribers`, `service_plans`, `service_events` |
| `puestos` | seguridad | Puestos de servicio, turnos, rondas, minuta, dotación | `guard_posts`, `post_shifts`, `patrol_rounds`, `post_log` |
| `donantes` | ong | Donantes, donaciones, proyectos financiados, rendición | `donors`, `donations`, `grant_reports` |
| `creditos` | financiero | Colocación, amortización, desembolsos, mora | `loans`, `loan_installments`, `loan_payments` |
| `rutas` | logistica | Rutas, manifiestos, guías, prueba de entrega | `delivery_routes` **ya existe** (mig. 20) + `waybills`, `pods` |
| `ph` | inmobiliario | Propiedad horizontal: asambleas, cuotas, zonas comunes | `ph_assemblies`, `ph_fees`, `common_areas`, `area_bookings` |
| `calidad` | manufactura, alimentos, agro | Control de calidad, lotes, no conformidades | `quality_checks`, `nonconformities`, `batches` |
| `contratacion` | gobierno | Procesos, pliegos, oferentes, supervisión | `procurement_processes`, `bidders`, `supervision_reports` |

### 2.3 Profundidad dentro de un vertical existente

No son módulos: son pantallas dentro del módulo que ya existe, para que
`enabled_modules` no se llene de conmutadores que solo un subsector entiende.

| Vertical | Qué le falta |
|---|---|
| `pacientes` | ✅ odontograma, planes de tratamiento y laboratorio dental (migración 45). Faltan imágenes y teleconsulta |
| `estudiantes` | notas por periodo, boletín, horarios, biblioteca, transporte |
| `restaurante` | escandallo (`menu_item_ingredients` existe sin pantalla), delivery (`restaurant_deliveries` idem), propinas |
| `agro` | sanidad y fitosanitario, riego, clima, certificaciones (GlobalGAP) |
| `hoteleria` | tarifas por temporada, canales de reserva, housekeeping (`room_cleaning_tasks` existe sin pantalla) |
| `inmobiliario` | avalúos, mantenimiento por inmueble, liquidación al propietario |
| `produccion` | lista de materiales (BOM), órdenes por lote |

**Las tres tablas huérfanas ya tienen pantalla:** `delivery_routes` vive en el
módulo Flota (crear ruta, estado, borrado), `room_cleaning_tasks` en Hotelería
(crear tarea de limpieza) y `menu_item_ingredients` en Restaurante
(`agregarInsumo`/`eliminarInsumo`). El trabajo a medias quedó cerrado.

---

## 3. Sector por sector

Formato: preset actual → subsectores con su delta → qué falta.

### 1. construccion — Construcción e infraestructura
**Vertical:** ninguno. Vive en `proyectos`.
**Preset (19):** asistencia calendario canales clientes compras contratos cotizaciones documentos empleados facturacion firmas hseq ia inventario mantenimiento nomina proyectos riesgos tickets

| Subsector | Delta actual | Qué falta |
|---|---|---|
| civil | `+flota` | `obra`, `tiempos` |
| mep | `+catalogos` | `obra`, catálogo de APU |
| remodel | `+catalogos` `−hseq` | `obra` ligero, `cotizaciones` por ambiente |
| interv | `+trazabilidad` `−inventario,mantenimiento,compras` | `obra` en modo supervisión: actas, no conformidades |

**Falta:** `obra` (presupuesto APU, avance por capítulo, actas, cortes, bitácora),
`tiempos`, `reportes`.

### 2. energia — Energía y renovables
**Vertical:** ninguno. **Preset (20).** **Sin subsectores.**
**Faltan subsectores:** solar, eólica, eficiencia energética, O&M.
**Falta:** `obra`, `reportes`, y para O&M el `mantenimiento` con contratos de
disponibilidad.

### 3. manufactura — Manufactura y producción
**Vertical:** ninguno propio; usa `produccion`. **Preset (19).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| metal | `+proyectos` | BOM, `calidad` |
| plastico | `+trazabilidad` | BOM, `calidad`, merma por lote |
| textil | `+tienda` | BOM por talla y color, `calidad` |
| alimentos | `+trazabilidad` | `calidad`, lotes y vencimientos, HACCP |

**Falta:** `calidad`, lista de materiales dentro de `produccion`, `reportes`.

### 4. comercio — Comercio y retail
**Vertical:** ninguno. **Preset (15).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| retail | `−cotizaciones` | `pos`, `caja`, `marketing` |
| mayorista | `+contratos,flota` `−tienda` | listas de precio por cliente, cupo de crédito |
| ferreteria | `−tienda` | `pos`, unidades de medida, kits |
| farmacia | `+trazabilidad` `−cotizaciones` | `pos`, lotes y vencimientos, control de fórmulas |
| super | `+flota,mantenimiento` `−cotizaciones` | `pos`, balanza, mermas |

**Falta:** `pos` y `caja` son la ausencia grande — hoy un retail vende por
`tienda`, que es un catálogo web con carrito, no un mostrador.

### 5. ecommerce — Ecommerce y venta en línea
**Vertical:** `ecommerce` (en grupo Comercial). **Preset (16).** **Sin subsectores.**
**Faltan subsectores:** marketplace, tienda propia, dropshipping, suscripción.
**Falta:** `marketing` (cupones existen dentro de ecommerce; campañas no),
`integraciones` (pasarela, transportadora), `notificaciones` (estado del pedido).

### 6. servicios — Servicios profesionales
**Vertical:** ninguno. **Preset (15).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| consultoria | `+desempeno` | `tiempos`, rentabilidad por proyecto |
| contable | `+trazabilidad` `−proyectos` | `tiempos`, calendario tributario, `cartera` |
| legal | `+trazabilidad` | `tiempos`, expedientes y términos |
| agencia | `+desempeno,reclutamiento` | `tiempos`, piezas y aprobaciones |
| ti | `+inventario,desempeno` | `tiempos`, SLA por cliente, activos del cliente |

**Falta:** `tiempos` es la ausencia central — el preset dice literalmente «se
factura tiempo» y no hay dónde registrarlo.

### 7. tecnologia — Tecnología y software
**Vertical:** ninguno. **Preset (15).** **Sin subsectores.**
**Faltan subsectores:** producto SaaS, software a la medida, integrador.
**Falta:** `tiempos`, `suscripciones` (MRR, renovaciones, churn).

### 8. salud — Salud
**Vertical:** `pacientes`. **Preset (17).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| consultorio | `−hseq,riesgos,inventario,trazabilidad` | `caja`, `notificaciones`, `portal` |
| ips | `+mantenimiento,desempeno` | camas y urgencias, RIPS, autorizaciones de EPS |
| laboratorio | `+catalogos` `−consultoria` | órdenes y resultados, interfaz con equipos |
| **odontologia** | `+catalogos,cotizaciones` `−hseq,trazabilidad` | ✅ odontograma, plan por pieza, laboratorio dental (mig. 45). Faltan radiografías, consentimientos, teleodontología |
| estetica | `+catalogos,cotizaciones` `−hseq,riesgos,trazabilidad` | fichas de procedimiento, fotos antes/después, bonos |
| veterinaria | `+catalogos,tienda` `−consultoria,trazabilidad` | mascota vs. propietario, vacunas, peluquería, hospitalización |

**Falta transversal al sector:** `caja`, `portal` del paciente,
`notificaciones` de cita, `cartera` (copagos y EPS).

### 9. educacion — Educación
**Vertical:** `estudiantes`. **Preset (15).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| colegio | `+desempeno,reclutamiento` | boletín por periodo, horarios, convivencia, `portal` del acudiente |
| instituto | `+proyectos` | prácticas, certificados |
| academia | `−inventario,contratos` | `suscripciones` (mensualidad), niveles |
| universidad | `+proyectos,desempeno,reclutamiento,trazabilidad` | créditos, semestres, homologaciones |

**Falta transversal:** notas y boletines dentro de `estudiantes`, `portal`,
`suscripciones`, `cartera` (pensiones).

### 10. logistica — Logística y transporte
**Vertical:** ninguno. **Preset (18).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| carga | `+contratos` `−catalogos` | `rutas`, manifiestos, remesas |
| ultima | `+tienda,ecommerce` | `rutas`, prueba de entrega, `portal` de rastreo |
| bodegaje | `+contratos` `−flota` | ubicaciones, entradas y salidas, facturación por m³ |

**Falta:** `rutas` — y `public.delivery_routes` ya existe desde la migración 20
sin pantalla que la use.

### 11. alimentos — Restaurantes y alimentos
**Vertical:** `restaurante`. **Preset (14).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| salon | `+clientes` | `caja`, propinas, reservas (tabla existe) |
| rapida | `+tienda,ecommerce` | `pos`, pantalla de cocina, delivery (tabla existe) |
| bar | `+clientes` `−hseq` | `caja`, control de botella, happy hour |
| catering | `+clientes,cotizaciones,contratos,proyectos` | escandallo por evento, logística |
| panaderia | `+produccion` | escandallo, producción por lote, `pos` |

**Falta:** `caja` (extraerla de restaurante), `pos`, escandallo — la tabla
`menu_item_ingredients` existe y ninguna pantalla la usa.

### 12. agro — Agro y agroindustria
**Vertical:** `agro`. **Preset (18).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| permanente | `+trazabilidad` | sanidad, riego, certificaciones |
| transitorio | `+produccion` | plan de siembra, clima |
| ganaderia | `+produccion,trazabilidad` | inventario animal, sanidad, leche, potreros |
| poscosecha | `+produccion,catalogos,trazabilidad` | `calidad`, empaque, `pos` de acopio |

**Falta:** sanidad y fitosanitario, riego, certificaciones — todo dentro de `agro`.
La ganadería probablemente merece pantalla propia: un semoviente no es un lote.

### 13. inmobiliario — Inmobiliario
**Vertical:** `inmobiliario`. **Preset (15).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| arriendo | `−cotizaciones` | liquidación al propietario, `cartera`, `notificaciones` |
| **ph** | `+hseq,riesgos` `−cotizaciones` | `ph`: asambleas, cuotas, zonas comunes, reservas |
| corretaje | `+desempeno` `−mantenimiento` | captaciones, visitas, comisiones |

**Falta:** `ph`, `portal` del inquilino, `cartera`.

### 14. hoteleria — Hotelería y turismo
**Vertical:** `hoteleria`. **Preset (14).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| hotel | `+hseq` | tarifas por temporada, canales, housekeeping (tabla existe) |
| hostal | `−restaurante,mantenimiento` | camas por habitación compartida |
| finca | `+agro` | paquetes, actividades |
| operador | `+proyectos,cotizaciones,contratos` `−hoteleria,restaurante,inventario,mantenimiento` | itinerarios, cupos, proveedores |

**Falta:** tarifas, canales de reserva, `caja`. `room_cleaning_tasks` existe
desde la migración 23 sin pantalla.

### 15. financiero — Financiero y seguros
**Vertical:** ninguno. **Preset (17).** **Sin subsectores.**
**Faltan subsectores:** cooperativa, corredora de seguros, fintech, cobranza.
**Falta:** `creditos` y `cartera`. Es un sector con diecisiete módulos genéricos
y ninguno que hable de dinero prestado.

### 16. mineria — Minería y extractivas
**Vertical:** ninguno. **Preset (18).** **Sin subsectores.**
**Faltan subsectores:** cielo abierto, subterránea, materiales de construcción.
**Falta:** `obra`, producción por frente dentro de `produccion`, permisos y
títulos (hoy caben en `documentos`, pero sin vencimientos ni alertas).

### 17. telecomunicaciones — Telecomunicaciones
**Vertical:** ninguno. **Preset (16).** **Sin subsectores.**
**Faltan subsectores:** ISP, instalador, integrador de redes.
**Falta:** `suscriptores` — planes, activaciones, suspensiones, consumo. Hoy un
ISP con dos mil clientes los lleva en `clientes` y los cobra a mano.

### 18. seguridad — Seguridad y vigilancia
**Vertical:** ninguno. **Preset (18).** **Sin subsectores.**
**Faltan subsectores:** vigilancia física, monitoreo, escoltas.
**Falta:** `puestos` — turnos por puesto, rondas, minuta, dotación. Es el corazón
del negocio y no existe; `asistencia` cubre la ausencia del empleado, no la
cobertura del puesto.

### 19. medios — Medios y publicidad
**Vertical:** ninguno. **Preset (15).** **Sin subsectores.**
**Faltan subsectores:** agencia creativa, productora, medio.
**Falta:** `tiempos`, aprobación de piezas.

### 20. ong — ONG y fundaciones
**Vertical:** ninguno. **Preset (14).** **Sin subsectores.**
**Faltan subsectores:** fundación, cooperación internacional, voluntariado.
**Falta:** `donantes` — donaciones, proyectos financiados, rendición de cuentas.
Un preset sin nada que hable de donantes deja fuera de la herramienta la mitad
del trabajo de una ONG.

### 21. gobierno — Sector público
**Vertical:** ninguno. **Preset (15).** **Sin subsectores.**
**Faltan subsectores:** entidad, contratista del Estado, empresa de servicios públicos.
**Falta:** `contratacion` (procesos, pliegos, supervisión), PQRS —
`tickets` se le parece y no es lo mismo: una PQRS tiene término legal.

### 22. otro — Otro
**Preset (10).** No le falta nada: es el caso «sin opinión» y está bien así.

### 23. fitness-bienestar — Fitness y bienestar
**Vertical:** ninguno. **Preset (11):** asistencia calendario canales clientes
documentos empleados firmas ia inventario nomina tickets

| Subsector | Delta actual | Qué falta |
|---|---|---|
| gimnasio | `+contratos,mantenimiento` | `socios`, `caja`, control de acceso |
| estudio | `+contratos,capacitacion` `−inventario` | `socios`, horario de clases, cupos, lista de espera |
| spa | `+contratos,catalogos,cotizaciones` | `socios`, cita por cabina y terapeuta, bonos |
| centro | `+contratos,pacientes` | `socios` junto a `pacientes`: historia + membresía |

La migración 33 creó el sector **decidiendo explícitamente no darle vertical**
(«un módulo `membresias` es una apuesta a que la demanda está ahí, y la decisión
M9 es esperar en vez de enviar una pantalla medio vacía»). Esa espera se acabó:
el preset de once módulos no tiene dónde registrar un socio, una membresía, una
clase ni una entrada al gimnasio, que es literalmente todo el negocio.

**Falta:** `socios`, y después `suscripciones`, `caja`, `marketing`.

---

## Roles sugeridos por subsector — ✅ hecho

Migración 46 sembró `public.sector_roles` con matrices de roles sugeridos para
los 51 subsectores, con permisos solo del vocabulario existente y nunca
`configuracion:manage`. Se crean automáticamente al crear la empresa (roles
`is_system`), y un botón en Configuración → Roles y permisos los vuelve a
sembrar si se borraron.

Ejemplos:

- Veterinaria → Veterinario/a, Auxiliar veterinario, Recepción y caja.
- Odontología → Odontólogo/a, Auxiliar dental, Recepcionista.
- Ferretería → Vendedor/a de mostrador, Jefe/a de bodega, Cajero/a.

Nada de la tabla maestra cambia: los roles sugeridos no alteran presets de
módulos.

---

## 4. Orden de trabajo propuesto

Por hueco más grande y por reutilización, no por tamaño del sector.

1. ~~**`socios`**~~ — **hecho** (migración 42). Queda pendiente marcar asistencia
   desde la pantalla de clases: `actualizarReserva` existe en el servidor y
   necesita que `getSocios` devuelva las reservas por clase, no solo el conteo.
2. ~~**`caja` y `pos`**~~ — **hecho** (migraciones 43 y 44). Los cinco sectores
   que cobran de frente tienen turno de caja con arqueo, y cuatro de ellos
   mostrador. La 44 cerró el enganche del restaurante: `cash_session_id`
   existía desde la migración 25 y **nada la escribía nunca**, así que el
   cierre de caja del restaurante —- que sumaba exactamente esa columna—- daba
   cero todas las noches. Se le añadió `payment_method` a la comanda, porque
   sin él toda comanda contaba como efectivo y un local con datáfono cerraba
   con un faltante inventado cada noche.
3. ~~**Odontología**~~ — **hecho** (migración 45): odontograma FDI, planes de
   tratamiento por pieza con total calculado por trigger, y laboratorio dental
   con vigilancia de la fecha de entrega. Es el patrón para la profundidad por
   subsector: tablas bajo el permiso del módulo sectorial, pantallas que
   aparecen según `subsector`. Faltan las imágenes (radiografías), que
   necesitan storage, y los consentimientos, que pueden salir de `firmas`.
4. ~~**`tiempos`**~~ ✅ — **hecho** (migración 47): pantalla completa con
   presets para servicios, tecnologia y medios. Disponible en el plan Growth.
5. ~~**Las tres pantallas huérfanas**~~ ✅ — **hecho**: `delivery_routes` en
   Flota (crear ruta, estado, borrado), `room_cleaning_tasks` en Hotelería y
   `menu_item_ingredients` en Restaurante.
6. ~~**`suscripciones` y `cartera`**~~ ✅ — **hecho** (migraciones 48 y 49):
   planes y cobro recurrente (`subscription_plans`, `subscriptions`) y cuentas
   por cobrar con acuerdos de pago (`receivable_agreements` sobre `invoices`).
   Presets sembrados: suscripciones para fitness-bienestar, educacion,
   tecnologia e inmobiliario; cartera para financiero, salud, educacion y
   servicios.
7. **Verticales que faltan por completo:** `suscriptores`, `puestos`,
   `donantes`, `creditos`, `obra`, `ph`.
8. **Subsectores de los once sectores que no tienen.**
9. **Transversales restantes:** `reportes`, `notificaciones`, `portal`,
   `marketing`, `integraciones`, `sucursales`.
