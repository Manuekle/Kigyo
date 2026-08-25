-- ═══════════════════════════════════════════════════════════════════════════
-- 106 · El pago deja de ser opcional
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Hasta hoy nadie pagaba nunca, y no por un fallo: por una ausencia. Registrarse
-- creaba una cuenta con `plan = 'starter'` (DEFAULT_PLAN en `lib/plans.ts`),
-- `billing_status` en null, y ninguna línea del producto volvía a preguntar. La
-- página de precios cobra $80.000/mes por Starter; el producto lo regalaba, sin
-- prueba, sin vencimiento y sin final. `billing_status` se escribía desde el
-- webhook y **no lo leía nadie** — 0 lectores en `src/`, solo los tipos
-- generados y un test que comprueba que no está concedida.
--
-- El botón de pago existía (checkout de Polar, migración 38 + `mutations/
-- billing.ts`), pero solo se llegaba a él eligiendo voluntariamente subir de
-- plan. Un producto que cobra por Starter y no tiene ningún camino por el que
-- alguien llegue a pagar Starter no tiene un problema de UI: no tiene modelo de
-- cobro.
--
-- ─── Qué añade esta migración ──────────────────────────────────────────────
--
--   1. `accounts.access_state` — pending | active | delinquent. La única
--      pregunta que el producto necesita hacerle al dinero, contestada con
--      vocabulario propio y no con el del proveedor.
--   2. La extiende `app.company_is_active`, que ya es el predicado de las 543
--      políticas RESTRICTIVE de la migración 99. **No se crea ni una política
--      nueva**: cambiar la función cambia las 543 a la vez.
--   3. `apply_subscription` escribe `access_state` desde el estado que manda el
--      proveedor.
--
-- ─── Por qué una columna nueva y no `billing_status` ───────────────────────
--
-- `billing_status` habla el idioma del proveedor: 'active', 'past_due',
-- 'incomplete', 'incomplete_expired', 'unpaid', 'canceled'… — un vocabulario
-- que cambia cuando cambie el proveedor, y que las migraciones 26 y 38
-- decidieron NO conceder a `authenticated` junto a `billing_customer_id` y
-- `billing_subscription_id`. Esa decisión sigue en pie y con razón: qué
-- identificador tiene el grupo en la pasarela no es asunto de un empleado.
--
-- `access_state` es la proyección de tres valores que sí se puede conceder,
-- porque es exactamente lo que la pantalla de pago le va a decir al cliente
-- sobre su propia cuenta. El test `account-scope.test.ts` › «never names a
-- billing column in any grant» sigue verde sin tocarlo: esta columna no es
-- `billing_*` y los tres identificadores del proveedor siguen revocados.
--
-- ─── Por qué el muro respeta el asistente ─────────────────────────────────
--
-- La condición no es «la cuenta está al día», es «la cuenta está al día **o**
-- la empresa todavía se está configurando». Sin esa segunda mitad, el paso de
-- sucursales del asistente —que escribe en `sites`, tabla con `org_id` y por
-- tanto con guardia— fallaría para toda cuenta nueva, y el cliente se toparía
-- con el muro antes de haber visto qué compra.
--
-- El orden queda: el asistente se recorre entero y escribe; `finishCompanySetup`
-- estampa `setup_completed_at` **antes** de mandar el navegador a Polar (ya lo
-- hacía, por otra razón, y aquí es justo lo que cierra la puerta); al volver, el
-- webhook pone `access_state = 'active'` y la abre. Si abandona el checkout, la
-- empresa queda en solo lectura y el panel lo manda a `/suscripcion`.
--
-- ─── Lo que NO hace ────────────────────────────────────────────────────────
--
-- `service_role` sigue con `rolbypassrls`, así que el webhook puede reactivar
-- una cuenta pase lo que pase — es la propiedad que hace esto reversible, y la
-- misma que la migración 99 dejó escrita.
--
-- SELECT nunca se toca. Una cuenta que no ha pagado ve sus datos y no puede
-- escribir; confiscarle la lectura sería castigar a quien todavía puede pagar.
-- ═══════════════════════════════════════════════════════════════════════════

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · La columna
 * ═══════════════════════════════════════════════════════════════════════════ */

alter table public.accounts
  add column if not exists access_state text not null default 'pending'
    check (access_state in ('pending', 'active', 'delinquent'));

comment on column public.accounts.access_state is
  'Si la cuenta puede escribir hoy. pending = nunca pagó · active = al día · '
  'delinquent = pagó y dejó de pagar. Proyección propia de billing_status: '
  'esta se concede a authenticated, aquella no.';

-- ─── El grandfathering ─────────────────────────────────────────────────────
--
-- Todo lo que ya existe pasa a 'active'. No es generosidad: esas cuentas
-- entraron cuando la regla no existía, y estrenar un muro de pago sobre quien
-- ya estaba dentro es cambiarle el trato a alguien sin avisarle. El default de
-- la columna es 'pending', así que la regla aplica desde la siguiente cuenta.
update public.accounts set access_state = 'active';

-- ─── La concesión ──────────────────────────────────────────────────────────
--
-- La migración 26 revocó la tabla y concede columna a columna, así que una
-- columna nueva es invisible mientras no se nombre. Se nombra: la pantalla de
-- suscripción tiene que poder decirle a la cuenta en qué estado está, y el
-- panel tiene que poder decidir si redirige.
--
-- Deliberadamente sin UPDATE. El estado lo escribe `apply_subscription`, que es
-- de `service_role`. Si `authenticated` pudiera escribirlo, el muro sería una
-- sugerencia.
grant select (access_state) on public.accounts to authenticated;

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · El predicado que ya tenían las 543 políticas
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Si la empresa puede escribir hoy.
 *
 * Dos condiciones, y la segunda es nueva:
 *
 *   · la empresa no está suspendida (migración 99, sin cambios);
 *   · **y** o bien su configuración no ha terminado —el asistente tiene que
 *     poder escribir— o bien la cuenta que la posee está al día.
 *
 * `join` y no `exists` anidado sobre `accounts` porque `organizations.account_id`
 * es NOT NULL desde la migración 26: no hay empresa huérfana que el join pueda
 * perder, y una empresa sin cuenta legible no debería poder escribir de todas
 * formas.
 *
 * Sigue siendo `stable` y `security definer`: la evalúan 543 políticas en cada
 * escritura, y tiene que ver `accounts` sin que RLS se lo impida.
 */
create or replace function app.company_is_active(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.organizations o
    join public.accounts a on a.id = o.account_id
    where o.id = p_org_id
      and o.status = 'active'
      and (o.setup_completed_at is null or a.access_state = 'active')
  );
$$;

comment on function app.company_is_active(uuid) is
  'Si la empresa puede escribir hoy: no suspendida, y con la cuenta al día '
  'salvo mientras el asistente de configuración sigue abierto.';

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · Quien escribe el estado
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Aplica lo que el proveedor dice de una suscripción.
 *
 * Idéntica a la de la migración 38 salvo por el bloque de `access_state`. Se
 * reescribe entera —y no con un `alter`— porque es una función, y dejar la
 * mitad vieja viva no es una opción.
 *
 * `trialing` cuenta como al día: una prueba que el proveedor gestiona es una
 * suscripción en curso, y tratarla como impago le cerraría la puerta a quien
 * Polar acaba de dejar entrar. `p_status` null sigue significando «este evento
 * no habla del estado», no «cancelado».
 */
create or replace function public.apply_subscription(
  p_account_id uuid,
  p_plan       text default null,
  p_status     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan   text;
  v_status text;
  v_max    int;
begin
  if p_account_id is null then
    raise exception 'apply_subscription necesita una cuenta.' using errcode = 'check_violation';
  end if;

  if p_plan is not null and not exists (
    select 1 from public.plan_limits l where l.plan = p_plan
  ) then
    raise exception 'Plan desconocido: %.', p_plan using errcode = 'check_violation';
  end if;

  update public.accounts a
  set plan           = coalesce(p_plan, a.plan),
      billing_status = coalesce(p_status, a.billing_status),
      -- El estado de acceso solo se mueve cuando el evento habla del estado.
      -- Un evento que solo cambia de producto no debe abrir ni cerrar la
      -- puerta: `plan` y `access_state` contestan preguntas distintas.
      access_state   = case
                         when p_status is null then a.access_state
                         when p_status in ('active', 'trialing') then 'active'
                         else 'delinquent'
                       end
  where a.id = p_account_id
  returning a.plan, a.billing_status into v_plan, v_status;

  if v_plan is null then
    raise exception 'No existe la cuenta %.', p_account_id using errcode = 'no_data_found';
  end if;

  select l.max_companies into v_max from public.plan_limits l where l.plan = v_plan;

  -- A status the provider set to anything other than active means the money
  -- stopped. Null is not that: it is an account whose event did not mention
  -- the subscription state at all.
  if v_status is not null and v_status not in ('active', 'trialing') then
    update public.organizations set status = 'suspended'
    where account_id = p_account_id and status <> 'suspended';
    return;
  end if;

  with ranked as (
    select o.id,
           row_number() over (order by o.created_at, o.id) as rn
    from public.organizations o
    where o.account_id = p_account_id
  )
  update public.organizations o
  set status = case
                 when v_max is null or r.rn <= v_max then 'active'
                 else 'suspended'
               end
  from ranked r
  where r.id = o.id
    and o.status is distinct from case
                                    when v_max is null or r.rn <= v_max then 'active'
                                    else 'suspended'
                                  end;
end;
$$;

revoke all on function public.apply_subscription(uuid, text, text) from public, anon, authenticated;
grant execute on function public.apply_subscription(uuid, text, text) to service_role;

comment on function public.apply_subscription(uuid, text, text) is
  'Aplica plan y estado de suscripción a una cuenta. Escribe access_state, que '
  'es lo que la capa RLS lee para decidir si sus empresas pueden escribir.';

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · Comprobación
 * ═══════════════════════════════════════════════════════════════════════════ */

do $$
declare
  v_pending int;
  v_granted boolean;
begin
  -- Ninguna cuenta preexistente puede haberse quedado fuera.
  select count(*) into v_pending from public.accounts where access_state <> 'active';
  if v_pending > 0 then
    raise exception 'El backfill dejó % cuenta(s) fuera de active.', v_pending;
  end if;

  -- La columna tiene que ser legible, o la pantalla de pago no puede
  -- decirle a nadie por qué está ahí.
  select has_column_privilege('authenticated', 'public.accounts', 'access_state', 'select')
    into v_granted;
  if not v_granted then
    raise exception 'authenticated no puede leer accounts.access_state.';
  end if;

  -- Y NO puede escribirla: un muro que el visitante mueve no es un muro.
  select has_column_privilege('authenticated', 'public.accounts', 'access_state', 'update')
    into v_granted;
  if v_granted then
    raise exception 'authenticated puede escribir accounts.access_state.';
  end if;
end;
$$;

-- ─── Rollback ──────────────────────────────────────────────────────────────
--
--   create or replace function app.company_is_active(p_org_id uuid) … (v. 99)
--   create or replace function public.apply_subscription(…)          … (v. 38)
--   revoke select (access_state) on public.accounts from authenticated;
--   alter table public.accounts drop column access_state;
