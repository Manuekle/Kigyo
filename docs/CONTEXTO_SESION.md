# Contexto de sesión — para retomar

Fecha: 2026-08-15. Rama: `feat/design-system-refresh` (12+ commits ahead de origin).
Working tree: limpio tras commit marketing. Próximo activo: facturación DIAN (pendiente 3, XL).

---

## Estado

Suite re-corrida tras marketing: vitest 256/256 · tsc 0 · build 0. db-verify local NO válido: mig 86 (`vector` extension) no instalada en homebrew PG; migs 87–91 siguen patrón 87/88/90 (aplicar remota vía psql, validar policies con psql directo). E2e smoke (nómina + marketing) **deferido** (ver pendiente 1).
Remota: migraciones 1–91 aplicadas. Tipos regenerados (199 tablas) tras mig 91; tipos `marketing_templates` añadidos por generador (no a mano — tabla sin RPC).
tipos `lock_payroll_period`/`export_payroll_pila` añadidos a mano al bloque `Functions` (mig 90).

Branch ahead ~12 commits orig no pusheados desde cuts anteriores (usuario decide cuándo push).

## Commits de esta jornada

| Commit | Qué |
|---|---|
| `8eeef8e` `0f3cabb` `40e3f8e` `a6bfd22` `ee5f8fc` | previos (design refresh) |
| `690cd84` | feat(compras): directorio de proveedores (mig 87) |
| `a4869be` | feat(comercial): pedidos B2B (mig 88 sales_orders/items, RPC create_order_from_quote, módulo `pedidos`) |
| `49f97aa` | feat(soporte): portal público de tickets (mig 89, /soporte/[token], mutations portal.ts, botones en ficha cliente) |
| `feat(nomina)` (este jorna) | feat(nomina): nómina legal con cierre de periodo y PILA (mig 90 payroll_rules/concepts/concept_lines/locked_at, employees.tax_id, RPCs lock_payroll_period + export_payroll_pila; queries/mutations nomina.ts; client.tsx desglose+cierre+reglas+conceptos+desprendible+PILA; tipos RPC a mano) |
| `chore(docs)` (este jorna) | chore(docs): poda de planes históricos y refs (borra 5 docs absorbidos en AGENTS.md/AUDITORIA; actualiza refs en AUDITORIA/FASE_0/PLAN_CRM_ERP_POS/CONTEXTO) |
| `feat(marketing)` (este jorna) | feat(marketing): plantillas reusables y segmentación de destinatarios (mig 91 marketing_templates; queries/mutations addTemplate/deleteTemplate; generateRecipients firma nueva con filters {status,kind,city,hasEmail}; client.tsx con sección Plantillas + panel inline de filtros por campaña borrador) |

## Commit pendiente (sin stage)

— (limpio) —

## Hecho antes (condensado — jornadas 1–3)

- Multiempresa: `accounts` → `organizations` (`org_id` = empresa) → `sites`. RLS congelado (`app.orgs_with` / `apply_standard_rls` / `apply_child_rls`).
- 48 módulos conmutables (migraciones 42–70), 10 verticales, 23 sectores / 84 subsectores / 95 presets. Roles sugeridos por subsector.
- 3 planos transversales (mig 62–64): portal firmado, marketing fidelización, integraciones (Wompi/WhatsApp, secretos en vault).
- Plan CRM/ERP/POS ejecutado 9/9 (mig 73–85): aging, barcode, recibo, leads, pipeline kanban, CxP, contabilidad, tickets cliente, pasarela QR. Pagos 100% simulados.
- Nómina base (mig 02): payroll_periods + payroll_lines con gross/deductions/net por empleado y periodo.

## Documentación vinculante / NO borrar

- `AGENTS.md`, `CLAUDE.md`, `README.md` — instrucciones del repo.
- `docs/FASE_0_CONTRATOS.md` — contratos vinculantes (citado en AGENTS.md).
- `docs/AUDITORIA_ARQUITECTURA_KIGYO.md` — razonamiento arquitectura (citado en AGENTS.md).
- `docs/SETUP.md` — setup.
- `docs/PLAN_CRM_ERP_POS.md` — plan en ejecución (no terminado: nómina, marketing, DIAN, POS offline).
- `docs/CONTEXTO_SESION.md` — este archivo.

## Pendiente (orden sugerido)

### 1. Smoke e2e (nómina + marketing) — DEFERIDO, arrancar próxima sesión

- Único spec existente: `e2e/company-switch.spec.ts`. Smoke de módulos nuevos requiere `e2e/nomina.spec.ts` y `e2e/marketing.spec.ts` (nuevos archivos `.ts`, permitidos) + `npm run dev` + creds demo de `.env.local` (org `f8eafe69…`, admin `eb711727…`).
- **Mínimo nómina**: abrir periodo → añadir concepto → editar monto línea → cerrar → verificar read-only → exportar PILA.
- **Mínimo marketing**: crear plantilla → aplicar a formulario → crear campaña → armar lista con filtros (status + hasEmail) → marcar enviada → verificar audienceCount.
- `npm run playwright test` tras specs.

### 2. Nómina legal — commiteado (DONE); queda validación contador

- Pase A+B commiteados (`a24d84c`). Mig 90 aplicada a remota. Vitest 256, build 0.
- `payroll_concept_lines` tipado OK en `types.ts`. RLS `nomina:read`/`nomina:write` vía `apply_standard_rls`.
- Validación con **contador laboral colombiano OBLIGATORIA** antes de producción (plan 4.3): salario mínimo, auxilio transporte, porcentajes salud/pensión/ARL/caja todo a 0 por defecto. Banner "parámetros en cero" en UI cuando minWage=0 (ya hecho). NO inventar cifras.

### 3. Marketing automation — commiteado (DONE); conversión DEFERIDA

- **Commiteado** este jorna (`c921da7`). Mig 91 aplicada a remota. Tabla `marketing_templates` + 4 policies RLS. Tipos regenerados (199 tablas).
- Plantillas: CRUD completo (addTemplate/deleteTemplate via mutations, sección en client.tsx, "Aplicar" rellena formulario).
- Segmentación: `generateRecipients` recibe `filters {status?, kind?, city?, hasEmail?}` opcional. Retrocompatible (sin filtros = todos los clientes con phone, como antes). Panel inline por campaña en borrador.
- **Conversión DEFERIDA**: medir respuestas/compras post-campaña requiere integración real (WhatsApp/email delivery receipts). No se puede medir sin proveedor real (integraciones mig 64 tiene config pero sin envío real aún). Tabla `marketing_events` futura cuando haya proveedor. **No inventar métricas sin fuente de datos real.**
- Brecha sin cubrir: **ownerId filter** (segmentar por vendedor/encargado) — requiere roster en client.tsx. Deferido por scope; easy follow-up (sustituir text input por Select con `rosterFor`).

### 4. Facturación electrónica DIAN (plan fila 15) — ACTIVO (próxima jornada, XL)

- Integración con `integraciones` (vault para certificados).
- Generación UBL/XML,_envío a DIAN, recepción del CUFE, PDF con representación gráfica.
- Guardar eventos DIAN en tabla `dian_events` (error/aceptación/rechazo).
- Test con ambiente DIAN demo (NO producción). Validación con contador/revisor fiscal obligatoria.
- Comando de conexión en Integraciones → DIAN.

### 5. POS offline (plan fila 16, XL)

- IndexedDB/Dexie para cola de ventas sin conexión.
- Sync al regresar conexión: resuelve conflictos por secuencia de timestamp.
- `register_pos_sale` (mig 85) ya produce ventas; offline enqueue local + replay.
- Manejo de numeración de CIU/sincronización. Dificultad alta.

## Gotchas nuevos de esta jornada (nómina + marketing)

### Nómina

- **BEFORE DELETE trigger que retorna `new` aborta el DELETE en silencio**: en DELETE, NEW es NULL → `return new` = `return NULL` = skip fila. Fix: en el guard, `if tg_op = 'DELETE' then return old; end if; return new;`. Bug que costó 30 min depurando smoke (DELETE 0 con periodo desbloqueado, sin error).
- **psql `-c` no soporta `\gset`**: pasar psql -c HEREDOC o split. Si necesitas variable de un INSERT, usar `\gset` requiere psql interactivo/HEREDOC, no `-c "..."`.
- **psql sin `set_config` → RLS niega en silencio (DELETE 0)**: el rol de la URL de service bypass RLS solo si no hay FORCE. Heredoc con `select set_config('request.jwt.claims', ...)` ANTES de inserts/deletes para que la sesión tenga identidad.
- **El cierre de periodo congela las líneas para siempre, incluido el cascade**: borrar un periodo cerrado dispara el guard en cada línea via cascade → aborta → FK violation. Diseño intencional: periodos cerrados son inmutables, no hay desbloqueo expuesto.
- **`round(numeric * numeric / 100)` devuelve numeric, no bigint**: el `returns table (..., bigint)` casca con "structure of query does not match". Fix: cast `::bigint` en cada round.

### Marketing

- **`scoped()` retorna `PostgrestFilterBuilder` (post-`.select().eq()`), NO tiene `.update()`/`.delete()`**: para writes usa `supabase.from(table).update({...}).eq('org_id', member.orgId).eq(...)` patrón directo, no `scoped()`. `scoped` solo para selects que esperan filter builder.
- **`.delete()` en child table sin org_id (e.g. `marketing_recipients`)**: filtra por `campaign_id` (path por padre). No existe `org_id` en la child; `apply_child_rls` hereda aislamiento por FK. No intentar `.eq('org_id', ...)` en child — falla column no exist.
- **`server-only` in `queries/shared.ts` NO bloquea import en mutations `'use server'`**: 33 mutations ya lo hacen (`belongsToOrg`, `currentEmployeeId`). `'use server'` archivos son server-resident. Confirma patrón antes de dudar.
- **`Fragment` con key en `.map()` cuando cada iteración emite múltiples `<tr>` hermanos**: `<>` shorthand no acepta key; debe ser `<Fragment key={id}>...</Fragment>`. Caso: expansión inline de filtros como segunda fila de tabla bajo la fila de campaña.
- **db-verify local falla en mig 86 (`vector` extension)**: homebrew PG no tiene `vector`. Migs 87–91 validan por apply remota + psql policy check, no db-verify local. No gastar tiempo arreglando PG local; rompe solo en mig 86 onwards.

## Gotchas previos que siguen vigentes

- **psql `-c` multi-sentencia = transacción única**: un error revierte todo. Para data-fixes, verificar con select al final del bloque o de a una.
- **RPC de módulos en `public`, no en `app`** (PostgREST solo expone esquemas expuestos).
- **Migraciones ya aplicadas a remota NO se re-aplican**: cambios → SQL manual a remota + editar archivo local para bases frescas (patrón 57/58, ahora 90).
- **Tipos a mano en `Functions`**: el generador solo pone tablas + check-constraints; las firmas RPC se mantienen a mano.
- **`enabled_modules` explícito pisa el preset**: probes en demo usan `enabled_modules || array['<key>']`.
- **PostgREST "function not found without parameters"** = undefined en payload o falta grant, casi siempre lo primero.
- **Supabase MCP apunta a otro proyecto** — todo por psql con `SUPABASE_DB_URL` de `.env.local`.
- **vault en db-verify**: funciones plpgsql con `vault.*` crean OK en PG plano (cuerpo se valida en ejecución). No referenciar vault en migraciones de tablas.
- **Mutations: `'use server'`, NO `'server-only'`** — server-only en archivo importado por client component rompe build.

## Receta módulo (condensada — ver commit previo para detalle)

Registry (`src/lib/modules/registry.ts`) → gen-module-sql (`node --experimental-strip-types scripts/gen-module-sql.mjs --module <key>`) → migración (tablas + `apply_standard_rls` + bloque generado + `module_dependencies` + backfill + `sector_modules` formato `select '<s>', k, 'add' from unnest(...)`) → presets en `src/lib/modules.ts` → deps en registry → plan en `src/lib/plans.ts` → queries + mutations → page/client → apply remota + gen-types → db-verify → vitest → tsc → e2e → commit.

### Receta nómina (de esta jornada)

- No hay módulo nuevo (nómina ya existe como clave del preset).
- Tablas hijas (payroll_concept_lines): `apply_standard_rls('payroll_concept_lines', 'nomina:read', 'nomina:write')` con `org_id` directo (no child_rls — tiene su propio org_id).
- Valores por defecto a 0 (reglas): el contador los fija. Banner "parámetros en cero" en la UI cuando minWage=0.
- Cierre congela para siempre. No exponer desbloqueo.

### Receta marketing tablas hijas (de esta jornada)

- Mismo módulo (clave `marketing` ya en `valid_module_keys` desde mig 63). Mig nueva NO toca `valid_module_keys`/`permissions`/`sector_modules`/`module_dependencies`.
- Tabla con `org_id` propio (`marketing_templates`): `apply_standard_rls('marketing_templates', 'marketing:read', 'marketing:write')`. Genera 4 policies (select/insert/update/delete) — verificado vía `pg_policies`.
- Para writes en `scoped()`-like filter, usar `supabase.from(table).update({...}).eq('org_id', member.orgId).eq(...)` (NO `scoped().update()` — filter builder no expone `.update`).
- `generateRecipients` antes extendía `clients` sin filtros firma `(campaignId: string)`; ahora firma `(input: {campaignId, filters?})`. Cambio retrocompatible: filters undefined = todos los clientes con phone.

## Estado demo (datos remota)

- Usuario: `DEMO_ACCOUNT_EMAIL`/`DEMO_ACCOUNT_PASSWORD` en `.env.local`.
- Dos empresas: «IPS Bogota» (tecnologia), «Kigyo Demo Dos» (salud, `salud-veterinaria`, flagship), plan growth.
- «Kigyo Demo Dos» `enabled_modules` explícito con módulos de las tres jornadas. Para probes: `|| array['<key>']`.
- Smoke creds (contraseña NO hardcodear aqui): org `f8eafe69-c415-479c-8eac-c17b1a29c6db`, admin `eb711727-43fe-46a2-b8f5-f63b914191ea`. JWT claims vía `set_config('request.jwt.claims', '{"sub":"...","role":"authenticated"}', false)` en cada sesión psql.

## Comandos rápidos

```
npm test                                    # vitest
npm run typecheck                           # tsc --noEmit
npm run build                               # build de producción
./scripts/db-verify.sh                      # migraciones contra PG desechable
set -a; source .env.local; set +a
DB_URL="$SUPABASE_DB_URL"; node scripts/gen-db-types.mjs "$DB_URL"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL' ... SQL
```

---

## Prompt para retomar (nueva sesión)

Copia este bloque como primer mensaje del próximo chat para arrancar con contexto mínimo y evitar la ventana de contexto lleno:

```
Retoma Kigyo. Lee docs/CONTEXTO_SESION.md (actualizado 2026-08-15): estado, commits de la jornada, pendientes ordenados y gotchas.

Nómina legal (plan CRM/ERP/POS fila 12) y marketing automation (fila 14) ya commiteados y verificados (vitest 256/256, tsc 0, build 0). Working tree limpio. Branch ahead origin ~12 commits (no push).

Próximo paso: facturación electrónica DIAN (plan fila 15, XL). Ver PLAN_CRM_ERP_POS.md sección 6.x.

Pasos sugeridos, en orden:
1. E2e smoke DEFERIDO de nómina + marketing (escribir `e2e/nomina.spec.ts` + `e2e/marketing.spec.ts`, levantar `npm run dev`, creds demo de `.env.local` org f8eafe69… admin eb711727…). Mínimo en CONTEXTO_SESION pendiente 1. SI chrono aprieta, saltar y marcar.
2. DIAN (XL): integración con `integraciones` (mig 64, vault para certificados). Tabla `dian_events`. Generación UBL/XML, envío DIAN demo (NO prod), recepción CUFE, PDF representación gráfica. Validación contador/revisor fiscal OBLIGATORIA. Comando en Integraciones → DIAN.
3. POS offline (fila 16, XL): IndexedDB/Dexie cola ventas, sync anti-conflictos timestamp, replay queue.

Reglas vinculantes (AGENTS.md):
- org_id = empresa, nunca company_id. Sin public.companies ni CompanyId.
- app.apply_standard_rls/apply_child_rls/orgs_with congelados.
- Supabase MCP apunta a otro proyecto — TODO vía psql con SUPABASE_DB_URL de .env.local.
- Mutations: 'use server', no 'server-only'.
- Migraciones ya aplicadas a remota: cambios → SQL manual a remota + editar archivo local para bases frescas (patrón 57/58/90/91).
- Tipos RPC a mano en Functions; tablas + check-constraints por generador.
- db-verify local falla en mig 86 (vector extension) — validar migs nuevas aplicando remota + psql policy check.
- Nómina 4.3: validación contador laboral OBLIGATORIA antes de producción. Valores por defecto a 0; NO inventar cifras regulatorias.
- Marketing conversión DEFERIDA (sin proveedor real). No inventar métricas sin fuente.
- DIAN: ambiente demo, NO producción. Validación revisor fiscal obligatoria.

Modo caveman ultra. No crees archivos .md nuevos (los planificamos). Updatea CONTEXTO_SESION.md al terminar para que la próxima sesión arranque con el prompt de acá.
```