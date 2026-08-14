# Catálogo vivo — sectores, subsectores, módulos y roles

> Generado desde la base de datos (`public.sectors`, `public.sector_modules`,
> `public.sector_roles`), no desde memoria. Fecha: 2026-08-14.
> Si este documento y la base llegan a discrepar, la base gana — y hay tests
> que impiden que eso ocurra en silencio (ver «Cómo se verifica»).

## Estado global

| | |
|---|---|
| Sectores | 23 |
| Subsectores | 51 |
| Presets resueltos (sector o subsector) | 62 |
| Matrices de roles sugeridos | 61 (todos menos `otro`, que es el caso «sin opinión») |
| Módulos conmutables | 35 + shell (`dashboard`, `configuracion`) |
| Verticales | 8: `pacientes`, `estudiantes`, `restaurante`, `agro`, `inmobiliario`, `hoteleria`, `ecommerce` (en grupo Comercial), `socios` |

**Método.** Elegir subsector produce:

```
preset(subsector) = preset(sector) ∪ delta.add − delta.remove
```

El delta es explícito y pequeño por diseño: un subsector no reescribe a su
padre. Si la diferencia fuera enorme, el sector está mal dibujado y el arreglo
es un sector nuevo.

**Roles.** Cada matriz usa solo el vocabulario de permisos existente
(`<módulo>:read|write`), nunca `configuracion:manage`. Los roles sugeridos se
siembran como `is_system` al crear la empresa y son editables y borrables. La
búsqueda cae del subsector al sector, así que una empresa del sector sin
subsector recibe la matriz del sector cuando existe.

**Cómo se verifica** (lo que mantiene esto sincronizado):

- `src/lib/modules.test.ts` — presets TS ↔ `sector_modules`, y cada vertical
  es habilitado exactamente por el sector que lo declara.
- `src/lib/registry.test.ts` — el registro de módulos coincide con las
  migraciones y el nav.
- `src/lib/suggested-roles.test.ts` — matrices de roles TS ↔ `sector_roles`
  en ambas direcciones, permisos válidos, sin `configuracion:manage`.
- `scripts/db-verify.sh` — las 46 migraciones aplican limpias en un Postgres
  desechable.

---

## Leyenda de módulos

| Clave | Nombre | Grupo |
|---|---|---|
| agro | Agro | Sectoriales |
| asistencia | Asistencia | Personas |
| caja | Caja | Comercial |
| calendario | Calendario | Equipo |
| canales | Canales | Equipo |
| capacitacion | Capacitación | Personas |
| catalogos | Catálogos | Comercial |
| clientes | Clientes | Comercial |
| compras | Compras y órdenes | Comercial |
| consultoria | Consultoría | Equipo |
| contratos | Contratos | Comercial |
| cotizaciones | Cotizaciones | Comercial |
| desempeno | Desempeño | Personas |
| documentos | Documentos | Equipo |
| ecommerce | Ecommerce | Comercial |
| empleados | Empleados | Personas |
| estudiantes | Estudiantes | Sectoriales |
| facturacion | Facturación | Comercial |
| firmas | Firmas | Equipo |
| flota | Flota | Operación |
| hoteleria | Hotelería | Sectoriales |
| hseq | HSEQ | Operación |
| ia | Asistente de IA | Equipo |
| inmobiliario | Inmobiliario | Sectoriales |
| inventario | Inventario | Operación |
| mantenimiento | Mantenimiento | Operación |
| nomina | Nómina | Personas |
| pacientes | Pacientes | Sectoriales |
| pos | Punto de venta | Comercial |
| produccion | Producción | Operación |
| proyectos | Proyectos | Operación |
| reclutamiento | Reclutamiento | Personas |
| restaurante | Restaurante | Sectoriales |
| riesgos | Centro de Riesgos | Personas |
| socios | Socios | Sectoriales |
| tickets | Tickets | Equipo |
| tienda | Tienda virtual | Comercial |
| trazabilidad | Trazabilidad | Operación |

`configuracion` y `dashboard` son el shell: no conmutables, no aparecen en
presets.

---

## Sector por sector

### 1. agro — Agro y agroindustria
**Vertical:** `agro` · **Subsectores:** 4 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| agro-ganaderia | 20: agro asistencia calendario canales clientes compras cotizaciones documentos empleados facturacion flota hseq ia inventario mantenimiento nomina produccion riesgos tickets trazabilidad | Administrador/a de finca, Veterinario/a de campo, Capataz |
| agro-permanente | 19: agro asistencia calendario canales clientes compras cotizaciones documentos empleados facturacion flota hseq ia inventario mantenimiento nomina riesgos tickets trazabilidad | Administrador/a de finca, Técnico/a de campo, Capataz |
| agro-poscosecha | 21: anterior + catalogos, produccion | Administrador/a, Supervisor/a de calidad, Operario/a |
| agro-transitorio | 19: anterior − trazabilidad + produccion | Administrador/a de finca, Técnico/a de campo, Capataz |

**Revisión:** presets y roles completos. Falta profundidad dentro de `agro`:
sanidad/fitosanitario, riego, clima, certificaciones (GlobalGAP). La ganadería
probablemente merece pantalla propia: un semoviente no es un lote.

### 2. alimentos — Restaurantes y alimentos
**Vertical:** `restaurante` · **Subsectores:** 5 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| alimentos-bar | 15: asistencia caja calendario canales catalogos clientes compras documentos empleados facturacion ia inventario nomina restaurante tickets | Bartender, Mesero/a, Cajero/a |
| alimentos-catering | 18: bar + contratos cotizaciones hseq proyectos | Chef, Coordinador/a de eventos, Cocina |
| alimentos-panaderia | 17: bar + hseq pos produccion − clientes | Panadero/a, Vendedor/a |
| alimentos-rapida | 18: bar + ecommerce pos tienda | Mostrador y caja, Cocina, Repartidor/a |
| alimentos-salon | 16: bar + clientes | Mesero/a, Cocina, Cajero/a |

**Revisión:** `caja` y `pos` ya son transversales (migraciones 43-44). Falta
escandallo (la tabla `menu_item_ingredients` existe sin pantalla), delivery
(`restaurant_deliveries` idem) y propinas.

### 3. comercio — Comercio y retail
**Vertical:** ninguno (opera con `pos` + `caja`) · **Subsectores:** 5 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| comercio-farmacia | 17: … + pos trazabilidad − cotizaciones tienda | Regente de farmacia, Cajero/a |
| comercio-ferreteria | 16: … + pos − tienda | Vendedor/a de mostrador, Jefe/a de bodega, Cajero/a |
| comercio-mayorista | 16: … + contratos flota − caja pos tienda | Ejecutivo/a de ventas, Despachador/a |
| comercio-retail | 16: … + pos − cotizaciones | Vendedor/a, Cajero/a, Supervisor/a de inventario |
| comercio-super | 18: … + flota mantenimiento pos − cotizaciones | Cajero/a, Reponedor/a, Supervisor/a |

**Revisión:** el mostrador quedó resuelto (pos/caja). Falta `marketing` y
fidelización; en mayorista, listas de precio por cliente y cupo de crédito;
en farmacia, lotes y vencimientos.

### 4. construccion — Construcción e infraestructura
**Vertical:** ninguno (vive en `proyectos`) · **Subsectores:** 4 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| construccion-civil | 20: asistencia calendario canales clientes compras contratos cotizaciones documentos empleados facturacion firmas flota hseq ia inventario mantenimiento nomina proyectos riesgos tickets | Residente de obra, Almacenista, Administrativo/a de obra |
| construccion-interv | 17: − compras inventario mantenimiento + trazabilidad | Supervisor/a, Inspector/a, Coordinador/a |
| construccion-mep | 20: + catalogos | Ingeniero/a, Instalador/a, Almacenista |
| construccion-remodel | 19: + catalogos − hseq | Diseñador/a, Oficial de obra, Administrativo/a |

**Revisión:** falta el vertical `obra` (presupuesto APU, avance por capítulo,
actas, cortes, bitácora) y `tiempos`.

### 5. ecommerce — Ecommerce y venta en línea
**Vertical:** `ecommerce` (en grupo Comercial) · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| ecommerce (sector) | 16: asistencia calendario canales catalogos clientes compras cotizaciones documentos ecommerce empleados facturacion ia inventario nomina tickets tienda | Gestor/a de tienda, Atención al cliente, Despacho |

**Revisión:** falta `marketing` (campañas; los cupones viven dentro de
ecommerce), `integraciones` (pasarela, transportadora), `notificaciones` de
estado del pedido y subsectores (marketplace, tienda propia, dropshipping).

### 6. educacion — Educación
**Vertical:** `estudiantes` · **Subsectores:** 4 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| educacion-academia | 13: asistencia calendario canales capacitacion clientes documentos empleados estudiantes facturacion firmas ia nomina tickets | Instructor/a, Recepción |
| educacion-colegio | 17: + contratos desempeno inventario reclutamiento | Docente, Coordinador/a, Secretaría |
| educacion-instituto | 16: + contratos inventario proyectos | Docente, Coordinador/a, Admisiones |
| educacion-universidad | 19: + contratos desempeno inventario proyectos reclutamiento trazabilidad | Docente, Coordinador/a, Admisiones |

**Revisión:** falta notas por periodo y boletín dentro de `estudiantes` y
portal del acudiente. `suscripciones` (mensualidad) y `cartera` (pensiones)
ya entraron (migraciones 48-49).

### 7. energia — Energía y renovables
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| energia (sector) | 20: asistencia calendario canales catalogos clientes compras contratos cotizaciones documentos empleados facturacion firmas hseq ia inventario mantenimiento nomina proyectos riesgos tickets | Ingeniero/a de proyecto, Técnico/a de campo, Supervisor/a HSE |

**Revisión:** falta `obra`, subsectores (solar, eólica, eficiencia, O&M) y
contratos de disponibilidad en mantenimiento.

### 8. financiero — Financiero y seguros
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| financiero (sector) | 17: asistencia calendario canales clientes consultoria contratos cotizaciones desempeno documentos empleados facturacion firmas ia nomina riesgos tickets trazabilidad | Asesor/a, Analista de riesgos, Cobranza |

**Revisión:** falta `creditos` (colocación, amortización, mora) y subsectores
(cooperativa, corredora, fintech, cobranza). `cartera` ya entró (migración 49).

### 9. fitness-bienestar — Fitness y bienestar
**Vertical:** `socios` · **Subsectores:** 4 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| fitness-centro | 16: asistencia caja calendario canales clientes contratos documentos empleados facturacion firmas ia inventario nomina pacientes socios tickets | Terapeuta, Recepcionista |
| fitness-estudio | 15: − inventario + capacitacion | Instructor/a, Recepcionista |
| fitness-gimnasio | 16: + inventario mantenimiento | Instructor/a, Recepcionista, Encargado/a de sala |
| fitness-spa | 18: + catalogos cotizaciones pos | Terapeuta, Recepcionista |

**Revisión:** `socios` (migración 42) resolvió el hueco mayor y
`suscripciones` (migración 48) cerró la membresía. Falta marcar asistencia
desde la pantalla de clases, control de acceso y `marketing`.

### 10. gobierno — Sector público
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| gobierno (sector) | 15: asistencia calendario canales compras contratos documentos empleados firmas hseq ia nomina proyectos riesgos tickets trazabilidad | Contratista, Jurídico/a, Supervisión |

**Revisión:** falta `contratacion` (procesos, pliegos, oferentes, supervisión)
y PQRS con término legal — `tickets` se le parece y no es lo mismo.

### 11. hoteleria — Hotelería y turismo
**Vertical:** `hoteleria` · **Subsectores:** 4 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| hoteleria-finca | 16: agro asistencia caja calendario canales clientes documentos empleados facturacion hoteleria ia inventario mantenimiento nomina restaurante tickets | Recepción, Guía de campo |
| hoteleria-hostal | 13: − restaurante mantenimiento | Recepción, Ama de llaves |
| hoteleria-hotel | 16: + hseq | Recepción, Ama de llaves, Mantenimiento |
| hoteleria-operador | 13: − hoteleria restaurante inventario mantenimiento caja + contratos cotizaciones proyectos | Agente de viajes, Operador/a de itinerario |

**Revisión:** falta tarifas por temporada, canales de reserva, housekeeping
(`room_cleaning_tasks` existe sin pantalla) y `caja` ya está incluida.

### 12. inmobiliario — Inmobiliario
**Vertical:** `inmobiliario` · **Subsectores:** 3 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| inmobiliario-arriendo | 14: asistencia calendario canales clientes contratos documentos empleados facturacion firmas ia inmobiliario mantenimiento nomina tickets | Asesor/a, Administrador/a, Conserje |
| inmobiliario-corretaje | 15: + cotizaciones desempeno − mantenimiento | Agente inmobiliario/a, Coordinador/a, Gestor/a de cierre |
| inmobiliario-ph | 16: + hseq riesgos | Administrador/a, Consejo de administración, Conserje |

**Revisión:** falta el vertical `ph` (asambleas, cuotas, zonas comunes),
liquidación al propietario y portal del inquilino. `cartera` ya entró
(migración 49).

### 13. logistica — Logística y transporte
**Vertical:** ninguno · **Subsectores:** 3 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| logistica-bodegaje | 18: asistencia calendario canales catalogos clientes compras contratos cotizaciones documentos empleados facturacion hseq ia inventario mantenimiento nomina riesgos tickets | Jefe/a de bodega, Operario/a, Comercial |
| logistica-carga | 18: + flota − catalogos | Conductor/a, Despachador/a, Comercial |
| logistica-ultima | 20: + ecommerce tienda | Repartidor/a, Despachador/a, Soporte al cliente |

**Revisión:** falta `rutas` — `public.delivery_routes` existe desde la
migración 20 sin pantalla — manifiestos, guías, prueba de entrega y portal de
rastreo.

### 14. manufactura — Manufactura y producción
**Vertical:** ninguno propio (usa `produccion`) · **Subsectores:** 4 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| manufactura-alimentos | 20: … + trazabilidad | Jefe/a de producción, Operario/a, Control de calidad |
| manufactura-metal | 20: … + proyectos | Jefe/a de producción, Operario/a, Control de calidad |
| manufactura-plastico | 20: … + trazabilidad | Jefe/a de producción, Operario/a, Control de calidad |
| manufactura-textil | 20: … + tienda | Diseñador/a, Patronista, Despachador/a |

**Revisión:** falta lista de materiales (BOM) dentro de `produccion`, `calidad`
(lotes, no conformidades) y vencimientos en manufactura-alimentos.

### 15. medios — Medios y publicidad
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| medios (sector) | 15: asistencia calendario canales clientes contratos cotizaciones documentos empleados facturacion firmas ia inventario nomina proyectos tickets | Creativo/a, Productor/a, Comercial |

**Revisión:** falta `tiempos` y aprobación de piezas.

### 16. mineria — Minería y extractivas
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| mineria (sector) | 18: asistencia calendario canales compras contratos documentos empleados firmas flota hseq ia inventario mantenimiento nomina proyectos riesgos tickets trazabilidad | Ingeniero/a de mina, Supervisor/a HSE, Almacenista |

**Revisión:** falta `obra`, producción por frente dentro de `produccion`, y
permisos/títulos con vencimientos (hoy caben en `documentos` sin alertas).

### 17. ong — ONG y fundaciones
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| ong (sector) | 14: asistencia calendario canales capacitacion clientes contratos documentos empleados firmas ia nomina proyectos tickets trazabilidad | Coordinador/a de proyectos, Voluntariado, Finanzas |

**Revisión:** falta `donantes` (donaciones, proyectos financiados, rendición
de cuentas) — hoy la mitad del trabajo de una ONG no tiene dónde registrarse.

### 18. otro — Otro
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** — (sin matriz, por diseño)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| otro (sector) | 10: asistencia calendario canales clientes documentos empleados firmas ia nomina tickets | — |

**Revisión:** correcto así. Es el caso «sin opinión»: empieza con lo esencial
y el cliente activa el resto a mano.

### 19. salud — Salud
**Vertical:** `pacientes` · **Subsectores:** 6 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| salud-consultorio | 14: asistencia caja calendario canales clientes consultoria documentos empleados facturacion firmas ia nomina pacientes tickets | Médico/a, Enfermero/a, Recepcionista |
| salud-estetica | 17: + catalogos cotizaciones inventario | Especialista, Recepcionista |
| salud-ips | 20: + desempeno hseq inventario mantenimiento riesgos trazabilidad | Médico/a, Enfermero/a, Facturador/a, Recepcionista |
| salud-laboratorio | 18: + catalogos hseq inventario riesgos trazabilidad − consultoria | Analista de laboratorio, Recepcionista |
| salud-odontologia | 18: + catalogos cotizaciones inventario riesgos − trazabilidad | Odontólogo/a, Auxiliar dental, Recepcionista |
| salud-veterinaria | 19: + catalogos inventario pos tienda hseq riesgos − consultoria trazabilidad | Veterinario/a, Auxiliar veterinario, Recepción y caja |

**Revisión:** odontología tiene profundidad completa (migración 45: odontograma
FDI, planes de tratamiento por pieza, laboratorio dental). Veterinaria es el
siguiente hueco: falta mascota-vs-propietario, vacunas, peluquería y
hospitalización (mismo patrón que odontología). Transversal al sector faltan
radiografías, consentimientos, `portal` del paciente y `notificaciones` de
cita. `cartera` (copagos y EPS) ya entró (migración 49).

### 20. seguridad — Seguridad y vigilancia
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| seguridad (sector) | 18: asistencia calendario canales capacitacion clientes contratos cotizaciones documentos empleados facturacion firmas hseq ia inventario nomina riesgos tickets trazabilidad | Supervisor/a de puesto, Guarda, Comercial |

**Revisión:** falta `puestos` (turnos por puesto, rondas, minuta, dotación) —
el corazón del negocio. `asistencia` cubre la ausencia del empleado, no la
cobertura del puesto.

### 21. servicios — Servicios profesionales
**Vertical:** ninguno · **Subsectores:** 5 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| servicios-agencia | 17: … + desempeno reclutamiento | Creativo/a, Ejecutivo/a de cuenta, Reclutador/a |
| servicios-consultoria | 16: … + desempeno | Consultor/a, Analista, Gerente/a de cuenta |
| servicios-contable | 15: … + trazabilidad − proyectos | Contador/a, Auxiliar contable, Socio/a |
| servicios-legal | 16: … + trazabilidad | Abogado/a, Paralegal |
| servicios-ti | 17: … + desempeno inventario | Ingeniero/a, Soporte, Gerente/a |

**Revisión:** `tiempos` es la ausencia central — el preset dice «se factura
tiempo» y no hay dónde registrarlo. `cartera` ya entró (migración 49); en
contable falta el calendario tributario y en legal, expedientes y términos.

### 22. tecnologia — Tecnología y software
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| tecnologia (sector) | 15: asistencia calendario canales clientes contratos cotizaciones desempeno documentos empleados facturacion ia nomina proyectos reclutamiento tickets | Ingeniero/a, Soporte, Gerente/a |

**Revisión:** falta `tiempos` y subsectores (SaaS, a la medida, integrador).
`suscripciones` (MRR, renovaciones, churn) ya entró (migración 48).

### 23. telecomunicaciones — Telecomunicaciones
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| telecomunicaciones (sector) | 16: asistencia calendario canales clientes contratos cotizaciones documentos empleados facturacion flota ia inventario mantenimiento nomina proyectos tickets | Técnico/a instalador/a, Soporte de red, Comercial |

**Revisión:** falta `suscriptores` (planes, activaciones, suspensiones,
consumo). Hoy un ISP con dos mil clientes los lleva en `clientes` y los cobra
a mano.

---

## Revisión final — huecos ordenados por impacto

Todo sector entrega hoy: preset de módulos coherente (con delta por
subsector), matriz de roles sugeridos, y acceso vía wizard. Lo que falta se
divide en tres capas:

### Capa 1 — Transversales (módulos que faltan en todos los sectores)

| Módulo | Para quién | Estado |
|---|---|---|
| ~~`tiempos`~~ ✅ | servicios, tecnologia, medios, construccion, legal | hecho (mig. 47) — horas facturables |
| `reportes` | todos | no existe |
| `notificaciones` | salud, educacion, fitness, inmobiliario, hoteleria | no existe |
| `portal` | paciente, acudiente, inquilino, huésped | no existe |
| `marketing` | comercio, alimentos, salud, fitness | no existe |
| `integraciones` | pasarela, facturación electrónica, WhatsApp | no existe (billing webhook sí) |
| ~~`cartera`~~ ✅ | financiero, salud, educacion, servicios | hecho (mig. 49) — cuentas por cobrar y acuerdos de pago |
| ~~`suscripciones`~~ ✅ | fitness, educacion, tecnologia, inmobiliario | hecho (mig. 48) — planes y cobro recurrente |
| `sucursales` | todos | tabla `sites` existe (mig. 31), sin pantalla propia |

### Capa 2 — Verticales (un sector sin su pantalla de negocio)

| Vertical | Sector | Estado |
|---|---|---|
| `obra` | construccion, energia, mineria | no existe |
| `suscriptores` | telecomunicaciones | no existe |
| `puestos` | seguridad | no existe |
| `donantes` | ong | no existe |
| `creditos` | financiero | no existe |
| `rutas` | logistica | ✅ pantalla de rutas en Flota (crear/estado/borrar) |
| `ph` | inmobiliario | no existe |
| `calidad` | manufactura, alimentos, agro | no existe |
| `contratacion` | gobierno | no existe |

### Capa 3 — Profundidad dentro de un vertical existente

| Vertical | Qué falta |
|---|---|
| `pacientes` | veterinaria (mascota/propietario, vacunas, hospitalización), radiografías, consentimientos |
| `estudiantes` | notas por periodo, boletín, portal del acudiente |
| `restaurante` | propinas — escandallo y delivery ya tienen pantalla |
| `agro` | sanidad, riego, clima, certificaciones |
| `hoteleria` | tarifas por temporada, canales — housekeeping ✅ pantalla en Hotelería |
| `inmobiliario` | avalúos, liquidación al propietario |
| `produccion` | BOM, órdenes por lote |

### Orden de trabajo sugerido

1. ~~`tiempos`~~ ✅ — hecho (migración 47): pantalla completa, presets para
   servicios, tecnologia y medios
2. ~~Pantallas huérfanas~~ ✅ — `delivery_routes` en Flota (crear/estado/borrar),
   `room_cleaning_tasks` en Hotelería, `menu_item_ingredients` en Restaurante
3. ~~`suscripciones` + `cartera`~~ ✅ — hecho (migraciones 48 y 49): planes y
   cobro recurrente con presets para fitness-bienestar, educacion, tecnologia
   e inmobiliario (suscripciones) y financiero, salud, educacion y servicios
   (cartera)
4. Veterinaria vertical (patrón odontología ya probado)
5. Verticales completos restantes: `suscriptores`, `puestos`, `donantes`,
   `creditos`, `obra`, `ph`
6. Transversales: `reportes`, `notificaciones`, `portal`, `marketing`,
   `integraciones`

Cada uno de esos módulos entra por el mismo camino: migración con
`app.apply_standard_rls`, entrada en el registro, preset en `sector_modules`,
matriz de roles en `sector_roles`, y los tests de pin lo mantienen
sincronizado.
