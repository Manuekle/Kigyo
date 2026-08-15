# Plan: profundidad sectorial, sidebar y el lío cuenta/empresa

> **Estado hoy (2026-08-14):** este documento es el plan histórico. Gran parte
> de lo que aquí decía «no existe» ya se construyó: verticales para los quince
> sectores (migraciones 42, 52-60), transversales (`tiempos`, `suscripciones`,
> `cartera`, `notificaciones`, `reportes`; migraciones 47-51), caja/pos
> transversales (43-44), odontología (45), roles sugeridos (46 + pase 61),
> sidebar con vertical arriba, grupos por sector y colapso persistido, y la
> separación cuenta→empresa (26-28, 31, 36-41). El inventario vivo está en
> `docs/SECTORES_SUBSECTORES_MODULOS.md`; este archivo conserva el diagnóstico
> original para no falsificar el registro.

Estado del código al escribir esto: rama `feat/design-system-refresh`, 40 migraciones,
37 entradas en `src/lib/modules/registry.ts`, 22 sectores y 45 subsectores en
`supabase/migrations/*_29_sectors_and_dependencies.sql`.

---

## 1. Diagnóstico

### 1.1 Siete verticales para veintidós sectores

`REGISTRY` tiene módulo propio para siete sectores:

| Sector | Vertical |
|---|---|
| salud | `pacientes` |
| educacion | `estudiantes` |
| alimentos | `restaurante` |
| agro | `agro` |
| inmobiliario | `inmobiliario` |
| hoteleria | `hoteleria` |
| ecommerce | `ecommerce` |

Los otros **quince** se arman solo con módulos genéricos: construccion, energia,
manufactura, comercio, servicios, tecnologia, logistica, financiero, mineria,
telecomunicaciones, seguridad, medios, ong, gobierno, otro, fitness-bienestar.

El peor caso es `fitness-bienestar` (migración 33). Su preset es
`PEOPLE + clientes + inventario + firmas + tickets + SPINE`. Un gimnasio no tiene
dónde registrar un socio, una membresía, una clase ni un check-in. El sector existe
en el picker y no entrega nada que un gimnasio reconozca.

### 1.2 El subsector cambia la lista, no la profundidad

`SUBSECTOR_PRESETS['salud-odontologia']` es
`{ add: ['catalogos','cotizaciones'], remove: ['hseq','trazabilidad'] }`.

Es decir: un odontólogo recibe exactamente las mismas pantallas que un consultorio
general. Entra a `/dashboard/pacientes` y encuentra historia clínica genérica.

Tablas de salud en la base hoy: `patients`, `patient_visits`, `patient_appointments`,
`patient_prescriptions`, `patient_lab_results`. Nada dental.

Contrastado con la lista que pediste para odontología:

**Ya existe** — Dashboard, Pacientes, Citas (`calendario` + `patient_appointments`),
Facturación, Inventario, Recetas (`patient_prescriptions`), Profesionales y
Asistentes (`empleados`), Configuración, Usuarios y permisos, Firma digital
(`firmas`), Documentos, Asistente IA.

**Existe a medias** — Presupuestos (`cotizaciones` genérico, sin piezas ni
tratamientos), Sucursales (tabla `sites` y paso de onboarding, sin pantalla),
Comunicación con pacientes (`canales` es chat interno del equipo, no con el paciente).

**No existe** — Odontograma, historia clínica odontológica, tratamientos y planes,
Caja, insumos odontológicos, laboratorio dental, radiografías e imágenes,
seguimiento de tratamientos, recordatorios y notificaciones, reportes, marketing y
fidelización, portal del paciente, teleodontología, integraciones.

Catorce de veintinueve. Y ese hueco se repite en cada sector con distinta ropa.

### 1.3 Falta una capa transversal, no solo verticales

Varias cosas de tu lista no son de odontología: las pide casi todo sector y hoy no
existen en ninguno.

- **Caja** — hay `cash_sessions`, pero enterrada dentro de `restaurante`
  (migración 25). Clínica, retail, spa y hotel la necesitan igual.
- **Reportes** — no hay módulo de reportes en ningún sector.
- **Recordatorios y notificaciones** — no existe. Ni cita, ni pago, ni vencimiento.
- **Portal externo** (paciente, estudiante, inquilino, cliente) — no existe.
- **Marketing y fidelización** — no existe.
- **Integraciones** (pasarela, facturación electrónica, WhatsApp) — no existe.
- **Sucursales** — tabla sí, pantalla no.

### 1.4 Sidebar

`src/lib/data/nav.ts` deriva el nav de `MODULE_GROUPS`:
`Personas · Operación · Comercial · Colaboración · Sectoriales`. Problemas:

1. **El vertical queda de último.** Un odontólogo ve Pacientes debajo de Nómina,
   Producción y Cotizaciones. Es su pantalla principal y está en el sótano.
2. **«Sectoriales» es vocabulario de la plataforma, no del negocio.** Para una
   clínica nada es «sectorial»: eso *es* la clínica.
3. **El orden es idéntico para los 22 sectores.** Un restaurante y una constructora
   ven la misma jerarquía.
4. **«Colaboración» es un cajón de sastre:** Canales, Tickets, Firmas, Documentos,
   Contratos, Calendario, Consultoría e IA. Contratos es comercial/legal; IA no es
   colaboración.
5. **`ordenes-compra` aparece como ítem propio** junto a Compras, siendo un alias
   de la misma cosa (`registry.ts`, `aliases`).
6. **Configuración no está en el nav**, solo en el menú de usuario del pie.
7. **Sin buscador, sin fijar favoritos, sin colapsar grupos.** Con 37 ítems hace falta.

### 1.5 Cuenta y empresa

Tienes razón: hoy son casi lo mismo, dos veces.

- `/register` (`src/app/(auth)/register/page.tsx`) pide nombre, **empresa**,
  **sector**, email y contraseña. Crea cuenta + empresa + sector de un golpe.
- `/onboarding` (`src/app/onboarding/client.tsx`) vuelve a pedir **nombre de la
  cuenta** (paso 1) y **nombre de la empresa** (paso 2). Ya los dio.
- `src/app/(dashboard)/dashboard/empresas/client.tsx` ofrece **«Nueva cuenta»** y
  **«Nueva empresa»** uno al lado del otro (migración 37 habilitó multi-cuenta).
  Nadie fuera del equipo sabe cuál elegir.
- El sector es **editable siempre** en Configuración: `sectorCards` son botones y
  `updateSector` escribe `company_type` cuando quiera.

---

## 2. Plan

### Fase 1 — Cuenta y empresa (arreglo conceptual, primero)

1. **Una cuenta por usuario.** Quitar el botón «Nueva cuenta» de
   `empresas/client.tsx`. Dejar `createAccount` como función de soporte o borrarla.
   `public.accounts` se queda: es el plan y la facturación, y sigue siendo correcta.
2. **`/register` solo registra a la persona:** nombre, email, contraseña. Sin
   empresa, sin sector. La cuenta nace con el nombre de la persona.
3. **`/onboarding` es «crea tu primera empresa».** Pasos: Empresa → Sector →
   Subsector → Módulos → Sucursales → Equipo. Se elimina el paso «Cuenta».
4. **«Nueva empresa» usa el mismo wizard**, no un modal aparte. Una implementación,
   no dos que se separan con el tiempo.
5. **Sector inmutable en la práctica.** Recomendación en vez de bloqueo total:
   libre mientras la empresa no tenga datos en su vertical; bloqueado en cuanto los
   tenga, con el mensaje «para operar otro sector, crea otra empresa». Un bloqueo
   absoluto castiga el error de tecleo del primer día y obliga a borrar y rehacer.
   Se implementa con un trigger sobre `organizations` (los módulos siguen editables).

### Fase 2 — Sidebar

1. **El vertical sube**, justo debajo de Dashboard, bajo una etiqueta con el nombre
   del negocio («Clínica», «Hotel», «Finca»), no «Sectoriales».
2. **Orden de grupos por sector.** Cada sector declara su `groupOrder`. Restaurante
   abre en Operación; servicios profesionales, en Comercial.
3. **Repartir «Colaboración»:** Contratos → Comercial. IA → fijo arriba. El resto
   (Canales, Tickets, Documentos, Calendario, Firmas, Consultoría) → «Equipo».
4. **`ordenes-compra` sale del nav** y pasa a ser pestaña dentro de Compras.
5. **Configuración con ítem propio** al pie del nav.
6. **Buscador, grupos colapsables y estado persistido.**

### Fase 3 — Profundidad del vertical, por subsector

Subrutas dentro del módulo, no módulos nuevos: `enabled_modules` no debe inflarse
con cosas que solo un subsector entiende.

Odontología, dentro de `/dashboard/pacientes`:

| Pantalla | Tablas nuevas |
|---|---|
| Odontograma | `dental_charts`, `dental_chart_teeth` (pieza, superficie, estado) |
| Historia clínica odontológica | extiende `patient_visits` |
| Planes de tratamiento | `treatment_plans`, `treatment_plan_items` |
| Presupuesto | reutiliza `quotes` con origen = plan de tratamiento |
| Laboratorio dental | `dental_lab_orders` |
| Radiografías e imágenes | `patient_images` sobre el storage que ya existe |
| Consentimientos | reutiliza `firmas` |
| Seguimiento | vista sobre `treatment_plan_items` |

El mismo ejercicio queda pendiente para los otros seis verticales y sus 39
subsectores restantes.

### Fase 4 — Módulos transversales nuevos

Sirven a muchos sectores; por eso son módulos y no subrutas.

| Módulo | Para quién |
|---|---|
| `caja` | Saca `cash_sessions` de restaurante. Clínica, retail, spa, hotel |
| `reportes` | Todos |
| `notificaciones` | Recordatorio de cita, pago y vencimiento. Email y WhatsApp |
| `portal` | Portal externo: paciente, estudiante, inquilino, cliente |
| `marketing` | Clínica, gimnasio, restaurante, retail |
| `integraciones` | Pasarela de pago, facturación electrónica, WhatsApp |
| `sucursales` | Pantalla real para `sites` |

### Fase 5 — Los quince sectores sin vertical

✅ **Hecho** (migraciones 42, 52-60). Orden propuesto era por hueco más grande
primero, y así se ejecutó:

1. `fitness-bienestar` → módulo `socios`: membresías, clases, check-in, planes.
   Es el sector más vacío del producto.
2. `comercio` → `pos`: venta de mostrador. Hoy solo hay `tienda`, que es catálogo web.
3. `servicios` → `tiempos`: horas facturables. El preset dice «se factura tiempo» y
   no hay dónde registrarlas.
4. `financiero` → `cartera`: créditos, cuotas, mora.
5. `logistica` → pantalla para `delivery_routes`, que ya existe en la base (mig. 20).
6. `construccion` · `mineria` · `energia` → `presupuesto de obra`: APU y avance por
   capítulo, sobre `proyectos`.
7. `tecnologia` · `medios` → cubiertos por `proyectos` + `tiempos`.
8. `gobierno` · `ong` → cubiertos por `contratos` + `trazabilidad`; falta `donantes`.

### Fase 6 — Roles por sector

✅ **Hecho** — migración 46 (`20260814100000_46_sector_roles.sql`). El
administrador ya no arma la matriz de 37 módulos × 4 acciones a mano:
`public.sector_roles` trae la matriz sugerida por subsector, con permisos solo
del vocabulario que ya existe y sin `configuracion:manage` en ningún rol.
`app.seed_default_roles` siembra los sugeridos como roles `is_system` con sus
grants al crear la empresa, y la RPC pública `seed_suggested_roles(p_org_id)`
es idempotente: es el botón de Configuración → Roles y permisos para volver a
sembrarlos si se borraron.

Cobertura: los 51 subsectores del catálogo tienen matriz. 28 entraron en el
primer corte (salud, comercio, alimentos, hotelería, fitness y agro) y 23 en el
segundo (construcción, manufactura, servicios, logística, inmobiliario y
educación). El espejo TypeScript vive en `src/lib/suggested-roles.ts` y un test
pina TS↔DB en ambas direcciones: una matriz nueva de un solo lado rompe el test.

Los roles sugeridos son editables y borrables, y no conceden administración.
Ejemplos de las matrices sembradas:

- Odontología: Odontólogo, Asistente dental, Recepcionista, Administrador.
- Hotel: Recepción, Ama de llaves, Mantenimiento, Gerente.
- Restaurante: Mesero, Cocina, Caja, Administrador.

Cada uno con su matriz de permisos precargada y editable.

---

## 3. Orden recomendado

Fase 1 antes que nada: es barata, es conceptual y todo lo demás se apoya en ella.
Fase 2 después, por la misma razón. Fase 3 es el grueso del trabajo y conviene
hacerla completa para **un** subsector (odontología) antes de replicar, para que el
patrón se pruebe con un caso real y no con siete a la vez.
