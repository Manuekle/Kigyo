# Fase 0 — Decisiones cerradas y contratos

**Entregable de la Fase 0 del plan de arquitectura multiempresa.**
Referencias: `docs/AUDITORIA_ARQUITECTURA_KIGYO.md` (auditoría), `docs/PLAN_NUEVA_ARQUITECTURA_KIGYO.md` (plan original).

**Estado:** contratos cerrados. **No se ha escrito código.** La Fase 1 no empieza hasta que la sección 9 esté verificada.
**Fecha:** 2026-08-10

---

## 1. Decisiones

### 1.1 Aprobadas por el usuario

| # | Decisión | Resolución |
|---|---|---|
| **M1** | Dirección de la jerarquía | **`accounts` por encima.** `organizations` ≡ Company. Cero tablas operativas tocadas, cero políticas RLS de datos reescritas. |
| **M2** | Alcance inicial | **Account + Company primero.** `sites` se declara en la Fase 1 solo como forma acordada; se implementa en la Fase 6. |
| **M4** | Herencia del owner | **Membresía explícita.** Ser owner del account no concede acceso a datos de empresa. Botón "Unirme a esta empresa", auditado. |
| **M5** | Alcance del plan | **Por account.** Todas las empresas del grupo comparten tier. |

### 1.2 Cerradas por defecto (recomendación aplicada — decir si se quiere otra cosa)

| # | Decisión | Default aplicado | Reversible |
|---|---|---|---|
| **M3** | Estrategia de migración | **Dual-read solo para `plan`.** `organizations.plan` se conserva hasta la Fase 7. Todo lo demás, cutover aditivo. | Sí |
| **M6** | Límites por plan | Ver §7.2. Starter = **1 empresa**. | Sí, es TS |
| **M7** | Proveedor de pagos | **Sin decidir. No bloquea nada hasta la Fase 7.** Hasta entonces el plan se cambia con `npm run db:plan`. | — |
| **M8** | Catálogo de subsectores | El de `AUDITORIA §F.2`, 12 sectores. Se revisa al llegar a la Fase 4. | Sí, es data |
| **M9** | Fitness & Bienestar | Sector propio, **sin módulo vertical nuevo**, con preset de módulos existentes. | Sí |
| **M10** | Desactivar módulo con dependientes | **Bloquear**, no cascada. "Desactiva Ecommerce primero." | Sí |
| **M11** | Renombrar `org_id` → `company_id` | **No se hace.** Se documenta como contrato (§2). Se reevalúa tras la Fase 8. | Sí |

**M7 es la única que puede sorprender más adelante.** No bloquea las Fases 1–6, pero conviene elegir proveedor antes de empezar la Fase 5 (onboarding), porque el wizard querrá saber si hay un paso de pago.

---

## 2. Contrato de nomenclatura

Esta es la deuda que compra la decisión M1. Se paga con disciplina, no con una migración.

> **`org_id` significa «id de empresa» (Company).**
> `public.organizations` es la **empresa operativa**, no la cuenta comercial.
> La cuenta comercial es `public.accounts`.

Obligaciones que hace vinculantes este contrato:

1. **`AGENTS.md` gana una sección** con el párrafo de arriba, antes de escribir la primera línea de la Fase 1. Es el archivo que leen los agentes y las personas nuevas.
2. **Toda tabla nueva sigue usando `org_id`**, no `company_id`. Mezclar las dos convenciones es peor que tener una sola imperfecta.
3. **En TypeScript** el vocabulario de producto sí es «empresa»: `member.companies`, `activeCompanyId`, `createCompany()`. El campo `member.orgId` se conserva porque lo consumen ~602 sitios, con un comentario que remita aquí.
4. **`comment on table public.organizations`** se actualiza en la Fase 1 para decirlo en la base de datos.
5. **Prohibido** crear una tabla `public.companies`, una vista `companies`, o un alias de tipo `CompanyId = OrgId`. Un segundo nombre para lo mismo es exactamente el drift que este contrato existe para evitar.

---

## 3. Contrato de datos — Fase 1

DDL exacto que la Fase 1 implementará. Nada de esto está escrito todavía.

### 3.1 Tablas nuevas

```sql
-- ─── La cuenta comercial ────────────────────────────────────────────────────
-- Pequeña a propósito: aquí solo va lo que se factura y lo que limita.
-- Los datos de operación (sector, módulos, branding, fiscales) viven en
-- public.organizations, que es la EMPRESA. Ver docs/FASE_0_CONTRATOS.md §2.

create table public.accounts (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (length(btrim(name)) between 1 and 120),
  plan                    text not null default 'starter'
                            check (plan in ('starter', 'growth', 'enterprise')),
  -- Nulas hasta que exista un proveedor de pagos (M7). Nunca legibles por
  -- `authenticated`: ver el REVOKE/GRANT por columna más abajo.
  billing_customer_id     text,
  billing_subscription_id text,
  billing_status          text,
  -- Null = el wizard de onboarding no ha terminado. Las cuentas creadas por el
  -- backfill se marcan como completadas para que nadie vivo caiga en el wizard.
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger accounts_touch before update on public.accounts
  for each row execute function app.touch_updated_at();

comment on table public.accounts is
  'Cuenta comercial. Contiene el plan y la facturación. Las empresas son public.organizations.';

-- ─── Quién manda sobre la CUENTA ────────────────────────────────────────────
-- Deliberadamente sin matriz de permisos: son tres decisiones, no treinta.
--   owner   — todo, incluido crear y eliminar empresas
--   billing — plan y facturación, nada más
--   admin   — crear empresas e invitar, sin tocar el plan
--
-- Ninguno de los tres concede acceso a los DATOS de una empresa. Eso requiere
-- una fila en public.memberships. Decisión M4.

create table public.account_memberships (
  account_id  uuid not null references public.accounts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null check (role in ('owner', 'billing', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (account_id, user_id)
);

create index account_memberships_user_idx on public.account_memberships (user_id);

create trigger account_memberships_touch before update on public.account_memberships
  for each row execute function app.touch_updated_at();
```

### 3.2 Columna sobre `organizations`

```sql
alter table public.organizations
  add column account_id uuid references public.accounts (id) on delete cascade;

create index organizations_account_idx on public.organizations (account_id);

-- `not null` se aplica DESPUÉS del backfill, en el mismo archivo de migración.
```

`organizations.plan` **no se toca en la Fase 1**. Sigue existiendo y sigue siendo la fuente durante el dual-read (M3). Se elimina en la Fase 7.

### 3.3 Primitivos de autorización de cuenta

Mismo patrón que `app.orgs_with`: `SECURITY DEFINER`, `STABLE` (para que Postgres lo suba a InitPlan), `set search_path = ''`.

```sql
create or replace function app.current_account_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select am.account_id
  from public.account_memberships am
  where am.user_id = (select auth.uid());
$$;

-- Las cuentas cuyas empresas el usuario puede ver, aunque no sea miembro de la
-- cuenta. Es lo que permite a un Empleado leer el `plan` de su empresa sin
-- verle la facturación al grupo.
create or replace function app.accounts_of_my_orgs()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select distinct o.account_id
  from public.organizations o
  join public.memberships m on m.org_id = o.id
  where m.user_id = (select auth.uid())
    and o.account_id is not null;
$$;

create or replace function app.is_account_owner(p_account_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.account_memberships am
    where am.user_id    = (select auth.uid())
      and am.account_id = p_account_id
      and am.role       = 'owner'
  );
$$;

-- Crear empresas e invitar. Owner y admin; billing no.
create or replace function app.can_manage_account(p_account_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.account_memberships am
    where am.user_id    = (select auth.uid())
      and am.account_id = p_account_id
      and am.role in ('owner', 'admin')
  );
$$;

revoke all on function
  app.current_account_ids(), app.accounts_of_my_orgs(),
  app.is_account_owner(uuid), app.can_manage_account(uuid)
  from public, anon;
grant execute on function
  app.current_account_ids(), app.accounts_of_my_orgs(),
  app.is_account_owner(uuid), app.can_manage_account(uuid)
  to authenticated;
```

### 3.4 RLS y privilegios

```sql
alter table public.accounts            enable row level security;
alter table public.accounts            force  row level security;
alter table public.account_memberships enable row level security;
alter table public.account_memberships force  row level security;

-- Lectura: miembros de la cuenta, MÁS miembros de cualquiera de sus empresas.
-- Los segundos solo alcanzan las columnas que el GRANT por columna les deja.
create policy accounts_select on public.accounts
  for select to authenticated
  using (
    id in (select app.current_account_ids())
    or id in (select app.accounts_of_my_orgs())
  );

-- El nombre de la cuenta lo cambia el owner. El `plan` NO: lo bloquea el
-- trigger de §3.5, igual que hoy hace app.guard_plan_change sobre organizations.
create policy accounts_update on public.accounts
  for update to authenticated
  using      (app.is_account_owner(id))
  with check (app.is_account_owner(id));

-- Sin política de INSERT ni DELETE para `authenticated`. Las cuentas las crea
-- el trigger de signup (SECURITY DEFINER) y las elimina soporte. Un cliente
-- que puede crear cuentas puede crear planes.

create policy account_memberships_select on public.account_memberships
  for select to authenticated
  using (account_id in (select app.current_account_ids()));

create policy account_memberships_write on public.account_memberships
  for all to authenticated
  using      (app.is_account_owner(account_id))
  with check (app.is_account_owner(account_id));
```

**Privilegios por columna.** La migración 08 concede `select` a nivel tabla y fija `alter default privileges`, así que `accounts` nacería con la facturación legible por cualquier miembro de cualquier empresa del grupo. Se corrige revocando la tabla entera y concediendo columnas:

```sql
revoke all on public.accounts from authenticated;
grant select (id, name, plan, onboarding_completed_at) on public.accounts to authenticated;
grant update (name)                                    on public.accounts to authenticated;

-- `billing_customer_id`, `billing_subscription_id` y `billing_status` quedan
-- sin conceder: invisibles para `authenticated` en cualquier consulta,
-- incluidas las de PostgREST con `select=*`.

grant select, insert, update, delete on public.account_memberships to authenticated;
```

> Nota de forma: revocar la tabla y volver a conceder por columna es la manera correcta. Restar una columna de un grant a nivel tabla no funciona — Postgres avisa y no hace nada, que es la razón por la que la migración 14 usó un trigger para el plan.

### 3.5 Guard del plan

Misma lógica que `app.guard_plan_change` (migración 14), reapuntada a `accounts`. La versión de `organizations` **se mantiene** durante el dual-read.

```sql
create or replace function app.guard_account_plan_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.plan is distinct from old.plan and current_user = 'authenticated' then
    raise exception 'El plan de la cuenta solo puede cambiarlo el proceso de facturación'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger accounts_guard_plan
  before update on public.accounts
  for each row execute function app.guard_account_plan_change();

revoke all on function app.guard_account_plan_change() from public, anon, authenticated;
```

### 3.6 Backfill

Una cuenta por organización existente. 1:1. Nadie percibe el cambio.

```sql
-- 1. Una cuenta por empresa, heredando su plan y su nombre.
with created as (
  insert into public.accounts (name, plan, onboarding_completed_at)
  select o.name, o.plan, now()
  from public.organizations o
  where o.account_id is null
  returning id, name
)
-- El emparejamiento por nombre no es fiable si dos organizaciones se llaman
-- igual. La migración real usa un CTE con `row_number()` sobre ambos lados, o
-- un bucle plpgsql fila a fila. Se escribe explícito en la Fase 1; aquí queda
-- fijado el RESULTADO exigido, no la técnica.
select 1;

-- 2. El owner de cada cuenta es el administrador más antiguo de su empresa:
--    quien tiene `configuracion:manage`, que es lo que app.is_org_admin mide.
insert into public.account_memberships (account_id, user_id, role)
select o.account_id, m.user_id, 'owner'
from public.organizations o
join public.memberships m on m.org_id = o.id
join public.role_permissions rp
  on rp.org_id = m.org_id and rp.role = m.role
where rp.permission = 'configuracion:manage'
  and o.account_id is not null
on conflict (account_id, user_id) do nothing;

-- 3. Ninguna empresa puede quedar huérfana.
alter table public.organizations alter column account_id set not null;
```

**Invariantes que la migración debe verificar antes de terminar** (con `raise exception` si fallan, dentro de la misma transacción):

```
count(organizations where account_id is null)                        = 0
count(accounts)                                                      = count(organizations)
count(accounts where not exists account_membership with role='owner')= 0
count(accounts a join organizations o where a.plan <> o.plan)        = 0
```

### 3.7 Rollback

La Fase 1 es puramente aditiva y revertible con tres sentencias:

```sql
alter table public.organizations drop column account_id;
drop table public.account_memberships;
drop table public.accounts;
-- más los cuatro helpers de §3.3 y el trigger de §3.5
```

Ninguna fila de negocio se modifica. Ningún dato se pierde. **Este es el criterio que hace segura la Fase 1 y debe conservarse: si en algún momento el rollback deja de ser trivial, la fase se ha pasado de alcance.**

### 3.8 `sites` — forma acordada, no implementada

Se fija aquí para que la Fase 6 no reabra el diseño. **No se crea en la Fase 1.**

```sql
create table public.sites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  code        text,
  name        text not null,
  address     text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, code)
);
create unique index sites_one_default_idx on public.sites (org_id) where is_default;
```

`site_id uuid references sites(id)` se añadirá **solo** a las tablas donde la sucursal es un hecho del negocio, **siempre nullable**: `employees`, `inventory_assets`, `cash_sessions`, `restaurant_orders`, `dining_tables`, `hotel_rooms`, `work_orders`. Nunca a las 66.

---

## 4. Contrato de resolución de contexto

Define la Fase 2. Se fija ahora porque la Fase 1 no puede contradecirlo.

```
1. cookie httpOnly, SameSite=Lax, Secure  →  `kigyo_ctx` = org_id (uuid)
2. getMember() lee TODAS las membresías del usuario
3. si cookie ∈ membresías        →  esa es la empresa activa
   si no (o ausente, o inválida) →  default = memberships.last_active_at DESC,
                                     desempate por created_at ASC
4. member.orgId = empresa activa   ← mismo campo, mismo significado que hoy
5. member.companies = CompanyRef[] ← nuevo, para el selector
6. member.plan      = accounts.plan de la cuenta de la empresa activa
```

**Reglas duras:**

- La empresa activa **nunca** se acepta desde un header, un query param, un body ni `localStorage`. Solo cookie httpOnly validada contra membresías **en el servidor**, en cada request.
- Una cookie que apunta a una empresa donde el usuario ya no es miembro **no es un error**: se descarta en silencio y se cae al default. Un usuario expulsado de una empresa no debe ver una pantalla de fallo.
- Cambiar de empresa **navega a `/dashboard`**, no a la ruta actual. El módulo actual puede no existir en la empresa destino.
- Cambiar de empresa hace `revalidatePath('/dashboard', 'layout')`. El sidebar se deriva de `member.modules`.
- **RLS sigue siendo el techo** (qué puede ver este usuario en total). El contexto activo es **el filtro dentro del techo** (qué está viendo ahora). Nunca se colapsan: colapsarlos significaría meter la empresa activa en las políticas RLS, y una política que depende de una cookie es una política que se puede evadir.

`memberships` gana en la Fase 2:

```sql
alter table public.memberships add column last_active_at timestamptz;
```

---

## 5. Contrato de tipos

Forma objetivo de `Member` al terminar la Fase 2. Los campos existentes **no cambian de nombre ni de significado**.

```ts
export interface CompanyRef {
  orgId: string          // ver §2: es el id de EMPRESA
  name: string
  slug: string
  companyType: string | null
  role: RoleKey          // el rol del usuario EN ESA empresa
}

export interface AccountRef {
  accountId: string
  name: string
  plan: PlanKey
  /** Rol del usuario sobre la CUENTA. null = no es miembro de la cuenta. */
  role: 'owner' | 'billing' | 'admin' | null
}

export interface Member {
  // ── sin cambios respecto de hoy ──────────────────────────────────────────
  userId: string
  email: string
  fullName: string
  avatarUrl: string | null
  orgId: string          // EMPRESA ACTIVA
  orgName: string
  orgSlug: string
  companyType: string | null
  plan: PlanKey          // ← ahora viene de accounts.plan, mismo tipo
  modules: Set<string>
  role: RoleKey          // rol en la empresa activa
  permissions: Set<Permission>

  // ── nuevo en Fase 2 ──────────────────────────────────────────────────────
  account: AccountRef
  /** Todas las empresas del usuario, para el selector. Ordenadas por uso. */
  companies: CompanyRef[]
}
```

**Contrato de compatibilidad:** ningún consumidor existente de `Member` debe requerir cambios. Los ~602 usos de `member.orgId` siguen significando exactamente lo mismo. Si algún cambio de la Fase 1 o 2 obliga a tocar un archivo de `src/server/queries/` o `src/server/mutations/`, es señal de que se rompió este contrato.

---

## 6. Contrato de permisos

### 6.1 Los tres alcances

| Alcance | Tabla | Granularidad | Concede acceso a datos |
|---|---|---|---|
| Cuenta | `account_memberships.role` | 3 roles fijos | **No** |
| Empresa | `memberships` + `roles` + `role_permissions` | Matriz `<module>:<action>` | **Sí** |
| Sucursal | `membership_sites` (Fase 6) | Filtro restrictivo sobre lo anterior | Restringe |

### 6.2 Qué puede cada rol de cuenta

| | `owner` | `admin` | `billing` |
|---|---|---|---|
| Ver la lista de empresas del grupo | ✓ | ✓ | ✓ |
| Crear una empresa | ✓ | ✓ | — |
| Eliminar una empresa | ✓ | — | — |
| Gestionar el plan / facturación | ✓ | — | ✓ |
| Gestionar `account_memberships` | ✓ | — | — |
| **Ver o escribir datos de una empresa** | **—** | **—** | **—** |

### 6.3 Resolución efectiva

```
permisos(usuario, empresa_activa)
  = role_permissions[empresa_activa, memberships[usuario, empresa_activa].role]
```

Sin términos añadidos por la cuenta. **El alcance de cuenta no aparece en `requirePermission()` ni en ninguna política RLS de datos.** Esta es la forma operativa de la decisión M4 y es lo que mantiene el modelo de autorización actual intacto.

### 6.4 "Unirme a esta empresa"

Un `owner` o `admin` de la cuenta puede darse de alta en una empresa del grupo. Contrato de la acción:

1. Inserta una fila en `public.memberships` con un rol **elegido explícitamente** (no automáticamente el más alto).
2. Escribe una entrada en `audit_log` con `org_id` de la empresa destino, para que sea visible en la trazabilidad **de esa empresa**, no solo de la cuenta.
3. Es reversible: salirse borra la membresía.
4. **No** puede saltarse el guard anti-lockout ni el límite de asientos del plan.

### 6.5 Deuda registrada, no resuelta aquí

`employees.access_role` sigue duplicando `memberships.role` (problema P10 de la auditoría). **Fuera de alcance de las Fases 1–3.** Se resuelve en la Fase 4 renombrándolo a `intended_role` con un comentario que declare que no es autoridad. Queda anotado para que nadie lo tome por fuente de verdad mientras tanto.

---

## 7. Contrato de billing

### 7.1 Origen del plan

| Fase | Fuente de verdad | Lectura |
|---|---|---|
| Hoy | `organizations.plan` | directa |
| Fases 1–6 | `accounts.plan` | `getMember()` lee `accounts.plan`, con fallback a `organizations.plan` si es null (dual-read, M3) |
| Fase 7+ | `accounts.plan` | `organizations.plan` eliminada |

Escritura: **solo `service_role`**, en ambas fases, garantizado por trigger (§3.5). Ninguna migración puede aflojar esto.

### 7.2 Límites (M6)

```ts
export interface PlanDef {
  key: PlanKey
  label: string
  description: string
  modules: string[]
  /** Miembros de la CUENTA, sumando todas las empresas. null = sin límite. */
  seats: number | null
  /** Empresas simultáneas activas. */
  maxCompanies: number | null
  /** Sucursales por empresa. Inerte hasta la Fase 6. */
  maxSitesPerCompany: number | null
}
```

| | Starter | Growth | Enterprise |
|---|---|---|---|
| Empresas | **1** | 3 | ∞ |
| Sucursales / empresa | 1 | 5 | ∞ |
| Asientos (cuenta) | 10 | 50 | ∞ |
| Módulos | 8 | 32 | 35 |

Cambio respecto de hoy: `seats` de Growth pasa de `null` a `50`. Las cuentas existentes quedan abueladas a `enterprise`, así que ninguna se ve afectada.

**Enforcement:**
- `maxCompanies` → **trigger en la base de datos**, además del chequeo en la app. Crear una empresa es un objeto de facturación.
- `seats` → **nivel aplicación**, donde ya está (`settings.ts:619`). El razonamiento existente sigue siendo correcto: solo un administrador escribe invitaciones, así que el peor caso es una discrepancia de facturación, no una fuga.

### 7.3 Downgrade

**Regla: un downgrade nunca borra nada.**

- Empresas por encima del límite → `organizations.status = 'suspended'`. Visibles, de solo lectura, con aviso. Nunca ocultas ni eliminadas. El usuario elige cuál conserva activa.
- Módulos fuera del plan → salen de `member.modules` (ya lo hace `resolveModules`) pero **permanecen en `enabled_modules`**, para que al volver a subir reaparezcan como estaban.
- Sucursales por encima del límite → solo lectura, nunca eliminadas.

**Bug latente que este contrato obliga a arreglar:** `updateModules` (`src/server/mutations/settings.ts:462`) guarda la lista completa que envía el formulario, y ese formulario ya viene filtrado por plan. Un administrador que abre Configuración → Módulos tras un downgrade y pulsa Guardar **borra permanentemente** los módulos que el plan ya no incluye. Hoy es inofensivo porque nadie hace downgrade; en cuanto exista facturación real, no lo es. Se arregla en la Fase 7 fusionando la selección entrante con los módulos guardados que el plan actual no permite ver.

---

## 8. Reglas invariantes de la migración

Vinculantes para todas las fases. Una fase que viole una de estas se revierte, no se parchea.

1. **Ninguna fase anterior a la 6 modifica una política RLS de una tabla de datos.** Las Fases 1–5 solo añaden políticas a tablas nuevas.
2. **Ninguna fase anterior a la 6 modifica `src/server/queries/` ni `src/server/mutations/`** salvo `settings.ts` y los archivos nuevos. Si una fase necesita tocarlos, el contrato de §5 se rompió.
3. **`app.orgs_with`, `app.apply_standard_rls` y `app.apply_child_rls` no se modifican.** Son el aislamiento probado. Cualquier necesidad de cambiarlos es señal de que se está deslizando hacia la Opción 1 descartada.
4. **Toda migración es revertible con sentencias explícitas**, escritas como comentario al final del archivo.
5. **Toda migración que hace backfill verifica sus invariantes** con `raise exception` dentro de la misma transacción.
6. **Cada fase deja la suite en verde sin modificar tests existentes.** Añadir tests, sí. Cambiar un test existente para que pase es la señal de alarma principal.
7. **El plan solo lo escribe `service_role`.** En toda fase.
8. **Un usuario con una sola empresa no debe notar ninguna diferencia** hasta la Fase 5.

### Definition of Done por fase

Una fase está terminada cuando, y solo cuando:

- [ ] `npm run typecheck` limpio
- [ ] `npm test` en verde **sin haber modificado un test preexistente**
- [ ] `npm run db:verify -- --tests` en verde (incluye la suite RLS)
- [ ] Las invariantes de la §8 se cumplen, verificadas a mano
- [ ] El rollback está escrito y probado en una base de datos de staging
- [ ] Lo que la fase **no** hace está anotado explícitamente

---

## 9. Puerta de entrada a la Fase 1

La Fase 1 no empieza hasta que estos seis puntos estén hechos. Ninguno es código de producto.

| # | Tarea | Salida |
|---|---|---|
| 1 | Sección de nomenclatura en `AGENTS.md` (§2) | Commit de documentación |
| 2 | Confirmar M6 (límites de plan) o corregirlos | Tabla §7.2 aprobada |
| 3 | Confirmar que Starter = 1 empresa es la oferta comercial que quieres | — |
| 4 | Verificar en staging que el backfill de §3.6 produce sus cuatro invariantes | Log de la ejecución |
| 5 | Escribir `supabase/tests/rls/005_account_isolation.sql` **antes** que la migración | Test que falla hoy y pasa tras la Fase 1 |
| 6 | Snapshot de `supabase/tests/rls/00{1,2,3,4}` en verde sobre `main` | Línea base para comparar |

### El test 005, escrito primero

Contrato de lo que debe afirmar, para que se escriba antes que la migración y no se ajuste a ella:

1. Un miembro de la empresa A **puede** leer `accounts.plan` de su cuenta.
2. Un miembro de la empresa A **no puede** leer `billing_customer_id` de ninguna cuenta — ni de la suya. `select *` debe fallar o no devolver la columna.
3. Un miembro de la empresa A **no puede** leer la fila de la cuenta B.
4. Un `owner` de la cuenta con empresas A y B, **sin membresía en B**, obtiene **cero filas** de cualquier tabla operativa de B. *(Ésta es la afirmación central de la decisión M4.)*
5. Un `owner` **no puede** cambiar `accounts.plan`: el trigger lo rechaza con `insufficient_privilege`.
6. Un usuario que no es miembro de ninguna empresa de la cuenta obtiene cero filas de `accounts` y de `account_memberships`.
7. Los correlativos de `app.next_code` siguen siendo únicos **por empresa**, no por cuenta.

---

## 10. Lo que la Fase 1 explícitamente NO hace

Anotado para que no se cuele por alcance:

- No crea `sites`, ni `sectors`, ni `module_dependencies`.
- No toca `getMember()` más allá del dual-read del plan. **El `.limit(1)` sigue ahí** — se quita en la Fase 2.
- No añade el selector de empresa ni ninguna UI.
- No permite crear una segunda empresa. Eso es la Fase 3.
- No toca el trigger `handle_new_user` salvo para crear el `account` y su `account_membership(owner)` junto a la organización. Sigue creando una empresa por signup.
- No elimina `organizations.plan`.
- No arregla P6, P9, P10, P14 ni el bug de `updateModules`. Están calendarizados: P6/P14 en la Fase 4, P10 en la Fase 4, P9 en la Fase 6, `updateModules` en la Fase 7.
