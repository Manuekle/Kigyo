# Arquitectura actual de Kigyo

**Fecha:** 2026-08-21 (revisado). **Fuente primaria:** código actual, base de
datos remota introspeccionada con `psql`, migraciones, tipos generados, pruebas
y scripts. **No se proponen cambios.**

> **Sobre esta revisión.** El documento se escribió el 2026-08-20 y se verificó
> el 21 contra la base remota, no solo contra los archivos. Lo que se comprobó y
> cambió está listado en §20; lo importante para quien lo lea ahora:
>
> - Su inventario de tablas era **exacto**: 198 nombres, ninguno inventado.
>   Faltaban cinco, ya añadidas.
> - Estaba al día hasta la migración 96. Entre la 97 y la 104 cambiaron el
>   embudo comercial, la suspensión por impago, el inventario y el IVA — todo
>   ello incorporado.
> - De sus siete riesgos, **cinco eran reales** (tres ya corregidos, dos
>   abiertos), **uno era un falso positivo** que habría roto la facturación si
>   alguien lo «arreglaba», y uno era un artefacto de la sesión que lo escribió.
>   Ver §17.

# 1. Resumen del proyecto

Kigyo es un SaaS B2B multiempresa para centralizar People Operations, CRM, ERP, POS, documentos, colaboración, operaciones sectoriales y consultas mediante IA.

Resuelve gestión dispersa de empleados, nómina, clientes, ventas, compras, inventario, proyectos, documentos, tickets, caja y procesos sectoriales.

Usuarios identificables: owners, administradores, billing, RRHH, empleados, vendedores, compradores, cajeros, supervisores y profesionales de sectores verticales.

El mercado inferido es Colombia: aparecen COP, DIAN, PILA, Wompi y nómina colombiana.

Planes implementados en `src/lib/plans.ts`:

| Plan | Empresas | Sites/empresa | Asientos |
|---|---:|---:|---:|
| `starter` | 1 | 1 | 10 |
| `growth` | 3 | 5 | Ilimitados |
| `enterprise` | Ilimitadas | Ilimitadas | Ilimitados |

La página de precios declara desde `$80.000/mes`. Las contradicciones que este
documento señaló están corregidas: el FAQ afirmaba que «los tres planes cuestan
$0» (commit `862c28f`) y el JSON-LD de `app/layout.tsx` declaraba `price: '0'` a
los buscadores (corregido a un `AggregateOffer` cuyo `lowPrice` sale de
`lib/pricing.ts`, la misma fuente que dibuja las tarjetas, y pineado en
`plans.test.ts`).

Nota sobre qué módulos abre cada plan: `pedidos` y `contabilidad` estaban en
Enterprise sin que nadie lo decidiera —no aparecían en `plans.ts` y
`Enterprise = [...MODULE_KEYS]` recoge lo que `GROWTH` olvide— y pasaron a
Growth en el commit `8df5639`. `plans.test.ts` exige ahora que el salto a
Enterprise sean exactamente los tres módulos que su docstring nombra: `tienda`,
`ecommerce` y `trazabilidad`.

# 2. Arquitectura general

Stack:

- Next.js 16 App Router.
- React 19.
- TypeScript 5.
- Tailwind CSS v4 y `src/app/globals.css`.
- Supabase PostgreSQL, Auth, PostgREST, Storage y RLS.
- Zod.
- AI SDK y Microsoft Foundry.
- Vitest, Playwright y suites SQL RLS.

No existe backend separado. Next.js contiene Server Components, Server Functions, mutaciones, route handlers, autorización, integraciones, exportación y streaming IA.

```text
Browser
  → src/proxy.ts
      → refresh Supabase cookie
      → auth redirects
      → CSP/HSTS/security headers
  → Next App Router
      → pages/layouts/client components
      → src/server/queries
      → src/server/actions
      → src/server/mutations
      → src/app/api
          → Supabase SSR client + RLS
          → Supabase admin client + service_role
          → PostgreSQL RPCs/triggers
          → Storage/Auth
          → Polar/Wompi/Foundry/Azure Search/Meta
```

Estado de datos local:

- **104 migraciones** locales, `01` a `104`, todas aplicadas en remota.
- **203 tablas** públicas (201 + `inventory_movements` y `product_stock`).
- 2 tablas en `app`: `app.code_counters`, `app.rate_limits`.
- **6 extensiones**: `pgcrypto`, `vector`, `supabase_vault`, `uuid-ossp`,
  `pg_stat_statements`, `plpgsql`. La de vault importa: es donde viven los
  secretos de integraciones.
- 0 views públicas y 0 enums PostgreSQL. Los vocabularios son `text` con
  `check (col in (…))`, y `domain.test.ts` los parsea de las migraciones para
  que TypeScript y la base no se separen.
- **1296 políticas RLS** sobre 201 tablas con `force row level security`; cero
  tablas sin RLS.

No se encontraron workers, colas persistentes ni cron. POS offline usa IndexedDB en navegador. Notificaciones tienen reglas y log, pero no procesador de envío encontrado.

# 3. Estructura del proyecto

| Directorio | Propósito | Dependencias |
|---|---|---|
| `src/app` | Rutas, layouts, páginas, metadata y APIs | `src/lib`, `src/server`, `src/components` |
| `src/app/(auth)` | Login, registro y recuperación | Supabase Auth y `/api/auth` |
| `src/app/(dashboard)` | Layout y dashboard autenticado | Auth, queries, contexts, layout components |
| `src/app/api` | HTTP handlers auth, IA, billing, Wompi, demo, export | `src/lib/api`, providers, Supabase |
| `src/components/layout` | Sidebar, topbar, switcher, guard visual | Dashboard layout |
| `src/components/ui` | Modales, drawers, inputs, tablas visuales, KPIs | Todas las páginas |
| `src/components/ai` | Streaming, citas, aprobaciones, actividad IA | `/dashboard/ia` |
| `src/components/marketing` | Shell y componentes públicos | Marketing |
| `src/lib` | Auth, permisos, planes, módulos, IA, Supabase, contexts e integraciones | Toda la app |
| `src/server/queries` | Lecturas server-only | `page.tsx` |
| `src/server/actions` | Paginación y acciones server-side | Client Components |
| `src/server/mutations` | Escrituras `'use server'` | Client Components |
| `supabase/migrations` | DDL, RLS, RPCs, triggers, grants y storage | Runtime DB |
| `supabase/tests/rls` | Aislamiento y reglas SQL | `db:verify` |
| `scripts` | Push, tipos, seed, reset, planes, Foundry | Operación |
| `public` | Fuentes, iconos, manifest y assets | Layout/frontend |
| `docs` | Setup, arquitectura, contratos y contexto | Personas/agentes |

Convención dashboard:

```text
page.tsx → autorización + query server-side → client.tsx
                                      ├── formularios
                                      ├── tablas
                                      ├── drawers/modales
                                      └── Server Functions
```

Archivos centrales: `src/proxy.ts`, `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts`, `src/lib/modules/registry.ts`, `src/lib/plans.ts`, `src/lib/modules.ts`, `src/lib/data/nav.ts`, `src/server/queries/shared.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`.

# 4. Módulos funcionales

`src/lib/modules/registry.ts` contiene 57 módulos conmutables, 2 core y 2 aliases.

## Core

- `dashboard`: KPIs, actividad, firmas, auditoría, recomendaciones e insights.
- `configuracion`: empresa, cuenta, módulos, roles, permisos, invitaciones, sites, MFA, contraseña y billing.

## Personas

| Módulo | Funciones | Entidades |
|---|---|---|
| `empleados` | Directorio, perfiles, jerarquía, site, activos | `employees`, `employee_skills`, `employee_events`, `inventory_assets` |
| `asistencia` | Ausencias, vacaciones, incapacidades, salidas | `absences`, `vacation_balances`, `departures` |
| `nomina` | Periodos, líneas, conceptos, reglas, PILA | `payroll_periods`, `payroll_lines`, `payroll_rules`, `payroll_concepts`, `payroll_concept_lines` |
| `riesgos` | Riesgos, severidad, acciones, resolución | `risks`, `employees`, `projects` |
| `reclutamiento` | Vacantes, candidatos, etapas, conversión | `job_openings`, `candidates`, `employees` |
| `capacitacion` | Cursos, inscripciones, certificaciones | `courses`, `course_enrollments`, `certifications` |
| `desempeno` | Ciclos, evaluaciones, objetivos, encuestas | `review_cycles`, `evaluations`, `employee_goals`, `surveys` |

## Operación

| Módulo | Funciones | Entidades |
|---|---|---|
| `proyectos` | Proyectos, presupuesto, progreso, miembros | `projects`, `project_members` |
| `hseq` | Reportes, checklist, acciones correctivas | `hseq_reports`, `hseq_checklist_items`, `hseq_updates` |
| `inventario` | Activos, asignaciones, pedidos, stock | `inventory_assets`, `inventory_orders`, `products` |
| `mantenimiento` | Órdenes y tareas preventivas/correctivas | `work_orders`, `work_order_tasks` |
| `flota` | Vehículos, servicios, combustible, rutas | `vehicles`, `vehicle_services`, `fuel_logs`, `delivery_routes` |
| `produccion` | BOM, órdenes, etapas, merma | `production_boms`, `production_bom_items`, `production_orders`, `production_stages` |
| `trazabilidad` | Auditoría de solo lectura | `audit_log` |
| `tiempos` | Horas por persona, proyecto y tarifa | `time_entries` |
| `calidad` | Controles, lotes, no conformidades | `quality_checks`, `nonconformities` |
| `ph` | Zonas, cuotas, asambleas | `ph_zonas`, `ph_cuotas`, `ph_asambleas` |

## Comercial

| Módulo | Funciones | Entidades |
|---|---|---|
| `clientes` | Directorio, contactos, interacciones | `clients`, `client_contacts`, `client_interactions` |
| `leads` | Prospectos, actividades, conversión | `leads`, `lead_activities` |
| `cotizaciones` | Propuestas, líneas, pipeline | `quotes`, `quote_items`, `pipeline_stages` |
| `pedidos` | Pedidos B2B, líneas, despacho | `sales_orders`, `sales_order_items` |
| `facturacion` | Facturas, líneas, pagos, vencimientos | `invoices`, `invoice_items`, `invoice_payments` |
| `compras` | Requisiciones, aprobaciones, órdenes | `purchase_requests`, `purchase_orders`, `supplier_invoices`, `suppliers` |
| `catalogos` | Productos, SKU, precios, costos, barcode | `products` |
| `caja` | Turnos, arqueo, movimientos | `cash_sessions`, `cash_movements` |
| `pos` | Carrito, ventas, stock, pagos, offline | `pos_sales`, `pos_sale_items`, `pos_payments` |
| `tienda` | Catálogo público y storefront orders | `products`, `online_orders`, `online_order_items` |
| `ecommerce` | Pedidos online, cupones, devoluciones | `online_orders`, `discount_coupons`, `online_order_returns` |
| `contratos` | Vigencias, renovaciones, hitos | `contracts`, `contract_milestones`, `documents` |
| `suscripciones` | Planes, cobros recurrentes, renovaciones | `subscription_plans`, `subscriptions` |
| `cartera` | Cuentas por cobrar y acuerdos | `receivable_agreements`, `invoices` |
| `creditos` | Préstamos, cuotas, mora | `loans`, `loan_installments` |
| `donantes` | Donantes y donaciones | `donors`, `donations` |
| `marketing` | Campañas, plantillas, segmentación, puntos | `marketing_templates`, `marketing_campaigns`, `marketing_recipients`, `loyalty_points` |
| `portal` | Enlaces públicos y portal de tickets | `portal_links`, `portal_views`, `ticket_portal_tokens` |
| `contabilidad` | PUC, asientos, mayor y reportes | `gl_accounts`, `journal_entries`, `journal_lines`, `org_account_mappings` |

## Equipo

`canales` usa `channels`, `channel_members`, `channel_messages`. `tickets` usa `tickets`, `ticket_comments`, empleados y clientes. `firmas` usa `signature_requests` y documentos. `documentos` usa `documents`, carpetas, shares y chunks. `calendario` usa eventos y asistentes. `consultoria` usa consultas y eventos.

`ia` usa `ai_conversations`, `ai_messages`, `ai_insights`, `document_chunks`, `ai_usage_events`, `ai_monthly_budgets` y `recommendations`.

`notificaciones` usa `notification_rules`, `notification_log`, citas, facturas y suscripciones. `reportes` usa `saved_reports`. `integraciones` usa `integration_settings` y Vault.

## Sectoriales

| Módulo | Funciones | Entidades |
|---|---|---|
| `pacientes` | Historia, citas, laboratorios, odontología, veterinaria | `patients`, `patient_*`, `dental_*`, `treatment_*`, `vet_*` |
| `estudiantes` | Programas, matrículas, notas, horarios, asistencia | `academic_programs`, `students`, `student_enrollments`, `student_grades`, `class_schedules`, `student_attendance` |
| `restaurante` | Menú, mesas, comandas, reservas, domicilios | `menu_items`, `dining_tables`, `restaurant_orders`, `restaurant_reservations`, `restaurant_deliveries` |
| `agro` | Lotes, ciclos, tratamientos, riego, cosechas | `farm_lots`, `crop_cycles`, `crop_treatments`, `irrigation_events`, `harvests` |
| `inmobiliario` | Inmuebles, arrendamientos, recaudos | `properties`, `leases`, `lease_payments` |
| `hoteleria` | Habitaciones, reservas, temporadas, housekeeping | `hotel_rooms`, `reservations`, `hotel_seasons`, `hotel_season_rates`, `room_cleaning_tasks` |
| `socios` | Socios, planes, clases, reservas, check-in | `fitness_members`, `fitness_plans`, `fitness_subscriptions`, `fitness_classes`, `fitness_bookings`, `fitness_checkins` |
| `suscriptores` | Planes y suscriptores | `service_plans`, `subscribers` |
| `puestos` | Puestos y turnos de vigilancia | `guard_posts`, `post_shifts` |
| `obra` | Presupuestos, capítulos, APU, avance | `obra_presupuestos`, `obra_capitulos`, `obra_apu`, `obra_avances` |
| `contratacion` | Procesos, pliegos, oferentes | `contratacion_procesos`, `contratacion_pliegos`, `contratacion_oferentes` |
| `ecommerce` | Operación de pedidos y devoluciones | `online_orders`, `online_order_items`, `online_order_returns` |

# 5. Arquitectura multi-tenant

```text
Account: public.accounts
  └── Company: public.organizations
        ├── memberships
        ├── roles
        ├── role_permissions
        ├── sites
        └── datos con org_id
```

`organizations` es la empresa operativa. `accounts` es la cuenta comercial. `org_id` significa empresa. No existe `public.companies` ni `company_id`.

`account_memberships` tiene roles `owner`, `admin`, `billing`. Esa relación no concede datos de empresa; los datos requieren `memberships` de la empresa.

`getMember()` lee todas las memberships, ordena por `last_active_at`/`created_at`, valida cookie `kigyo_ctx` y resuelve la empresa activa. `member.orgId` siempre es el contexto activo.

`sites` y `membership_sites` implementan sucursales y restricciones. `site_id` existe en `pos_sales`, `cash_sessions`, `inventory_assets`, `restaurant_orders`, `dining_tables`, `employees`, `hotel_rooms` y `work_orders`.

RLS:

- `app.orgs_with(permission)` devuelve empresas autorizadas. Resuelve
  pertenencia **y** permiso en un solo predicado: no hay camino en la base que
  dé acceso a una empresa sin un permiso concreto.
- `app.apply_standard_rls()` crea policies raíz. `app.apply_child_rls()` hereda
  scope desde padres. Las tres primitivas están congeladas (AGENTS.md §5).
- Las tablas son `FORCE ROW LEVEL SECURITY`: ni el dueño las salta.
- Storage verifica `org_id` en el path, en los tres buckets privados.

Capas RESTRICTIVE, que se cruzan con las permissive y por tanto solo pueden
quitar acceso:

- **Sucursal** — `app.may_access_site(site_id)` sobre las 8 tablas con `site_id`
  más las dos de inventario nuevas.
- **Suspensión por impago** (migración 99) — `app.company_is_active(org_id)`
  sobre INSERT/UPDATE/DELETE de 181 tablas, **543 políticas**. Nunca sobre
  SELECT: suspender no es confiscar. Antes de esto la suspensión solo existía en
  `requirePermission`, así que un usuario de una empresa impaga escribía directo por
  PostgREST con la anon key pública, que es `NEXT_PUBLIC_*` y viaja en el bundle.
- **Visibilidad documental** — `documents` y `document_chunks`.

Fuera de la guardia de suspensión, a propósito: el plano de identidad
(`memberships`, `roles`, `role_permissions`, `invitations`, `membership_sites`),
porque bloquearlo puede encerrar a alguien fuera de la empresa que intenta pagar.
Y `service_role` la salta entera (`rolbypassrls`), que es lo que permite que
`apply_subscription` reactive y que un webhook liquide un cobro ya ocurrido.

**Los RPC `security definer` no ven ninguna política**: son de `postgres`, que
tiene `rolbypassrls`. Los tres que crean negocio —`register_pos_sale`,
`place_storefront_order`, `void_pos_sale`— comprueban la suspensión a mano con
código `KG106` (migración 100).

**Un módulo nuevo alcanza a las empresas que ya existían** desde la migración 97:
un trigger sobre `public.permissions` reparte cada clave nueva al rol
Administrador de cada empresa. Sin él, `app.seed_default_permissions` corría una
sola vez al crear la empresa y cada release dejaba atrás a toda la base
instalada — se midió: dos empresas con 113 de 115 permisos, sin `pedidos:*`
desde la migración 88.

# 6. Sistema sectorial

El sector propone módulos; no es un guard de acceso. El preset final aplica `sector + add - remove` del subsector.

Sectores exactos:

```text
construccion, energia, manufactura, comercio, ecommerce, servicios,
tecnologia, salud, educacion, logistica, alimentos, agro, inmobiliario,
hoteleria, financiero, mineria, telecomunicaciones, seguridad, medios,
ong, gobierno, otro, fitness-bienestar
```

Presets específicos:

| Sector | Vertical/específico | General compartido |
|---|---|---|
| construcción | `obra` | proyectos, HSEQ, inventario, mantenimiento, compras |
| energía | ninguno | proyectos, obra, HSEQ, inventario, mantenimiento |
| manufactura | producción, calidad | inventario, mantenimiento, catálogos, compras |
| comercio | POS/tienda | inventario, catálogos, caja, clientes, compras |
| ecommerce | `ecommerce` | tienda, inventario, catálogos, clientes |
| servicios | consultoría | proyectos, tiempos, clientes, contratos, cartera |
| tecnología | ninguno | proyectos, tiempos, clientes, contratos, suscripciones |
| salud | `pacientes` | caja, facturación, inventario, HSEQ, riesgos |
| educación | `estudiantes` | capacitación, facturación, clientes, cartera |
| logística | flota | inventario, mantenimiento, proyectos, compras |
| alimentos | restaurante | inventario, catálogos, caja, compras, calidad |
| agro | agro | calidad, inventario, mantenimiento, flota, HSEQ |
| inmobiliario | inmobiliario | contratos, clientes, suscripciones, mantenimiento |
| hotelería | hotelería | restaurante, inventario, caja, mantenimiento |
| financiero | créditos/cartera | clientes, facturación, riesgos, contratos |
| minería | obra compartida | proyectos, HSEQ, inventario, flota, mantenimiento |
| telecomunicaciones | suscriptores | proyectos, inventario, mantenimiento, flota |
| seguridad | puestos | empleados, riesgos, HSEQ, inventario, contratos |
| medios | ninguno | proyectos, tiempos, clientes, contratos, inventario |
| ONG | donantes | proyectos, clientes, contratos, trazabilidad |
| gobierno | contratación | proyectos, contratos, compras, firmas, trazabilidad |
| otro | ninguno | personas, clientes, documentos, tickets y colaboración |
| fitness-bienestar | socios | suscripciones, clientes, facturación, caja |
```

Existen 84 subsectores. Familias exactas:

```text
salud-consultorio, salud-ips, salud-laboratorio, salud-odontologia,
salud-estetica, salud-veterinaria,
comercio-retail, comercio-mayorista, comercio-ferreteria, comercio-farmacia,
comercio-super,
alimentos-salon, alimentos-rapida, alimentos-bar, alimentos-catering,
alimentos-panaderia,
hoteleria-hotel, hoteleria-hostal, hoteleria-finca, hoteleria-operador,
educacion-colegio, educacion-instituto, educacion-academia, educacion-universidad,
construccion-civil, construccion-mep, construccion-remodel, construccion-interv,
agro-permanente, agro-transitorio, agro-ganaderia, agro-poscosecha,
servicios-consultoria, servicios-contable, servicios-legal, servicios-agencia,
servicios-ti,
logistica-carga, logistica-ultima, logistica-bodegaje,
inmobiliario-arriendo, inmobiliario-ph, inmobiliario-corretaje,
manufactura-metal, manufactura-plastico, manufactura-textil, manufactura-alimentos,
fitness-gimnasio, fitness-estudio, fitness-spa, fitness-centro,
energia-solar, energia-eolica, energia-eficiencia, energia-om,
ecommerce-marketplace, ecommerce-tienda, ecommerce-dropshipping, ecommerce-suscripcion,
tecnologia-saas, tecnologia-medida, tecnologia-integrador,
financiero-cooperativa, financiero-seguros, financiero-fintech, financiero-cobranza,
mineria-abierto, mineria-subterranea, mineria-agregados,
telecomunicaciones-isp, telecomunicaciones-instalador, telecomunicaciones-integrador,
seguridad-vigilancia, seguridad-monitoreo, seguridad-escoltas,
medios-agencia, medios-productora, medios-medio,
ong-fundacion, ong-cooperacion, ong-voluntariado,
gobierno-entidad, gobierno-contratista, gobierno-servicios
```

CORE: dashboard, configuración, Auth, account/company, memberships, roles, permisos, auditoría y sites. Módulos generales: Personas, Operación, Comercial y Equipo. Módulos específicos: verticales sectoriales y ecommerce.

# 7. Modelo de datos

## Entidades centrales

`accounts`: plan, billing y límites. `organizations`: empresa, sector, módulos, branding, fiscalidad, estado y `account_id`. `profiles`: usuario vinculado a Auth. `memberships`: usuario-empresa. `roles` y `role_permissions`: RBAC scoped. `sites` y `membership_sites`: sucursales y restricciones.

## Inventario de tablas por dominio

Core:

```text
accounts, account_memberships, organizations, profiles, roles, permissions,
memberships, role_permissions, invitations, plan_limits, sites, membership_sites,
sectors, sector_modules, module_dependencies, sector_roles, pipeline_stages
```

Personas/RRHH:

```text
employees, employee_skills, employee_events, employee_goals, absences, benefits,
certifications, departures, evaluations, review_cycles, vacation_balances,
payroll_periods, payroll_lines, payroll_concepts, payroll_concept_lines,
payroll_rules, courses, course_enrollments, job_openings, candidates, surveys,
guard_posts, post_shifts, contratacion_procesos, contratacion_pliegos,
contratacion_oferentes
```

CRM/comercial:

```text
clients, client_contacts, client_interactions, leads, lead_activities, quotes,
quote_items, invoices, invoice_items, invoice_payments, receivable_agreements,
contracts, contract_milestones, sales_orders, sales_order_items, online_orders,
online_order_items, online_order_returns, discount_coupons, loyalty_points,
loans, loan_installments, service_plans, subscribers, subscription_plans,
subscriptions
```

Compras/operación:

```text
products, suppliers, supplier_invoices, supplier_invoice_items, supplier_payments,
purchase_requests, purchase_request_items, purchase_request_events, purchase_orders,
purchase_order_items, inventory_assets, inventory_orders, quality_checks,
nonconformities, production_boms, production_bom_items, production_orders,
production_stages, farm_inputs, farm_machinery
```

Finanzas/POS:

```text
gl_accounts, journal_entries, journal_lines, org_account_mappings, cash_sessions,
cash_movements, pos_sales, pos_sale_items, pos_payments, vehicles,
vehicle_services, fuel_logs, delivery_routes, time_entries
```

Inventario (migración 101):

```text
inventory_movements, product_stock
```

`inventory_movements` es el libro: un delta con signo por hecho, append-only por
grants (`authenticated` conserva SELECT e INSERT; se revocan UPDATE, DELETE y
también TRUNCATE, que no pasa por RLS). `product_stock` es el saldo por
`(producto, sucursal)`, mantenido por trigger, y `products.stock` pasó a ser el
total derivado que ya solo escribe `app.sync_product_stock_total`. Los cuatro
escritores anteriores —POS, anulación, tienda y la ficha de producto— pasan
todos por el libro.

Documentos/colaboración:

```text
document_folders, documents, document_shares, document_chunks, signature_requests,
channels, channel_members, channel_messages, tickets, ticket_comments,
calendar_events, calendar_attendees, hseq_reports, hseq_checklist_items,
hseq_updates, risks, projects, project_members, consultations, saved_reports,
work_orders, work_order_tasks, audit_log
```

`audit_log` es append-only y central: 29 tablas llevan el trigger
`app.audit_row`. Desnormaliza `actor_email` para que la entrada sobreviva al
borrado de la persona, y la migración 40 la extiende al borrado de la empresa.

Verticales:

```text
patients, patient_visits, patient_appointments, patient_prescriptions,
patient_lab_results, patient_images, dental_charts, dental_chart_teeth,
treatment_plans, treatment_plan_items, dental_lab_orders, vet_pets, vet_vaccines,
vet_hospitalizations, vet_hospitalization_notes, academic_programs, students,
student_enrollments, student_grades, class_schedules, student_attendance,
menu_items, menu_item_ingredients, dining_tables, restaurant_orders,
restaurant_order_items, restaurant_reservations, restaurant_deliveries,
hotel_rooms, hotel_seasons, hotel_season_rates, reservations,
room_cleaning_tasks, farm_lots, crop_cycles, harvests, crop_treatments,
irrigation_events, obra_presupuestos, obra_capitulos, obra_apu, obra_avances,
properties, leases, lease_payments, ph_zonas, ph_cuotas, ph_asambleas,
fitness_members, fitness_plans, fitness_subscriptions, fitness_classes,
fitness_bookings, fitness_checkins
```

Soporte:

```text
donors, donations, marketing_templates, marketing_campaigns, marketing_recipients,
ai_conversations, ai_messages, ai_insights, ai_usage_events, ai_monthly_budgets,
notification_rules, notification_log, integration_settings, billing_events,
portal_links, portal_views, ticket_portal_tokens, recommendations, demo_requests,
dian_documents, dian_events
```

Relaciones principales:

```text
Account → organizations → memberships → roles → role_permissions
Organization → employees, clients, products, projects, documents, tickets
Clients → leads/quotes/invoices/sales_orders/subscriptions/receivables
Quotes → quote_items/sales_orders/invoices
Products → inventory_movements → product_stock → products.stock
Products → quote_items/invoice_items/purchase_items/production/POS/online orders
Documents → shares/chunks/signatures
Patients → visits/appointments/prescriptions/labs/images/dental/vet
```

Tablas hijas con RLS heredado incluyen `quote_items`, `invoice_items`, `ticket_comments`, `channel_messages`, `calendar_attendees`, `patient_visits`, `restaurant_order_items`, `pos_sale_items`, `production_stages`, `sales_order_items` y `document_chunks`.

# 8. Flujos de negocio

## Registro

```text
Auth signup → handle_new_user → profile → account → account_membership
→ organization → roles → permissions → pipeline stages → onboarding
```

## CRM

```text
Lead → lead_activities → leads_convert → Client → Quote
→ Sales Order → Invoice → invoice_payments → cartera
```

Esa cadena es relacional **desde la migración 98**, y antes no lo era: `quotes`
guardaba al cliente como `text` sin FK, y `create_order_from_quote` insertaba
`sales_orders.client_id = null` a mano. «¿Qué le hemos cotizado a este cliente?»
se respondía comparando cadenas, así que dos clientes homónimos eran uno y el
mismo escrito de dos formas eran dos. Ahora `quotes.client_id` e
`invoices.sales_order_id` existen con guards anti-cruce de empresa, y el nombre
en texto se conserva a propósito: la ficha dice quién es, el texto dice cómo se
llamaba el día que se firmó.

## Compras

```text
purchase_request → items → approval events → purchase_order
→ supplier_invoice → supplier_payment → inventario/contabilidad
```

## POS

```text
Carrito → register_pos_sale → pos_sales/items → stock/caja
→ pos_payments → Wompi/simulación → webhook → confirm_pos_payment
```

Offline: IndexedDB `kigyo-pos-outbox`, `client_uuid`, replay al recuperar red.

IVA (migración 104): `products.price_cents` es el precio **con impuesto
incluido** — lo que se paga en el mostrador. El POS lo **extrae**
(`bruto × tasa / (100 + tasa)`) en vez de sumarlo, así que el total no cambió;
lo único que dejó de ser cero es `pos_sales.tax_cents`. La factura hace lo
contrario: convierte a neto al copiar el precio, porque su `totalsOf()` suma el
impuesto encima. Antes ambas leían la misma columna con significados opuestos,
así que facturar un producto a su precio de góndola cobraba un 19% de más.

`pos_sales` **no** cumple `total = subtotal + tax` y no debe: el recibo imprime
`Subtotal − Descuento = Total` y `tax_cents` dice cuánto de ese total ya era
impuesto. Un recibo de mostrador y una factura B2B presentan el IVA distinto en
la vida real.

## Verticales

```text
Restaurante: menú → mesa → comanda → cocina/delivery → caja
Hotelería: habitación → reserva → temporada → housekeeping → facturación
Salud: paciente → cita → visita → receta/lab/imagen → caja
Agro: lote → ciclo → tratamiento/riego → cosecha
RRHH: empleado → asistencia → periodo nómina → líneas → cierre/PILA
```

## Documentos/IA

```text
Documento → Storage → extracción → chunks → embeddings → document_chunks
→ búsqueda híbrida → chat IA con citas
```

## Portal y billing

```text
portal_create → token SHA-256 → enlace expirado/revocable → RPC público
Polar checkout → billing webhook → billing_events → apply_subscription
```

DIAN actual es local: XML UBL simplificado, CUFE SHA-256 y `dianDemoSend()`.

# 9. Roles y permisos

Roles de cuenta: `owner`, `admin`, `billing`. No conceden automáticamente datos de empresa.

Roles iniciales de empresa: `Administrador`, `Líder de equipo`, `Empleado`. Son custom y scoped por empresa. Autoridad administrativa efectiva: `configuracion:manage`.

Permisos: `<module>:read`, `<module>:write`, `<module>:manage`, `<module>:use`. Se derivan del registry y se reflejan en `public.permissions`.

Recursos protegidos: páginas, Server Functions, mutaciones, APIs, tablas, Storage y RPCs. `membership_sites` restringe por sucursal cuando aplica.

# 10. API

`src/lib/api/handler.ts` ejecuta: auth → **suspensión** → módulo → permiso →
rate limit → JSON → Zod → handler. Errores: `application/problem+json`.

La puerta de suspensión se añadió porque faltaba: seis de las siete rutas piden
un permiso que no termina en `:read` (`ia:use`, `documentos:write`), así que una
empresa impaga seguía llamando al modelo y quemando crédito de Foundry. La regla
se escribe sobre «no termina en `:read`» y no sobre «termina en `:write`»,
porque `ia:use` y `configuracion:manage` son escrituras que no se llaman así.

`/api/v1/export` no puede apoyarse en el gate del envoltorio —el módulo llega en
el cuerpo, no en las opciones— y comprueba módulo y permiso a mano.

Endpoints:

```text
POST   /api/auth/login
DELETE /api/auth/login
POST   /api/auth/register
GET    /api/auth/confirm
POST   /api/auth/forgot-password
POST   /api/auth/verify-otp
POST   /api/auth/reset-password
POST   /api/auth/mfa
PUT    /api/auth/mfa
DELETE /api/auth/mfa
POST   /api/demo/request
POST   /api/billing/webhook
POST   /api/wompi/webhook
POST   /api/wompi/simulate
POST   /api/v1/export
POST   /api/ai/chat
GET    /api/ai/chat
POST   /api/ai/insights
POST   /api/ai/rewrite
POST   /api/ai/documento
POST   /api/ai/ingest
```

Parámetros conocidos: auth usa email/password/OTP/TOTP; demo usa datos de contacto; chat usa `messages` y `conversationId`; export usa `module`, `filename`, `rows`; webhooks usan body crudo y headers de firma.

RPCs relevantes: `account_companies`, `apply_subscription`, `complete_onboarding`, `confirm_pos_payment`, `create_company`, `create_order_from_quote`, `export_payroll_pila`, `handle_new_user`, `join_company`, `leads_convert`, `lock_payroll_period`, `match_document_chunks_hybrid`, `place_storefront_order`, `portal_*`, `post_auto_entry`, `rate_limit_hit`, `register_pos_sale`, `reserve_ai_budget`, `set_active_company`, `void_pos_sale`.

# 11. Frontend

Rutas públicas: `/`, `/about`, `/contact`, `/faq`, `/pricing`, `/privacy`, `/terms`, `/portal/[token]`, `/soporte/[token]`, `/onboarding`.

Auth: `/login`, `/register`, `/forgot-password`.

Dashboard: 62 directorios de rutas para core, Personas, Operación, Comercial, Equipo, sectoriales, empresas, configuración y DIAN.

Navegación: `src/lib/data/nav.ts`, Sidebar filtrado por `member.can()`, orden por sector, `CompanySwitcher`, Command Palette y `configuracion` en menú de usuario.

Estado global: `MemberContext`, `AppContext`, `ThemeContext`, `SoundContext`, `ConfirmContext`. No se encontraron Redux, Zustand, React Query ni SWR.

UI: formularios controlados, Zod server-side, tablas nativas, `LoadMore`, `Modal`, `Drawer`, `FormDrawer`, KPIs, tabs, toasts y exportación.

Responsive: breakpoints `1024`, `1080`, `900`, `760`, `560`; safe areas, reduced motion, tablas horizontales y drawers full-screen.

PWA: manifest e iconos implementados. No existe service worker. Offline está implementado únicamente para POS.

# 12. Backend

Queries server-only: auth, permiso, cliente SSR, `org_id`, consulta y transformación de respuesta.

Mutaciones `'use server'`: Zod, `requirePermission()`, escritura/RPC, revalidación y resultado `{ ok, data/error }`.

No existe ORM ni Repository formal. Acceso directo con `supabase.from()`, `supabase.rpc()` y `supabase.storage`.

Triggers relevantes: códigos, auditoría, límites de empresas/sites, último administrador, nómina bloqueada, asientos balanceados/inmutables, referencias de ventas, proveedores, costos/totales, SLA y delivery status.

No existen jobs persistentes. RAG, IA y parte de integraciones se ejecutan dentro de requests.

# 13. Integraciones

| Servicio | Uso | Estado |
|---|---|---|
| Supabase Auth | Usuarios, sesiones, MFA | Implementado |
| Supabase PostgreSQL | Datos, RPC y RLS | Implementado |
| Supabase Storage | Documentos, avatares, radiografías | Implementado |
| Supabase Vault | Secretos de gateway/WhatsApp | Implementado |
| Microsoft Foundry | Chat y embeddings | Configurable |
| Azure AI Search/Foundry IQ | RAG externo | Opcional |
| Polar | Billing SaaS | Código presente; credenciales pendientes |
| Wompi | Pagos POS | Simulado por defecto; real configurable |
| Meta Graph API | Prueba de WhatsApp | Configuración/prueba |
| DIAN | Facturación electrónica | Solo demo local |

# 14. Seguridad

- Auth: Supabase Auth, `getUser()`, confirmación de email, MFA AAL2 y OTP.
- RBAC: `memberships → roles → role_permissions → permissions`.
- Multi-tenancy: `org_id`, empresa activa, RLS y Storage por prefijo.
- API: wrapper de auth/permiso, Zod, rate limiting y Problem Details.
- Webhooks: body crudo y firmas Polar/Wompi.
- Secretos: service role solo server; integraciones en Vault; `.env.local` ignorado.
- Auditoría: `audit_log` y trigger `app.audit_row`.
- Headers: CSP nonce, HSTS productivo, `X-Frame-Options`, `nosniff`, Referrer Policy y Permissions Policy.

# 15. Estado actual

| Funcionalidad | Estado |
|---|---|
| Auth, MFA, roles, permisos, RLS, auditoría | ✅ Implementada |
| Accounts, multi-company y sites | ✅ Implementada |
| Registry, planes, módulos, sectores y subsectores | ✅ Implementada |
| RRHH, CRM, compras, proveedores, inventario | ✅ Implementada |
| Contabilidad | ✅ Implementada |
| POS | 🟡 Simulación completa; Wompi real condicionado |
| IA chat y RAG nativo | ✅ Implementada |
| Foundry IQ | 🟡 Configurable y dependiente de Azure Search |
| Nómina legal | 🟡 Flujo presente; validación externa pendiente |
| Marketing | 🟡 Campañas y segmentación; delivery incompleto |
| Notificaciones | 🟡 Reglas/log/UI; sin worker de envío |
| Polar | 🟡 Código presente; credenciales/productos pendientes |
| DIAN demo | ✅ Implementada |
| DIAN productivo | 🔴 No implementada |
| PWA completa | 🔴 No implementada; no hay service worker |
| Workers/cron | 🔴 No implementados |
| Exportación XLSX | ✅ Implementada |

Verificación al 2026-08-21, ejecutada entera:

```text
npx tsc --noEmit     0 errores
npm test             290 tests en 19 archivos
npm run build        compila
npx playwright test  6/6 (workers: 1 obligatorio)
npm run lint         4 errores, 24 advertencias  ← lo único en rojo
```

El typecheck que este documento reportaba en rojo era un artefacto: un archivo
scratch de la auditoría que corría en paralelo. Lint sí sigue fallando y es
deuda real (ver §17).

Cambios de estado respecto a la versión del 20:

| Funcionalidad | Antes | Ahora |
|---|---|---|
| Inventario | ✅ «implementada» | ✅ con libro de movimientos, saldo por sucursal y recepción de compras |
| POS | 🟡 | 🟡 igual, pero con IVA real desglosado por línea |
| Suspensión por impago | (no listada) | ✅ en RLS, RPC y API |
| Embudo CRM | ✅ «implementado» | ✅ ahora relacional de verdad |

# 16. Dependencias entre módulos

```text
CORE
├── Auth / Account / Company / Sites
├── Dashboard
└── Configuración

Personas
├── Empleados
├── Asistencia → Empleados
├── Nómina → Empleados
├── Desempeño → Empleados
└── Tiempos → Empleados + Proyectos

Comercial
├── Leads → Clientes
├── Cotizaciones → Clientes / Catálogos
├── Pedidos → Cotizaciones / Clientes / Inventario / Facturación
├── Cartera → Facturación / Clientes
├── Tienda → Catálogos
├── Ecommerce → Tienda
└── POS → Catálogos

Operación
├── Producción → Inventario
├── Calidad → Catálogos
├── Mantenimiento → Inventario
└── Flota → Mantenimiento

Sectoriales
├── Pacientes → Calendario
├── Estudiantes → Calendario
├── Restaurante → Catálogos / Inventario
├── Obra → Proyectos / Clientes
├── Contratación → Documentos / Firmas
└── Puestos → Empleados / Clientes
```

Hard: `tienda → catalogos`, `ecommerce → tienda`, `nomina → empleados`, `asistencia → empleados`, `desempeno → empleados`, `produccion → inventario`, `pos → catalogos`.

Soft: relaciones entre clientes, cotizaciones, pedidos, facturación, cartera, contratos, inventario, mantenimiento, flota, verticales, calendario, documentos, firmas, marketing, integraciones y contabilidad según `MODULE_DEPENDENCIES`.

# 17. Riesgos arquitectónicos

## Polar — FALSO POSITIVO, no tocar

- Afirmación original: «`polarProvider()` re-encodea el secreto completo».
  Severidad Alta, firmas válidas rechazadas.
- **Comprobado y descartado.** El SDK de Polar hace exactamente lo mismo:
  `node_modules/@polar-sh/sdk/src/webhooks.ts:140-141` es
  `Buffer.from(secret, "utf-8").toString("base64")` seguido de
  `new Webhook(base64Secret)`, byte por byte lo que hace
  `src/lib/billing/provider.ts`. El comentario del archivo ya lo explicaba.
- **Actuar sobre este riesgo rompería la verificación de webhooks de
  facturación.** Se deja escrito aquí en vez de borrar el punto, para que nadie
  vuelva a «arreglarlo» leyendo una versión anterior de este documento.

## Wompi — ERA REAL, CORREGIDO

- Problema: configuración guardaba `publicKey`, el POS leía `public_key`.
- Confirmado: los escritores usan camelCase de forma consistente (`publicKey`,
  `phoneNumberId`, `ambiente`) y los dos lectores de Wompi eran los únicos en
  snake_case. La llave que un administrador acababa de guardar no se encontraba
  nunca.
- Estaba enmascarado porque `paymentsSimulated()` es true por defecto y el
  camino simulado no consulta la llave: el fallo esperaba al día que alguien
  pusiera `WOMPI_REAL=true`, con el QR configurado en pantalla y muerto en
  producción.
- **Corregido** en `queries/pos.ts` y `mutations/pos.ts`. No hubo dato que
  migrar: la única fila de `integration_settings` es `{"ambiente": "demo"}`.

El secreto configurado por empresa en Vault no es el secreto usado por `/api/wompi/webhook`, que lee `WOMPI_EVENTS_SECRET` global. Severidad alta en despliegues multiempresa.

La comparación Wompi usa igualdad de strings en `src/lib/wompi.ts:194-195`, no constant-time. Severidad baja/media.

## Autorización IA/export — ERA REAL, CORREGIDO

`buildTools()` validaba permiso pero no `member.modules`, y `/api/v1/export`
tampoco — esta última porque no puede apoyarse en el gate de `route()`: el
módulo llega en el cuerpo de la petición, no en las opciones, así que el
envoltorio no sabe cuál comprobar.

Confirmado que era alcanzable: `member.permissions` sale de `role_permissions`,
que **no** se toca al apagar un módulo en Configuración. Así que una empresa que
apagaba Inventario lo veía desaparecer del menú y seguía pudiendo preguntarle
sus existencias al asistente y exportarlas a Excel.

**Corregido** en ambos, con la misma regla que usa el resto del producto, y
pineado en `guards.test.ts` › «apagar un módulo lo apaga en todas partes».

## Automatización incompleta

No hay worker de notificaciones. `markSent()` de marketing puede marcar envío sin delivery receipt integrado. Severidad media funcional.

## DIAN

El flujo actual genera XML simplificado, CUFE local y aceptación simulada. No existe proveedor DIAN ni request HTTP real. Severidad alta si se interpreta como cumplimiento productivo.

## Proxy

Las redirecciones tempranas de `src/proxy.ts:120-133` retornan antes de la copia final de headers de seguridad (`136-137`). Severidad baja/media.

## Documentación y workspace — PARCIALMENTE ARTEFACTO

«El workspace no pasa typecheck por `src/lib/__audit.test.ts` no rastreado» era
un **artefacto de la sesión que escribió este documento**: ese archivo era un
scratch temporal de la auditoría que corría en paralelo, y se borró al terminar.
El repositorio pasa `tsc --noEmit` limpio.

Lo que sí queda: **`npm run lint` reporta 4 errores y 24 advertencias**, casi
todas `no-unused-vars` sobre `member`/`parsed` asignados y no usados en
mutaciones. No rompen nada en ejecución, pero sí romperían un CI que corra lint
con `--max-warnings 0`. Sigue abierto.

Los conteos de la documentación histórica se corrigieron en `CONTEXTO_SESION.md`
durante la jornada del 21.

# 18. Preguntas pendientes

- ¿Qué proyecto Supabase es productivo y qué migraciones están aplicadas allí?
- ¿Está Foundry IQ configurado con `org_id` filtrable?
- ¿Se usa API key o Entra para Foundry?
- ¿Están configurados Polar y sus cuatro productos?
- ¿Se probó Polar con secreto `whsec_` real? (el manejo del secreto está
  verificado contra el SDK; falta la prueba con llaves reales.)
- ¿Está Wompi real habilitado? (la convención de nombres ya está resuelta:
  camelCase en el jsonb, ver §17.)
- ¿Existe un servicio externo no versionado para notificaciones o marketing?
- ¿Cuál será el proveedor DIAN productivo?
- ¿Validó un contador los parámetros legales de nómina?
- ¿Qué módulos y datos están activos en cada empresa productiva?
- ¿Qué cobertura E2E existe fuera de los seis specs? (era cinco; se añadió
  `embudo.spec.ts`. Seis specs para 62 pantallas sigue siendo el riesgo meta:
  el bloqueante de onboarding de la migración 97 vivía exactamente en ese hueco,
  con todo lo demás en verde.)
- ¿Se considera suficiente PWA sin service worker?
- ¿Cuál es el precio definitivo de cada plan? (las contradicciones entre FAQ,
  JSON-LD y `/pricing` están resueltas; la cifra en sí sigue siendo decisión de
  producto.)
- ¿Es intencional la divergencia People Operating System versus CRM/ERP/POS?
- ¿Los errores actuales de lint bloquean CI?

# 19. Resumen ejecutivo

1. Kigyo es un SaaS B2B multiempresa sobre Next.js 16.
2. React sirve marketing, auth, dashboard y portales públicos por token.
3. Supabase proporciona Auth, PostgreSQL, PostgREST, Storage y RLS.
4. `accounts` gestiona billing; `organizations` representa empresas operativas.
5. `org_id` es el identificador de empresa de los datos.
6. Memberships, roles y permisos controlan el acceso empresarial.
7. `kigyo_ctx` selecciona la empresa activa y se valida server-side.
8. Plan, módulos habilitados y permisos forman el acceso efectivo.
9. PostgreSQL vuelve a validar mediante `app.orgs_with()` y RLS.
10. El registry define módulos, rutas, permisos y dependencias.
11. Hay RRHH, CRM, ERP, POS, documentos, colaboración y verticales.
12. Hay 23 sectores y 84 subsectores con presets.
13. CRM conecta leads, clientes, cotizaciones, pedidos, facturas y cartera.
14. POS conecta caja, inventario, pagos y cola offline.
15. IA ofrece streaming, herramientas, historial, citas y RAG.
16. DIAN productivo, notificaciones automáticas, delivery de marketing y PWA completa no están plenamente implementados.
17. El aislamiento tenant está respaldado principalmente por PostgreSQL, con riesgos concretos de integración, documentación y autorización descritos arriba.

# 20. Registro de la revisión del 2026-08-21

Qué se verificó de la versión del 20, cómo, y qué salió.

## Lo que estaba bien

- **El inventario de tablas.** Se extrajeron los 198 nombres de §7 y se
  compararon contra `pg_tables` de la base remota: **cero inventados**. Para un
  documento pensado como contexto de otra IA, es la propiedad que más importa.
- Los 23 sectores y los 84 subsectores, uno por uno contra `public.sectors`.
- El conteo del registro: 57 módulos conmutables, 2 core, 2 aliases.
- La descripción de RLS, del plano de identidad y de la resolución de empresa
  activa.
- Las dos tablas de `app`, las 0 views y los 0 enums.

## Lo que estaba desactualizado

Escrito antes de las migraciones 97–104. Actualizado: conteos (104 migraciones,
203 tablas, 6 extensiones, 1296 políticas), la capa de suspensión, el libro de
inventario, el IVA, el embudo relacional y la tercera puerta del envoltorio de
API.

## Lo que estaba mal

| Punto | Veredicto |
|---|---|
| Riesgo Polar «re-encodea el secreto», severidad Alta | **Falso positivo.** El SDK hace lo mismo (`webhooks.ts:140-141`). Actuar sobre él rompe la facturación. |
| «El workspace no pasa typecheck» | **Artefacto** de la sesión que escribió el documento: un scratch temporal suyo. |
| Faltaban `audit_log`, `work_orders`, `work_order_tasks` | Omisiones; añadidas. |
| §8 presentaba el embudo CRM como relacional | No lo era hasta la migración 98. |

## Lo que el documento acertó y estaba sin arreglar

Tres cosas que esta revisión encontró **porque el documento las señalaba**, y
que se corrigieron al verificarlas:

1. **JSON-LD declarando `price: '0'`** a buscadores y rastreadores de IA
   mientras `/pricing` cobra desde $80.000. La afirmación falsa dicha donde más
   se propaga y donde menos se revisa, porque no se ve en pantalla.
2. **Wompi**: la llave pública guardada en camelCase y leída en snake_case.
3. **IA y export sin gate de módulo**: apagar un módulo lo quitaba del menú y no
   de los datos.

Las tres estaban fuera de lo que la auditoría de páginas había mirado.

## Deuda que sigue abierta

- `npm run lint`: 4 errores, 24 advertencias.
- Cobertura e2e: 6 specs para 62 pantallas.
- Sin service worker: el POS offline es cierto en datos y falso en aplicación.
- `notif-panel` mezcla `timestamptz` y `date` en la misma columna: una cita de
  hoy a las 15:00 se anuncia «en 1 día».
- Inventario sin decimales: una compra de 2,5 kg se redondea al entrar al libro.
- Validación de stock por sucursal llega tarde (la temprana mira el total de la
  empresa; la del trigger es la que manda).
- `organizations` sin ciudad ni dirección, que DIAN productivo exigirá.
