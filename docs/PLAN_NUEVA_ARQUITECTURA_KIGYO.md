# Plan maestro — Nueva arquitectura Kigyo (multiempresa, multisector, modular)

## 1) Objetivo

Evolucionar Kigyo desde el modelo actual (centrado en `organization`) hacia una plataforma:

- multiempresa dentro de una misma organización/cuenta,
- multisector con plantillas no restrictivas,
- modular por empresa,
- con permisos por alcance (organización/empresa/sucursal),
- y aislamiento estricto de datos.

---

## 2) Lo nuevo que se debe construir

## A. Modelo de negocio y tenanting interno

1. Crear entidad **Company** (empresa operativa) hija de `Organization`.
2. Crear entidad **Site/Branch** (sucursal/unidad) hija de `Company` (opcional en primera salida, pero preparada).
3. Separar claramente responsabilidades:
   - `Organization`: cuenta, ownership, billing, límites.
   - `Company`: operación diaria, módulos activos, sector/subsector, dashboard.
   - `Site`: operación local (si aplica).

## B. Configuración por empresa (no por organización)

1. Mover configuración de sector y módulos de org -> company:
   - `company_type` / sector por empresa.
   - `enabled_modules` por empresa.
2. Mantener **modo manual** sin sector.
3. Permitir activar/desactivar módulos por empresa en cualquier momento.

## C. Sectores y subsectores como plantillas

1. Crear catálogo de `sector_templates` y `subsector_templates`.
2. Crear relación plantilla -> módulos sugeridos.
3. Permitir que la empresa modifique libremente la sugerencia.
4. Agregar soporte para:
   - Salud
   - Comercio
   - Restaurantes
   - Hotelería
   - Educación
   - Construcción
   - Manufactura
   - Agro
   - Inmobiliario
   - Servicios profesionales
   - Logística/Transporte
   - Fitness & Bienestar

## D. Dependencias de módulos

1. Crear `module_dependencies`.
2. Validar dependencias al activar módulos (ej. POS requiere catálogo/inventario/clientes/caja).
3. Definir comportamiento ante desactivación de dependencias (bloquear o desactivar en cascada controlada).

## E. Roles y permisos por alcance

1. Mantener catálogo `module:action`.
2. Mantener roles custom.
3. Agregar asignaciones por scope:
   - Organización
   - Empresa
   - Sucursal
4. Resolver permisos por contexto activo (org + company + site).

## F. Selector de contexto en UI

1. Crear selector:
   - Organización
   - Empresa
   - Sucursal (si aplica)
2. Al cambiar empresa:
   - cambia dashboard,
   - cambia sidebar,
   - cambia permisos efectivos,
   - cambian datos visibles.

## G. Onboarding nuevo

1. Cuenta de usuario.
2. Crear organización.
3. Crear primera empresa (datos legales/fiscales).
4. Elegir sector.
5. Elegir subsector (si aplica).
6. Aplicar sugerencia de módulos editable.
7. Invitar equipo y asignar roles.

## H. Aislamiento de datos (seguridad)

1. Agregar `company_id` (y `site_id` donde aplique) a tablas operativas.
2. Actualizar RLS para aislamiento:
   - cross-org (ya existente),
   - cross-company (nuevo),
   - cross-site (si aplica).
3. Actualizar queries/mutations para exigir contexto activo.
4. Ampliar suite de tests RLS y autorización.

## I. Billing y planes

1. Mantener plan a nivel organización.
2. Agregar límites evaluables sobre:
   - cantidad de empresas,
   - cantidad de sucursales,
   - cantidad de usuarios,
   - módulos habilitables.
3. Integrar flujo de upgrade/downgrade sin pérdida de configuración.

## J. Personalización empresarial (sin sobreingeniería)

Primera etapa:

1. Módulos on/off por empresa.
2. Branding básico por empresa (logo/colores).
3. Datos fiscales por empresa.

Preparado para siguiente etapa:

1. Campos personalizados.
2. Estados/workflows personalizados.
3. Categorías/etiquetas por módulo.

---

## 3) Plan de implementación por fases (seguras)

## Fase 0 — Decisiones y contratos

1. Cerrar decisiones de dominio (Organization/Company/Site).
2. Cerrar estrategia de permisos por scope.
3. Cerrar política de migración (dual-write vs cutover).

## Fase 1 — Esquema aditivo

1. Crear tablas nuevas (`companies`, `sites`, asignaciones por scope, plantillas).
2. Crear índices y constraints.
3. No romper rutas actuales.

## Fase 2 — Contexto activo de empresa

1. Añadir company activa en sesión/contexto.
2. Añadir selector en UI.
3. Mantener compatibilidad temporal con modelo actual.

## Fase 3 — Configuración por empresa

1. Introducir sector/subsector/módulos por company.
2. Adaptar pantalla de configuración.
3. Mantener fallback temporal para org legacy.

## Fase 4 — Permisos por alcance

1. Implementar asignaciones por scope.
2. Adaptar `requirePermission` y guards.
3. Actualizar sidebar y gating por contexto.

## Fase 5 — Datos operativos con company_id

1. Backfill de company para data existente.
2. Actualizar tablas de dominio críticas.
3. Endurecer RLS con company_id.

## Fase 6 — Onboarding nuevo

1. Flujo multi-paso completo.
2. Plantilla sector/subsector + edición manual.
3. Primera experiencia contextual por empresa.

## Fase 7 — Billing integrado a arquitectura

1. Límites por plan sobre empresas/usuarios/módulos.
2. Flujos de upgrade/downgrade con mensajes claros.

## Fase 8 — Hardening

1. Pruebas E2E de cambio de empresa.
2. Pruebas de no-fuga entre empresas.
3. Auditoría final de seguridad/autorización.

---

## 4) Backlog priorizado (orden sugerido)

## Prioridad P0 (bloqueantes)

1. Entidad `Company`.
2. Contexto activo de empresa.
3. Configuración de módulos por empresa.
4. Aislamiento por `company_id` en RLS.
5. Permisos por alcance mínimo (org/company).

## Prioridad P1 (alto valor)

1. Subsectores.
2. Dependencias de módulos.
3. Onboarding nuevo completo.
4. Selector de sucursal (si entra en alcance).

## Prioridad P2 (siguiente iteración)

1. Workflows personalizados.
2. Campos custom.
3. Motor de recomendaciones de nuevos sectores.

---

## 5) Criterios de aceptación globales

1. Un usuario puede operar múltiples empresas dentro de una organización.
2. Cada empresa ve solo sus módulos, datos y permisos.
3. Sectores funcionan como sugerencia, no como bloqueo.
4. Cambiar empresa cambia contexto completo sin fuga de datos.
5. No hay acceso cruzado entre empresas/organizaciones en DB/API/UI.
6. Planes limitan capacidades sin romper configuraciones existentes.

---

## 6) Dependencias y riesgos

1. Migración de datos legacy sin downtime.
2. Riesgo de fugas si `company_id` no llega de forma consistente a RLS + queries.
3. Riesgo de inconsistencias si se cambia UI antes que autorización server.
4. Riesgo de complejidad excesiva si se intenta lanzar scopes org/company/site completos en una sola entrega.

Mitigación:

1. Despliegue incremental por fases.
2. Dual-read/dual-write temporal cuando aplique.
3. Tests de autorización y RLS por fase.

---

## 7) Decisiones pendientes de aprobación

1. Jerarquía final: `Organization -> Company -> Site` (propuesta).
2. Scope inicial: ¿org+company primero y site después?
3. Estrategia de migración: dual-write temporal o cutover por módulo.
4. Límites de plan iniciales (empresas, usuarios, módulos).
5. Catálogo inicial de subsectores por cada sector prioritario.
