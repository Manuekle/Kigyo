# Contexto de sesión — para retomar

Fecha: 2026-08-15. Rama: `feat/design-system-refresh` (11+ commits ahead de origin).
Working tree: limpio tras commits de nómina (Pase A+B) y docs cleanup. Próximo activo: marketing automation (pendiente 2).

---

## Estado

Suite re-corrida tras Pase B nómina: vitest 256/256 · tsc 0 errores · build 0 errores. E2e smoke nómina **deferido** (ver pendiente 1).
Remota: migraciones 1–90 aplicadas. Tipos regenerados (198 tablas) tras mig 89; mig 90 (tax_id + payroll) aplicada a remota y commiteada;
tipos `lock_payroll_period`/`export_payroll_pila` añadidos a mano al bloque `Functions`.

Branch ahead ~11 commits orig no pusheados desde cuts anteriores (usuario decide cuándo push).

## Commits de esta jornada

| Commit | Qué |
|---|---|
| `8eeef8e` `0f3cabb` `40e3f8e` `a6bfd22` `ee5f8fc` | previos (design refresh) |
| `690cd84` | feat(compras): directorio de proveedores (mig 87) |
| `a4869be` | feat(comercial): pedidos B2B (mig 88 sales_orders/items, RPC create_order_from_quote, módulo `pedidos`) |
| `49f97aa` | feat(soporte): portal público de tickets (mig 89, /soporte/[token], mutations portal.ts, botones en ficha cliente) |
| `feat(nomina)` (este jornal) | feat(nomina): nómina legal con cierre de periodo y PILA (mig 90 payroll_rules/concepts/concept_lines/locked_at, employees.tax_id, RPCs lock_payroll_period + export_payroll_pila; queries/mutations nomina.ts; client.tsx desglose+cierre+reglas+conceptos+desprendible+PILA; tipos RPC a mano) |
| `chore(docs)` (este jornal) | chore(docs): poda de planes históricos y refs (borra 5 docs absorbidos en AGENTS.md/AUDITORIA; actualiza refs en AUDITORIA/FASE_0/PLAN_CRM_ERP_POS/CONTEXTO) |

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

### 1. Nómina legal — Pase B commiteado (DONE); queda e2e + validación contador

- **Commiteado** este jornal: `feat(nomina)` + `chore(docs)`. Mig 90 aplicada a remota. Vitest 256/256, tsc 0, build 0.
- **`payroll_concept_lines`** tipado OK en `types.ts` (org_id, payroll_period_id, employee_id, name, kind, amount_cents, position). RLS `nomina:read`/`nomina:write` vía `apply_standard_rls` (org_id directo).
- **E2e smoke DELIBERADO NO ESCRITO**: único spec existente es `company-switch.spec.ts`. Smoke nómina (abrir periodo → añadir concepto → editar monto → cerrar → verificar read-only → exportar PILA) require nuevo spec + dev server + auth demo + módulo nómina habilitado. Deferido por scope/chrono. **Arrancar próxima jornada escribiendo `e2e/nomina.spec.ts`** ( nuevo archivo, permitido — no es .md) y levantar `npm run dev` + creds demo de `.env.local` (org `f8eafe69…`, admin `eb711727…`).
- **`route-guard.test`** — `/dashboard/nomina` ya tiene page.tsx pre-existente, no requiere nuevo page.
- **Validación con contador laboral colombiano OBLIGATORIA** antes de producción (plan 4.3): salario mínimo, auxilio transporte, porcentajes salud/pensión/ARL/caja todo a 0 por defecto. Banner "parámetros en cero" en UI cuando minWage=0 (ya hecho). NO inventar cifras.

### 2. Marketing automation (plan fila 14) — ACTIVO (próxima jornada)

Brechas: segmentación de clientes, triggers manuales, plantillas de WhatsApp/email, medición de conversión.
Consumir `marketing` (mig 63 ya) + `integraciones` (mig 64). Query nueva + page nueva. Módulo `marketing` ya existe.

### 3. Facturación electrónica DIAN (plan fila 15, XL)

- Integración con `integraciones` (vault para certificados).
- Generación UBL/XML,_envío a DIAN, recepción del CUFE, PDF con representación gráfica.
- Guardar eventos DIAN en tabla `dian_events` (error/aceptación/rechazo).
- Test con ambiente DIAN demo (NO producción). Validación con contador/revisor fiscal obligatoria.
- Comando de conexión en Integraciones → DIAN.

### 4. POS offline (plan fila 16, XL)

- IndexedDB/Dexie para cola de ventas sin conexión.
- Sync al regresar conexión: resuelve conflictos por secuencia de timestamp.
- `register_pos_sale` (mig 85) ya produce ventas; offline enqueue local + replay.
- Manejo de numeración de CIU/sincronización. Dificultad alta.

## Gotchas nuevos de esta jornada (nómina)

- **BEFORE DELETE trigger que retorna `new` aborta el DELETE en silencio**: en DELETE, NEW es NULL → `return new` = `return NULL` = skip fila. Fix: en el guard, `if tg_op = 'DELETE' then return old; end if; return new;`. Bug que costó 30 min depurando smoke (DELETE 0 con periodo desbloqueado, sin error).
- **psql `-c` no soporta `\gset`**: pasar psql -c HEREDOC o split. Si necesitas variable de un INSERT, usar `\gset` requiere psql interactivo/HEREDOC, no `-c "..."`.
- **psql sin `set_config` → RLS niega en silencio (DELETE 0)**: el rol de la URL de service bypass RLS solo si no hay FORCE. Heredoc con `select set_config('request.jwt.claims', ...)` ANTES de inserts/deletes para que la sesión tenga identidad.
- **El cierre de periodo congela las líneas para siempre, incluido el cascade**: borrar un periodo cerrado dispara el guard en cada línea via cascade → aborta → FK violation. Diseño intencional: periodos cerrados son inmutables, no hay desbloqueo expuesto.
- **`round(numeric * numeric / 100)` devuelve numeric, no bigint**: el `returns table (..., bigint)` casca con "structure of query does not match". Fix: cast `::bigint` en cada round.

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