# Catálogo: los 23 sectores, sus 45 subsectores, y qué le falta a cada uno

Inventario generado desde el código, no de memoria: `COMPANY_TYPES` y
`SUBSECTOR_PRESETS` en `src/lib/modules.ts`, `REGISTRY` en
`src/lib/modules/registry.ts`, y las tablas de `supabase/migrations/`.

**Estado hoy:** 23 sectores · 51 subsectores · **48 módulos conmutables** ·
**10 verticales** (`pacientes`, `estudiantes`, `restaurante`, `agro`,
`inmobiliario`, `hoteleria`, `ecommerce`*, `socios`, `obra`, `contratacion`).

`ecommerce` figura como vertical en `COMPANY_TYPES` pero su módulo vive en el
grupo *Comercial* del registro, no en *Sectoriales*. Es una inconsistencia menor
y real: el sector Ecommerce no tiene pantalla propia de sector, tiene la pantalla
de pedidos en línea que cualquier comercio puede encender.

---

## 1. Tabla maestra

| # | Sector | Vertical | Subs. | Preset | Qué le falta |
|---|--------|----------|-------|--------|--------------|
| 1 | construccion | **obra** ✅ | 4 | 21 | bitácora y actas, `tiempos` |
| 2 | energia | — | 0 | 22 | subsectores |
| 3 | manufactura | — | 4 | 21 | BOM en `produccion` |
| 4 | comercio | — | 5 | 18 | `marketing` |
| 5 | ecommerce | ecommerce* | 0 | 17 | `marketing`, `integraciones`, subsectores |
| 6 | servicios | — | 5 | 18 | calendario tributario, expedientes |
| 7 | tecnologia | — | 0 | 18 | subsectores |
| 8 | salud | pacientes | 6 | 21 | profundidad por subsector, `portal` |
| 9 | educacion | estudiantes | 4 | 19 | notas y boletines, `portal` |
| 10 | logistica | — | 3 | 19 | manifiestos, guías, `portal` (rastreo) |
| 11 | alimentos | restaurante | 5 | 17 | escandallo, `marketing` |
| 12 | agro | agro | 4 | 20 | sanidad, riego, certificaciones |
| 13 | inmobiliario | inmobiliario | 3 | 18 | `portal`, liquidación al propietario |
| 14 | hoteleria | hoteleria | 4 | 17 | tarifas, canales de reserva |
| 15 | financiero | — | 0 | 20 | subsectores |
| 16 | mineria | — | 0 | 20 | producción mineral, subsectores |
| 17 | telecomunicaciones | **suscriptores** ✅ | 0 | 18 | subsectores |
| 18 | seguridad | **puestos** ✅ | 0 | 20 | rondas, minuta, subsectores |
| 19 | medios | — | 0 | 17 | aprobación de piezas, subsectores |
| 20 | ong | — | 0 | 16 | subsectores |
| 21 | gobierno | **contratacion** ✅ | 0 | 17 | PQRS, subsectores |
| 22 | otro | — | 0 | 11 | nada — es el caso "sin opinión" |
| 23 | fitness-bienestar | **socios** ✅ | 4 | 17 | `marketing` |

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
| ~~`reportes`~~ ✅ | **Hecho** — migración 51: `saved_reports` en el SPINE de todos los sectores | todos | |
| ~~`notificaciones`~~ ✅ | **Hecho** — migración 50: reglas de recordatorio y qué se envió a quién | salud, educacion, fitness, inmobiliario, hoteleria | |
| `portal` | Portal externo del tercero: paciente, acudiente, inquilino, huésped | salud, educacion, inmobiliario, logistica | `portal_invites`, enlace público firmado |
| `marketing` | Campañas, fidelización, cupones, referidos | comercio, ecommerce, alimentos, salud, fitness | `campaigns`, `loyalty_points` |
| `integraciones` | Pasarela de pago, facturación electrónica, WhatsApp, contabilidad | todos | `integrations`, `integration_events` |
| `sucursales` | Pantalla real para `public.sites`, que hoy solo se toca en el asistente | todos | ninguna — la tabla existe (mig. 31) |
| ~~`tiempos`~~ ✅ | **Hecho** — migración 47: horas facturables por persona, proyecto y tarifa | servicios, tecnologia, medios | |
| ~~`suscripciones`~~ ✅ | **Hecho** — migración 48: `subscription_plans` y `subscriptions` con ciclo, renovación y precio por cliente | fitness, educacion, inmobiliario, tecnologia | |
| ~~`cartera`~~ ✅ | **Hecho** — migración 49: `receivable_agreements` sobre `invoices` | financiero, salud, educacion, servicios | |

### 2.2 Verticales nuevos — uno por sector que hoy no tiene

| Clave | Sector | Qué es | Tablas |
|---|---|---|---|
| ~~`socios`~~ ✅ | fitness-bienestar | **Hecho** — migración 42: `fitness_members`, `fitness_plans`, `fitness_subscriptions`, `fitness_classes`, `fitness_bookings`, `fitness_checkins` | |
| ~~`obra`~~ ✅ | construccion, energia, mineria | **Hecho** — migración 57: `obra_presupuestos`, `obra_capitulos`, `obra_apu`, `obra_avances` con resincronización por funciones SQL | |
| ~~`suscriptores`~~ ✅ | telecomunicaciones | **Hecho** — migración 54: planes, activaciones, suspensiones y consumo | |
| ~~`puestos`~~ ✅ | seguridad | **Hecho** — migración 55: `guard_posts`, `post_shifts` con cobertura | |
| ~~`donantes`~~ ✅ | ong | **Hecho** — migración 53: donaciones y rendición | |
| ~~`creditos`~~ ✅ | financiero | **Hecho** — migración 52: colocación, amortización, mora | |
| `rutas` | logistica | Rutas, manifiestos, guías, prueba de entrega | `delivery_routes` **ya existe** (mig. 20) + `waybills`, `pods` |
| ~~`ph`~~ ✅ | inmobiliario | **Hecho** — migración 59: `ph_asambleas`, `ph_cuotas`, `ph_zonas` | |
| ~~`calidad`~~ ✅ | manufactura, alimentos, agro | **Hecho** — migración 56: `quality_checks`, `nonconformities` | |
| ~~`contratacion`~~ ✅ | gobierno | **Hecho** — migración 60: `contratacion_procesos`, `contratacion_pliegos`, `contratacion_oferentes` | |

### 2.3 Profundidad dentro de un vertical existente

No son módulos: son pantallas dentro del módulo que ya existe, para que
`enabled_modules` no se llene de conmutadores que solo un subsector entiende.

| Vertical | Qué le falta |
|---|---|
| `pacientes` | ✅ odontograma/planes/lab dental (45), veterinaria (65: mascotas, vacunas, hospitalización), imágenes diagnósticas (66: bucket privado con URL firmada). Falta teleconsulta |
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
**Vertical:** `obra` (migración 57). Vive además en `proyectos`.
**Preset (21):** asistencia calendario canales clientes compras contratos cotizaciones documentos empleados facturacion firmas hseq ia inventario mantenimiento nomina obra proyectos reportes riesgos tickets

| Subsector | Delta actual | Qué falta |
|---|---|---|
| civil | `+flota` | bitácora y actas |
| mep | `+catalogos` | catálogo de APU compartido |
| remodel | `+catalogos` `−hseq` | `cotizaciones` por ambiente |
| interv | `+trazabilidad` `−inventario,mantenimiento,compras` | actas y no conformidades dentro de `obra` |

**Falta:** bitácora de obra, actas; `tiempos` para cuadrillas.

### 2. energia — Energía y renovables
**Vertical:** ninguno. **Preset (22).** **Sin subsectores.**
**Faltan subsectores:** solar, eólica, eficiencia energética, O&M.
**Falta:** para O&M el `mantenimiento` con contratos de disponibilidad.

### 3. manufactura — Manufactura y producción
**Vertical:** ninguno propio; usa `produccion`. **Preset (19).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| metal | `+proyectos` | BOM |
| plastico | `+trazabilidad` | BOM, merma por lote |
| textil | `+tienda` | BOM por talla y color |
| alimentos | `+trazabilidad` | lotes y vencimientos, HACCP |

**Hecho:** BOM en `produccion` (migración 70). `calidad` ya está
(migración 56).

### 4. comercio — Comercio y retail
**Vertical:** ninguno. **Preset (15).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| retail | `−cotizaciones` | `marketing` |
| mayorista | `+contratos,flota` `−tienda` | listas de precio por cliente, cupo de crédito |
| ferreteria | `−tienda` | unidades de medida, kits |
| farmacia | `+trazabilidad` `−cotizaciones` | lotes y vencimientos, control de fórmulas |
| super | `+flota,mantenimiento` `−cotizaciones` | balanza, mermas |

**Hecho:** `marketing` y fidelización (transversales). `pos` y `caja` ya están (migraciones
43-44) y son el mostrador del sector.

### 5. ecommerce — Ecommerce y venta en línea
**Vertical:** `ecommerce` (en grupo Comercial). **Preset (16).** **Sin subsectores.**
**Faltan subsectores:** marketplace, tienda propia, dropshipping, suscripción.
**Hecho:** `marketing` e `integraciones` (transversales); cupones existen dentro
de ecommerce. Falta la transportadora en integraciones. `notificaciones` ya está (mig. 50).

### 6. servicios — Servicios profesionales
**Vertical:** ninguno. **Preset (15).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| consultoria | `+desempeno` | rentabilidad por proyecto |
| contable | `+trazabilidad` `−proyectos` | calendario tributario |
| legal | `+trazabilidad` | expedientes y términos |
| agencia | `+desempeno,reclutamiento` | piezas y aprobaciones |
| ti | `+inventario,desempeno` | SLA por cliente, activos del cliente |

**Falta:** lo que queda es profundidad. `tiempos` (migración 47) y `cartera`
(migración 49) ya están en el preset con permisos en los roles operativos.

### 7. tecnologia — Tecnología y software
**Vertical:** ninguno. **Preset (15).** **Sin subsectores.**
**Faltan subsectores:** producto SaaS, software a la medida, integrador.
**Falta:** subsectores. `tiempos` (migración 47) y `suscripciones` (migración
48) ya están.

### 8. salud — Salud
**Vertical:** `pacientes`. **Preset (17).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| consultorio | `−hseq,riesgos,inventario,trazabilidad` | `portal` |
| ips | `+mantenimiento,desempeno` | camas y urgencias, RIPS, autorizaciones de EPS |
| laboratorio | `+catalogos` `−consultoria` | órdenes y resultados, interfaz con equipos |
| **odontologia** | `+catalogos,cotizaciones` `−hseq,trazabilidad` | ✅ odontograma, plan por pieza, laboratorio dental (mig. 45). Faltan radiografías, consentimientos, teleodontología |
| estetica | `+catalogos,cotizaciones` `−hseq,riesgos,trazabilidad` | fichas de procedimiento, fotos antes/después, bonos |
| veterinaria | `+catalogos,tienda` `−consultoria,trazabilidad` | mascota vs. propietario, vacunas, peluquería, hospitalización |

**Falta transversal al sector:** `portal` del paciente. `caja` (mig. 43),
`notificaciones` (mig. 50) y `cartera` (mig. 49) ya están.

### 9. educacion — Educación
**Vertical:** `estudiantes`. **Preset (15).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| colegio | `+desempeno,reclutamiento` | boletín por periodo, horarios, convivencia, `portal` del acudiente |
| instituto | `+proyectos` | prácticas, certificados |
| academia | `−inventario,contratos` | niveles |
| universidad | `+proyectos,desempeno,reclutamiento,trazabilidad` | créditos, semestres, homologaciones |

**Falta transversal:** notas y boletines dentro de `estudiantes`, `portal`.
`suscripciones` (mig. 48), `cartera` (mig. 49) y `notificaciones` (mig. 50)
ya están en el preset.

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
| salon | `+clientes` | propinas, reservas (tabla existe) |
| rapida | `+tienda,ecommerce` | pantalla de cocina, delivery (tabla existe) |
| bar | `+clientes` `−hseq` | control de botella, happy hour |
| catering | `+clientes,cotizaciones,contratos,proyectos` | escandallo por evento, logística |
| panaderia | `+produccion` | escandallo, producción por lote |

**Falta:** escandallo — la tabla `menu_item_ingredients` existe y ninguna
pantalla la usa. `caja` y `pos` ya son transversales (migraciones 43-44).

### 12. agro — Agro y agroindustria
**Vertical:** `agro`. **Preset (18).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| permanente | `+trazabilidad` | sanidad, riego, certificaciones |
| transitorio | `+produccion` | plan de siembra, clima |
| ganaderia | `+produccion,trazabilidad` | inventario animal, sanidad, leche, potreros |
| poscosecha | `+produccion,catalogos,trazabilidad` | empaque, `pos` de acopio |

**Falta:** sanidad y fitosanitario, riego, certificaciones — todo dentro de `agro`.
`calidad` ya está en el preset (mig. 56). La ganadería probablemente merece
pantalla propia: un semoviente no es un lote.

### 13. inmobiliario — Inmobiliario
**Vertical:** `inmobiliario`. **Preset (15).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| arriendo | `−cotizaciones` | liquidación al propietario |
| **ph** | `+hseq,riesgos,ph` `−cotizaciones` | reserva de zonas comunes |
| corretaje | `+desempeno` `−mantenimiento` | captaciones, visitas, comisiones |

**Falta:** `portal` del inquilino y liquidación al propietario. `ph` (mig. 59),
`cartera` (mig. 49), `suscripciones` (mig. 48) y `notificaciones` (mig. 50)
ya están.

### 14. hoteleria — Hotelería y turismo
**Vertical:** `hoteleria`. **Preset (14).**

| Subsector | Delta actual | Qué falta |
|---|---|---|
| hotel | `+hseq` | tarifas por temporada, canales, housekeeping (tabla existe) |
| hostal | `−restaurante,mantenimiento` | camas por habitación compartida |
| finca | `+agro` | paquetes, actividades |
| operador | `+proyectos,cotizaciones,contratos` `−hoteleria,restaurante,inventario,mantenimiento` | itinerarios, cupos, proveedores |

**Falta:** tarifas y canales de reserva. `caja` ya es transversal (mig. 43) y
`room_cleaning_tasks` existe desde la migración 23 con pantalla en Hotelería.

### 15. financiero — Financiero y seguros
**Vertical:** ninguno. **Preset (20).** **Sin subsectores.**
**Faltan subsectores:** cooperativa, corredora de seguros, fintech, cobranza.
`creditos` (mig. 52) y `cartera` (mig. 49) ya hablan de dinero prestado y
cobrado, con permisos en asesor/riesgos/cobranza.

### 16. mineria — Minería y extractivas
**Vertical:** ninguno. **Preset (20).** **Sin subsectores.**
**Faltan subsectores:** cielo abierto, subterránea, materiales de construcción.
**Falta:** producción por frente dentro de `produccion`, permisos y títulos
(hoy caben en `documentos`, pero sin vencimientos ni alertas). `obra` ya está
en el preset (mig. 57).

### 17. telecomunicaciones — Telecomunicaciones
**Vertical:** `suscriptores` (migración 54). **Preset (18).** **Sin subsectores.**
**Faltan subsectores:** ISP, instalador, integrador de redes. Un ISP con dos
mil clientes ya no los lleva en `clientes`.

### 18. seguridad — Seguridad y vigilancia
**Vertical:** `puestos` (migración 55). **Preset (20).** **Sin subsectores.**
**Faltan subsectores:** vigilancia física, monitoreo, escoltas.
**Falta:** rondas, minuta y dotación. `asistencia` cubre la ausencia del
empleado; `puestos` ya cubre el puesto que no puede quedar vacío.

### 19. medios — Medios y publicidad
**Vertical:** ninguno. **Preset (15).** **Sin subsectores.**
**Faltan subsectores:** agencia creativa, productora, medio.
**Falta:** aprobación de piezas. `tiempos` ya está (mig. 47).

### 20. ong — ONG y fundaciones
**Vertical:** ninguno. **Preset (14).** **Sin subsectores.**
**Faltan subsectores:** fundación, cooperación internacional, voluntariado.
`donantes` (mig. 53) ya deja registrar donaciones y rendir cuentas.

### 21. gobierno — Sector público
**Vertical:** `contratacion` (migración 60). **Preset (17).** **Sin subsectores.**
**Faltan subsectores:** entidad, contratista del Estado, empresa de servicios públicos.
**Falta:** PQRS — `tickets` se le parece y no es lo mismo: una PQRS tiene
término legal.

### 22. otro — Otro
**Preset (10).** No le falta nada: es el caso «sin opinión» y está bien así.

### 23. fitness-bienestar — Fitness y bienestar
**Vertical:** `socios` (migración 42). **Preset (17):** asistencia caja
calendario canales clientes documentos empleados facturacion firmas ia
inventario nomina notificaciones reportes socios suscripciones tickets

| Subsector | Delta actual | Qué falta |
|---|---|---|
| gimnasio | `+contratos,mantenimiento` | control de acceso |
| estudio | `+contratos,capacitacion` `−inventario` | horario de clases, cupos, lista de espera |
| spa | `+contratos,catalogos,cotizaciones` | cita por cabina y terapeuta, bonos |
| centro | `+contratos,pacientes` | historia + membresía en una ficha |

La migración 33 creó el sector **decidiendo explícitamente no darle vertical**
(«un módulo `membresias` es una apuesta a que la demanda está ahí, y la decisión
M9 es esperar en vez de enviar una pantalla medio vacía»). Esa espera se acabó
con `socios` (migración 42); `suscripciones` (mig. 48) y `notificaciones`
(mig. 50) cerraron la membresía y el recordatorio.

**Falta:** `marketing` y fidelización.

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
7. ~~**Verticales que faltaban por completo**~~ ✅ — **hecho** (migraciones
   52-60): `suscriptores`, `puestos`, `donantes`, `creditos`, `obra`, `ph`,
   `calidad`, `contratacion`, más los transversales `reportes` y
   `notificaciones` (migraciones 50-51).
8. ~~**Pase de roles sugeridos**~~ ✅ — **hecho** (migración 61): los módulos
   47-60 entran a las matrices de los sectores que los prenden.
9. **Subsectores de los once sectores que no tienen.**
10. **Transversales restantes:** `portal`, `marketing`, `integraciones`,
    `sucursales`.
