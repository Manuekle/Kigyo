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
| Módulos conmutables | 48 + shell (`dashboard`, `configuracion`) |
| Verticales | 10: `pacientes`, `estudiantes`, `restaurante`, `agro`, `inmobiliario`, `hoteleria`, `ecommerce` (en grupo Comercial), `socios`, `obra` (construccion), `contratacion` (gobierno) |

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
- `scripts/db-verify.sh` — las 61 migraciones aplican limpias en un Postgres
  desechable.

---

## Leyenda de módulos

| Clave | Nombre | Grupo |
|---|---|---|
| agro | Agro | Sectoriales |
| asistencia | Asistencia | Personas |
| caja | Caja | Comercial |
| calidad | Calidad | Operación |
| calendario | Calendario | Equipo |
| canales | Canales | Equipo |
| capacitacion | Capacitación | Personas |
| cartera | Cartera | Comercial |
| catalogos | Catálogos | Comercial |
| clientes | Clientes | Comercial |
| compras | Compras y órdenes | Comercial |
| consultoria | Consultoría | Equipo |
| contratacion | Contratación | Sectoriales |
| contratos | Contratos | Comercial |
| cotizaciones | Cotizaciones | Comercial |
| creditos | Créditos | Comercial |
| desempeno | Desempeño | Personas |
| documentos | Documentos | Equipo |
| donantes | Donantes | Comercial |
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
| notificaciones | Notificaciones | Equipo |
| obra | Obra | Sectoriales |
| pacientes | Pacientes | Sectoriales |
| ph | Propiedad horizontal | Operación |
| pos | Punto de venta | Comercial |
| produccion | Producción | Operación |
| proyectos | Proyectos | Operación |
| puestos | Puestos de servicio | Sectoriales |
| reclutamiento | Reclutamiento | Personas |
| reportes | Reportes | Equipo |
| restaurante | Restaurante | Sectoriales |
| riesgos | Centro de Riesgos | Personas |
| socios | Socios | Sectoriales |
| suscripciones | Suscripciones | Comercial |
| suscriptores | Suscriptores | Sectoriales |
| tickets | Tickets | Equipo |
| tienda | Tienda virtual | Comercial |
| tiempos | Tiempos | Operación |
| trazabilidad | Trazabilidad | Operación |

`configuracion` y `dashboard` son el shell: no conmutables, no aparecen en
presets.

---

## Sector por sector

### 1. agro — Agro y agroindustria
**Vertical:** `agro` · **Subsectores:** 4 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| agro-ganaderia | 22: agro asistencia calendario calidad canales clientes compras cotizaciones documentos empleados facturacion flota hseq ia inventario mantenimiento nomina produccion reportes riesgos tickets trazabilidad | Administrador/a de finca, Veterinario/a de campo, Capataz |
| agro-permanente | 21: agro asistencia calendario calidad canales clientes compras cotizaciones documentos empleados facturacion flota hseq ia inventario mantenimiento nomina reportes riesgos tickets trazabilidad | Administrador/a de finca, Técnico/a de campo, Capataz |
| agro-poscosecha | 23: anterior + catalogos produccion | Administrador/a, Supervisor/a de calidad, Operario/a |
| agro-transitorio | 21: anterior − trazabilidad + produccion | Administrador/a de finca, Técnico/a de campo, Capataz |

**Revisión:** presets y roles completos; `calidad` ya está en el preset con
permisos en los roles de campo. Falta profundidad dentro de `agro`:
sanidad/fitosanitario, riego, clima, certificaciones (GlobalGAP). La ganadería
probablemente merece pantalla propia: un semoviente no es un lote.

### 2. alimentos — Restaurantes y alimentos
**Vertical:** `restaurante` · **Subsectores:** 5 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| alimentos-bar | 17: asistencia caja calendario calidad canales catalogos clientes compras documentos empleados facturacion ia inventario nomina reportes restaurante tickets | Bartender, Mesero/a, Cajero/a |
| alimentos-catering | 20: asistencia calendario calidad canales catalogos clientes compras contratos cotizaciones documentos empleados facturacion hseq ia inventario nomina proyectos reportes restaurante tickets | Chef, Coordinador/a de eventos, Cocina |
| alimentos-panaderia | 19: asistencia caja calendario calidad canales catalogos compras documentos empleados facturacion hseq ia inventario nomina pos produccion reportes restaurante tickets | Panadero/a, Vendedor/a |
| alimentos-rapida | 20: asistencia caja calendario calidad canales catalogos compras documentos ecommerce empleados facturacion hseq ia inventario nomina pos reportes restaurante tickets tienda | Mostrador y caja, Cocina, Repartidor/a |
| alimentos-salon | 18: asistencia caja calendario calidad canales catalogos clientes compras documentos empleados facturacion hseq ia inventario nomina reportes restaurante tickets | Mesero/a, Cocina, Cajero/a |

**Revisión:** `caja` y `pos` ya son transversales (migraciones 43-44) y
`calidad` entró en el preset (migración 56) con permisos en cocina/panadería.
Falta escandallo (la tabla `menu_item_ingredients` existe sin pantalla),
delivery (`restaurant_deliveries` idem) y propinas.

### 3. comercio — Comercio y retail
**Vertical:** ninguno (opera con `pos` + `caja`) · **Subsectores:** 5 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| comercio-farmacia | 18: … + pos trazabilidad − cotizaciones tienda | Regente de farmacia, Cajero/a |
| comercio-ferreteria | 17: … + pos − tienda | Vendedor/a de mostrador, Jefe/a de bodega, Cajero/a |
| comercio-mayorista | 17: … + contratos flota − caja pos tienda | Ejecutivo/a de ventas, Despachador/a |
| comercio-retail | 17: … + pos − cotizaciones | Vendedor/a, Cajero/a, Supervisor/a de inventario |
| comercio-super | 19: … + flota mantenimiento pos − cotizaciones | Cajero/a, Reponedor/a, Supervisor/a |

**Revisión:** el mostrador quedó resuelto (pos/caja). Falta `marketing` y
fidelización; en mayorista, listas de precio por cliente y cupo de crédito;
en farmacia, lotes y vencimientos.

### 4. construccion — Construcción e infraestructura
**Vertical:** `obra` · **Subsectores:** 4 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| construccion-civil | 22: asistencia calendario canales clientes compras contratos cotizaciones documentos empleados facturacion firmas flota hseq ia inventario mantenimiento nomina obra proyectos reportes riesgos tickets | Residente de obra, Almacenista, Administrativo/a de obra |
| construccion-interv | 19: − compras flota hseq inventario mantenimiento + trazabilidad | Supervisor/a, Inspector/a, Coordinador/a |
| construccion-mep | 22: + catalogos | Ingeniero/a, Instalador/a, Almacenista |
| construccion-remodel | 21: + catalogos − hseq | Diseñador/a, Oficial de obra, Administrativo/a |

**Revisión:** el vertical `obra` ya está (migración 57): presupuestos por
capítulo, APU y cortes de avance, con permisos en residente/ingeniero/
diseñador/supervisor. Falta bitácora de obra y actas; `tiempos` aplica a la
parte de cuadrillas y aún no está en el preset.

### 5. ecommerce — Ecommerce y venta en línea
**Vertical:** `ecommerce` (en grupo Comercial) · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| ecommerce (sector) | 17: asistencia calendario canales catalogos clientes compras cotizaciones documentos ecommerce empleados facturacion ia inventario nomina reportes tickets tienda | Gestor/a de tienda, Atención al cliente, Despacho |

**Revisión:** falta `marketing` (campañas; los cupones viven dentro de
ecommerce), `integraciones` (pasarela, transportadora) y subsectores
(marketplace, tienda propia, dropshipping).

### 6. educacion — Educación
**Vertical:** `estudiantes` · **Subsectores:** 4 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| educacion-academia | 17: asistencia calendario canales capacitacion cartera clientes documentos empleados estudiantes facturacion firmas ia nomina notificaciones reportes suscripciones tickets | Instructor/a, Recepción |
| educacion-colegio | 21: + contratos desempeno inventario reclutamiento | Docente, Coordinador/a, Secretaría |
| educacion-instituto | 20: + contratos inventario proyectos | Docente, Coordinador/a, Admisiones |
| educacion-universidad | 23: + contratos desempeno inventario proyectos reclutamiento trazabilidad | Docente, Coordinador/a, Admisiones |

**Revisión:** `suscripciones` (mensualidad), `cartera` (pensiones) y
`notificaciones` (migraciones 48-50) ya están en el preset y en los roles de
secretaría/admisiones/recepción. Falta notas por periodo y boletín dentro de
`estudiantes` y portal del acudiente.

### 7. energia — Energía y renovables
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| energia (sector) | 22: asistencia calendario canales catalogos clientes compras contratos cotizaciones documentos empleados facturacion firmas hseq ia inventario mantenimiento nomina obra proyectos reportes riesgos tickets | Ingeniero/a de proyecto, Técnico/a de campo, Supervisor/a HSE |

**Revisión:** `obra` ya está en el preset (migración 57). Falta subsectores
(solar, eólica, eficiencia, O&M) y contratos de disponibilidad en
mantenimiento.

### 8. financiero — Financiero y seguros
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| financiero (sector) | 20: asistencia calendario canales cartera clientes consultoria contratos cotizaciones creditos desempeno documentos empleados facturacion firmas ia nomina reportes riesgos tickets trazabilidad | Asesor/a, Analista de riesgos, Cobranza |

**Revisión:** `creditos` (migración 52) y `cartera` (migración 49) ya están,
con permisos en asesor/riesgos/cobranza. Falta subsectores (cooperativa,
corredora, fintech, cobranza).

### 9. fitness-bienestar — Fitness y bienestar
**Vertical:** `socios` · **Subsectores:** 4 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| fitness-centro | 19: asistencia caja calendario canales clientes contratos documentos empleados facturacion firmas ia inventario nomina notificaciones pacientes reportes socios suscripciones tickets | Terapeuta, Recepcionista |
| fitness-estudio | 18: − inventario + capacitacion | Instructor/a, Recepcionista |
| fitness-gimnasio | 19: + inventario mantenimiento | Instructor/a, Recepcionista, Encargado/a de sala |
| fitness-spa | 21: + catalogos cotizaciones pos | Terapeuta, Recepcionista |

**Revisión:** `socios` (migración 42) resolvió el hueco mayor, `suscripciones`
(48) cerró la membresía y `notificaciones` (50) ya está en el preset; los tres
con permisos en recepción. Falta marcar asistencia desde la pantalla de
clases, control de acceso y `marketing`.

### 10. gobierno — Sector público
**Vertical:** `contratacion` · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| gobierno (sector) | 17: asistencia calendario canales compras contratacion contratos documentos empleados firmas hseq ia nomina proyectos reportes riesgos tickets trazabilidad | Contratista, Jurídico/a, Supervisión |

**Revisión:** el vertical `contratacion` ya está (migración 60): procesos,
pliegos y oferentes con permisos en contratista/jurídico/supervisión. Falta
PQRS con término legal — `tickets` se le parece y no es lo mismo.

### 11. hoteleria — Hotelería y turismo
**Vertical:** `hoteleria` · **Subsectores:** 4 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| hoteleria-finca | 18: agro asistencia caja calendario canales clientes documentos empleados facturacion hoteleria ia inventario mantenimiento nomina notificaciones reportes restaurante tickets | Recepción, Guía de campo |
| hoteleria-hostal | 15: − restaurante mantenimiento | Recepción, Ama de llaves |
| hoteleria-hotel | 18: + hseq | Recepción, Ama de llaves, Mantenimiento |
| hoteleria-operador | 15: − hoteleria restaurante inventario mantenimiento caja + contratos cotizaciones proyectos | Agente de viajes, Operador/a de itinerario |

**Revisión:** `notificaciones` ya está en el preset (migración 50). Falta
tarifas por temporada, canales de reserva, housekeeping
(`room_cleaning_tasks` existe sin pantalla) y `caja` ya está incluida.

### 12. inmobiliario — Inmobiliario
**Vertical:** `inmobiliario` · **Subsectores:** 3 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| inmobiliario-arriendo | 17: asistencia calendario canales clientes contratos documentos empleados facturacion firmas ia inmobiliario mantenimiento nomina notificaciones reportes suscripciones tickets | Asesor/a, Administrador/a, Conserje |
| inmobiliario-corretaje | 18: + cotizaciones desempeno − mantenimiento | Agente inmobiliario/a, Coordinador/a, Gestor/a de cierre |
| inmobiliario-ph | 20: + hseq ph riesgos | Administrador/a, Consejo de administración, Conserje |

**Revisión:** el vertical `ph` ya está (migración 59): asambleas, cuotas por
unidad y zonas comunes, con permisos en administrador/consejo. `cartera`
(migración 49), `suscripciones` (48) y `notificaciones` (50) también en el
preset. Falta liquidación al propietario y portal del inquilino.

### 13. logistica — Logística y transporte
**Vertical:** ninguno · **Subsectores:** 3 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| logistica-bodegaje | 19: asistencia calendario canales catalogos clientes compras contratos cotizaciones documentos empleados facturacion hseq ia inventario mantenimiento nomina reportes riesgos tickets | Jefe/a de bodega, Operario/a, Comercial |
| logistica-carga | 19: + flota − catalogos | Conductor/a, Despachador/a, Comercial |
| logistica-ultima | 21: + ecommerce tienda | Repartidor/a, Despachador/a, Soporte al cliente |

**Revisión:** falta `rutas` — `public.delivery_routes` existe desde la
migración 20 con pantalla en Flota (crear/estado/borrar) pero sin manifiestos,
guías, prueba de entrega ni portal de rastreo.

### 14. manufactura — Manufactura y producción
**Vertical:** ninguno propio (usa `produccion`) · **Subsectores:** 4 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| manufactura-alimentos | 22: … + trazabilidad | Jefe/a de producción, Operario/a, Control de calidad |
| manufactura-metal | 22: … + proyectos | Jefe/a de producción, Operario/a, Control de calidad |
| manufactura-plastico | 22: … + trazabilidad | Jefe/a de producción, Operario/a, Control de calidad |
| manufactura-textil | 22: … + tienda | Diseñador/a, Patronista, Despachador/a |

**Revisión:** `calidad` ya está en el preset (migración 56) con permisos en
control de calidad/jefatura/patronista. Falta lista de materiales (BOM)
dentro de `produccion` y vencimientos en manufactura-alimentos.

### 15. medios — Medios y publicidad
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| medios (sector) | 17: asistencia calendario canales clientes contratos cotizaciones documentos empleados facturacion firmas ia inventario nomina proyectos reportes tickets tiempos | Creativo/a, Productor/a, Comercial |

**Revisión:** `tiempos` ya está en el preset (migración 47) con permisos en
los tres roles. Falta aprobación de piezas.

### 16. mineria — Minería y extractivas
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| mineria (sector) | 20: asistencia calendario canales compras contratos documentos empleados firmas flota hseq ia inventario mantenimiento nomina obra proyectos reportes riesgos tickets trazabilidad | Ingeniero/a de mina, Supervisor/a HSE, Almacenista |

**Revisión:** `obra` ya está en el preset (migración 57). Falta producción por
frente dentro de `produccion` y permisos/títulos con vencimientos (hoy caben
en `documentos` sin alertas).

### 17. ong — ONG y fundaciones
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| ong (sector) | 16: asistencia calendario canales capacitacion clientes contratos documentos donantes empleados firmas ia nomina proyectos reportes tickets trazabilidad | Coordinador/a de proyectos, Voluntariado, Finanzas |

**Revisión:** `donantes` ya está (migración 53): donaciones y rendición de
cuentas, con permisos en coordinación y finanzas.

### 18. otro — Otro
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** — (sin matriz, por diseño)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| otro (sector) | 11: asistencia calendario canales clientes documentos empleados firmas ia nomina reportes tickets | — |

**Revisión:** correcto así. Es el caso «sin opinión»: empieza con lo esencial
y el cliente activa el resto a mano.

### 19. salud — Salud
**Vertical:** `pacientes` · **Subsectores:** 6 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| salud-consultorio | 17: asistencia caja calendario canales cartera clientes consultoria documentos empleados facturacion firmas ia nomina notificaciones pacientes reportes tickets | Médico/a, Enfermero/a, Recepcionista |
| salud-estetica | 20: + catalogos cotizaciones inventario | Especialista, Recepcionista |
| salud-ips | 23: + desempeno hseq inventario mantenimiento riesgos trazabilidad | Médico/a, Enfermero/a, Facturador/a, Recepcionista |
| salud-laboratorio | 21: + catalogos hseq inventario riesgos trazabilidad − consultoria | Analista de laboratorio, Recepcionista |
| salud-odontologia | 21: + catalogos cotizaciones inventario riesgos − trazabilidad | Odontólogo/a, Auxiliar dental, Recepcionista |
| salud-veterinaria | 22: + catalogos inventario pos tienda hseq riesgos − consultoria trazabilidad | Veterinario/a, Auxiliar veterinario, Recepción y caja |

**Revisión:** odontología tiene profundidad completa (migración 45: odontograma
FDI, planes de tratamiento por pieza, laboratorio dental). Veterinaria es el
siguiente hueco: falta mascota-vs-propietario, vacunas, peluquería y
hospitalización (mismo patrón que odontología). Transversal al sector faltan
radiografías, consentimientos y `portal` del paciente. `cartera` (copagos y
EPS), `notificaciones` de cita y los permisos en recepción ya están
(migraciones 49-50 y pase 61).

### 20. seguridad — Seguridad y vigilancia
**Vertical:** `puestos` · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| seguridad (sector) | 20: asistencia calendario canales capacitacion clientes contratos cotizaciones documentos empleados facturacion firmas hseq ia inventario nomina puestos reportes riesgos tickets trazabilidad | Supervisor/a de puesto, Guarda, Comercial |

**Revisión:** el vertical `puestos` ya está (migración 55): turnos por puesto
y cobertura, con permisos en supervisión y comercial. Falta rondas, minuta y
dotación. `asistencia` cubre la ausencia del empleado; `puestos` cubre el
puesto que no puede quedar vacío.

### 21. servicios — Servicios profesionales
**Vertical:** ninguno · **Subsectores:** 5 · **Roles:** ✓

| Subsector | Módulos (n) | Roles sugeridos |
|---|---|---|
| servicios-agencia | 20: … + desempeno reclutamiento | Creativo/a, Ejecutivo/a de cuenta, Reclutador/a |
| servicios-consultoria | 19: … + desempeno | Consultor/a, Analista, Gerente/a de cuenta |
| servicios-contable | 18: … + trazabilidad − proyectos | Contador/a, Auxiliar contable, Socio/a |
| servicios-legal | 19: … + trazabilidad | Abogado/a, Paralegal |
| servicios-ti | 20: … + desempeno inventario | Ingeniero/a, Soporte, Gerente/a |

**Revisión:** `tiempos` ya está en el preset (migración 47) con permisos en
los roles operativos, y `cartera` (migración 49) en gerencia/contabilidad/
abogacía. En contable falta el calendario tributario y en legal, expedientes
y términos.

### 22. tecnologia — Tecnología y software
**Vertical:** ninguno · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| tecnologia (sector) | 18: asistencia calendario canales clientes contratos cotizaciones desempeno documentos empleados facturacion ia nomina proyectos reclutamiento reportes suscripciones tickets tiempos | Ingeniero/a, Soporte, Gerente/a |

**Revisión:** `tiempos` (migración 47) y `suscripciones` (migración 48) ya
están con permisos en ingeniería/gerencia. Falta subsectores (SaaS, a la
medida, integrador).

### 23. telecomunicaciones — Telecomunicaciones
**Vertical:** `suscriptores` · **Subsectores:** 0 · **Roles:** ✓ (matriz de sector)

| Entrada | Módulos (n) | Roles sugeridos |
|---|---|---|
| telecomunicaciones (sector) | 18: asistencia calendario canales clientes contratos cotizaciones documentos empleados facturacion flota ia inventario mantenimiento nomina proyectos reportes suscriptores tickets | Técnico/a instalador/a, Soporte de red, Comercial |

**Revisión:** el vertical `suscriptores` ya está (migración 54): planes,
activaciones, suspensiones y consumo, con permisos en soporte/comercial.
Un ISP con dos mil clientes ya no los lleva en `clientes`.

---

## Revisión final — huecos ordenados por impacto

Todo sector entrega hoy: preset de módulos coherente (con delta por
subsector), matriz de roles sugeridos, y acceso vía wizard. Lo que falta se
divide en tres capas:

### Capa 1 — Transversales (módulos que faltan en todos los sectores)

| Módulo | Para quién | Estado |
|---|---|---|
| ~~`tiempos`~~ ✅ | servicios, tecnologia, medios, construccion, legal | hecho (mig. 47) — horas facturables |
| ~~`reportes`~~ ✅ | todos (SPINE) | hecho (mig. 51) — reportes guardados por módulo |
| ~~`notificaciones`~~ ✅ | salud, educacion, fitness, inmobiliario, hoteleria | hecho (mig. 50) — recordatorios |
| `portal` | paciente, acudiente, inquilino, huésped | no existe |
| `marketing` | comercio, alimentos, salud, fitness | no existe |
| `integraciones` | pasarela, facturación electrónica, WhatsApp | no existe (billing webhook sí) |
| ~~`cartera`~~ ✅ | financiero, salud, educacion, servicios | hecho (mig. 49) — cuentas por cobrar y acuerdos de pago |
| ~~`suscripciones`~~ ✅ | fitness, educacion, tecnologia, inmobiliario | hecho (mig. 48) — planes y cobro recurrente |
| `sucursales` | todos | tabla `sites` existe (mig. 31), sin pantalla propia |

### Capa 2 — Verticales (un sector sin su pantalla de negocio)

| Vertical | Sector | Estado |
|---|---|---|
| ~~`obra`~~ ✅ | construccion, energia, mineria | hecho (mig. 57) — presupuestos, APU, avance por capítulo |
| ~~`suscriptores`~~ ✅ | telecomunicaciones | hecho (mig. 54) |
| ~~`puestos`~~ ✅ | seguridad | hecho (mig. 55) |
| ~~`donantes`~~ ✅ | ong | hecho (mig. 53) |
| ~~`creditos`~~ ✅ | financiero | hecho (mig. 52) |
| `rutas` | logistica | ✅ pantalla de rutas en Flota (crear/estado/borrar) |
| ~~`ph`~~ ✅ | inmobiliario | hecho (mig. 59) — asambleas, cuotas, zonas comunes |
| ~~`calidad`~~ ✅ | manufactura, alimentos, agro | hecho (mig. 56) |
| ~~`contratacion`~~ ✅ | gobierno | hecho (mig. 60) — procesos, pliegos, oferentes |

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

1. ~~Verticales~~ ✅ — `suscriptores`, `puestos`, `donantes`, `creditos`,
   `obra`, `ph`, `contratacion` y `calidad` hechos (migraciones 52-60), con
   presets y roles.
2. ~~Transversales operativos~~ ✅ — `reportes`, `notificaciones`,
   `suscripciones`, `cartera` y `tiempos` hechos (migraciones 47-51).
3. ~~Pase de roles~~ ✅ — migración 61: los módulos 47-60 entran a las
   matrices sugeridas de los sectores que los prenden.
4. Veterinaria vertical (patrón odontología ya probado)
5. Transversales restantes: `portal`, `marketing`, `integraciones`
6. Profundidad: radiografías, notas estudiantes, tarifas hotelería,
   sanidad/riego agro, BOM en producción.

Cada uno de esos módulos entra por el mismo camino: migración con
`app.apply_standard_rls`, entrada en el registro, preset en `sector_modules`,
matriz de roles en `sector_roles`, y los tests de pin lo mantienen
sincronizado.
