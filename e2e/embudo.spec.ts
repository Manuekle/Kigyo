import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * Embudo comercial — red de seguridad antes de tocar el modelo.
 *
 *   cliente (ficha real) → cotización → Aceptada → pedido desde cotización
 *
 * Existe porque el embudo se va a reparar: hoy `quotes.client` es `text` y
 * `create_order_from_quote` inserta `sales_orders.client_id = null`, así que
 * la cadena que la interfaz muestra no es una relación. Antes de cambiar eso
 * hace falta una prueba que diga qué funciona *ahora*, o el arreglo y una
 * regresión se ven igual.
 *
 * Lo que este spec fija:
 *   · una cotización se crea enlazada a una ficha real, se acepta y genera
 *     exactamente un pedido;
 *   · el pedido hereda **la ficha**, no solo el nombre — que es lo que la
 *     migración 98 vino a arreglar y lo que se rompería sin darse cuenta;
 *   · el nombre pactado viaja aparte y se conserva;
 *   · una cotización que ya tiene pedido no puede generar otro (KG105).
 */

function localEnv(name: string): string | undefined {
  try {
    const raw = readFileSync('.env.local', 'utf8')
    const line = raw.split('\n').find((l) => l.startsWith(`${name}=`))
    return line?.slice(name.length + 1).replace(/^["']|["']$/g, '')
  } catch {
    return undefined
  }
}

const email = process.env.E2E_USER_EMAIL ?? localEnv('DEMO_ACCOUNT_EMAIL')
const password = process.env.E2E_USER_PASSWORD ?? localEnv('DEMO_ACCOUNT_PASSWORD')
const dbUrl = process.env.SUPABASE_DB_URL ?? localEnv('SUPABASE_DB_URL')

// IPS Bogota ya trae `clientes`; `cotizaciones` y `pedidos` se activan para el
// smoke y se retiran en teardown, igual que dian.spec.ts hace con integraciones.
const ORG_NAME = 'IPS Bogota'
const ORG_ID = '1b82cb7c-ea6a-4b84-9388-0dceb40e5b5f'
const ADMIN_ID = 'eb711727-43fe-46a2-b8f5-f63b914191ea'
const CLIENT_NAME = 'E2E Embudo Cliente'
const QUOTE_NOTE = 'E2E embudo'

function psql(sql: string): string {
  return execFileSync('psql', ['-A', '-t', '-v', 'ON_ERROR_STOP=1', dbUrl!], {
    input: sql,
    encoding: 'utf8',
  })
}

const claims = JSON.stringify({ sub: ADMIN_ID, role: 'authenticated' })

function seed(clientId: string): void {
  psql(`
select set_config('request.jwt.claims', '${claims}', true);
update organizations
   set enabled_modules = enabled_modules || array['cotizaciones', 'pedidos']
 where id = '${ORG_ID}';
insert into clients (id, org_id, name, email, status)
values ('${clientId}', '${ORG_ID}', '${CLIENT_NAME}', 'e2e-embudo@example.com', 'Activo');
`)
}

function teardown(clientId: string): void {
  psql(`
select set_config('request.jwt.claims', '${claims}', true);
delete from sales_orders where org_id = '${ORG_ID}' and client_name = '${CLIENT_NAME}';
delete from quotes where org_id = '${ORG_ID}' and client = '${CLIENT_NAME}';
delete from clients where id = '${clientId}';
update organizations
   set enabled_modules = array_remove(array_remove(enabled_modules, 'cotizaciones'), 'pedidos')
 where id = '${ORG_ID}';
`)
}

test.describe('embudo comercial', () => {
  test.skip(
    !email || !password || !dbUrl,
    'Falta el fixture: define E2E_USER_EMAIL/E2E_USER_PASSWORD (o DEMO_ACCOUNT_* en .env.local) y SUPABASE_DB_URL.',
  )

  test('cotización → aceptada → pedido, y no dos pedidos de la misma', async ({ page }) => {
    test.slow() // dos pantallas completas + tres escrituras encadenadas
    const clientId = randomUUID()
    seed(clientId)
    try {
      await signIn(page, email!, password!)
      await page.goto('/dashboard')
      await ensureOrg(page, ORG_NAME)

      /* ── 1. Cotización ─────────────────────────────────────────────────── */
      await page.goto('/dashboard/cotizaciones')
      await page.getByRole('button', { name: /Nueva cotización/ }).click()

      // Se elige la ficha, no se escribe el nombre: el Select rellena el campo
      // «Nombre en el documento» a partir del directorio.
      await expect(page.locator('#co-client-id')).toBeVisible()
      await page.locator('#co-client-id').click()
      await page.locator('[role=option]', { hasText: CLIENT_NAME }).click()
      await expect(page.locator('input.field').first()).toHaveValue(CLIENT_NAME)

      // Una línea, para que la cotización tenga valor y el pedido tenga qué copiar.
      await page.locator('input.field[type=number]').last().fill('250000')
      await page.locator('textarea.field').fill(QUOTE_NOTE)
      await page.getByRole('button', { name: /Guardar|Crear/ }).last().click()

      const fila = page.locator('tbody tr', { hasText: CLIENT_NAME }).first()
      await expect(fila).toBeVisible({ timeout: 10_000 })

      /* ── 2. Aceptar ────────────────────────────────────────────────────── */
      // El estado no se cambia en la fila: se abre la ficha y el Select vive
      // en el cuerpo del Drawer. `create_order_from_quote` rechaza cualquier
      // cotización que no esté Aceptada (KG104).
      await fila.click()
      const ficha = page.locator('.dbody')
      await expect(ficha).toBeVisible()
      await ficha.locator('button.nselect-trigger').first().click()
      await page.locator('[role=option]', { hasText: 'Aceptada' }).click()
      // `changeStatus` cierra la ficha al guardar (setSelected(null)), así que
      // el estado se comprueba en la fila, no en el Select que ya no está.
      await expect(ficha).toBeHidden()
      await expect(fila.locator('.badge', { hasText: 'Aceptada' })).toBeVisible()

      /* ── 3. Pedido desde la cotización ─────────────────────────────────── */
      await page.goto('/dashboard/pedidos')
      const desdeCotizacion = page.getByRole('button', { name: /Desde cotización/ })
      await expect(desdeCotizacion).toBeEnabled()
      await desdeCotizacion.click()
      await page.getByRole('button', { name: /Crear pedido/ }).click()

      const pedido = page.locator('tbody tr', { hasText: CLIENT_NAME }).first()
      await expect(pedido).toBeVisible({ timeout: 10_000 })

      /* ── 4. No dos pedidos de la misma cotización (KG105) ──────────────── */
      // La cotización ya consumida sale de la lista del drawer, así que el
      // botón queda deshabilitado por no tener candidatas.
      await expect(page.getByRole('button', { name: /Desde cotización/ })).toBeDisabled()

      /* ── 5. El enlace relacional, no solo el nombre ────────────────────── */
      // Esta es la aserción que define la migración 98. Antes de ella el RPC
      // insertaba `client_id = null` y esta línea decía `1|` — un pedido con
      // nombre y sin cliente.
      const pedidoEnBase = psql(`
select set_config('request.jwt.claims', '${claims}', true);
select count(*) || '|' || coalesce(max(client_id::text), 'SIN FICHA')
  from sales_orders
 where org_id = '${ORG_ID}' and client_name = '${CLIENT_NAME}' and deleted_at is null;
`).trim().split('\n').pop()
      expect(pedidoEnBase).toBe(`1|${clientId}`)

      // Y la cotización quedó enlazada a la misma ficha.
      const cotizacion = psql(`
select set_config('request.jwt.claims', '${claims}', true);
select coalesce(max(client_id::text), 'SIN FICHA') from quotes
 where org_id = '${ORG_ID}' and client = '${CLIENT_NAME}' and deleted_at is null;
`).trim().split('\n').pop()
      expect(cotizacion).toBe(clientId)
    } finally {
      teardown(clientId)
    }
  })
})

/** Activa la empresa fixture si la cookie dejó otra como activa. */
async function ensureOrg(page: Page, orgName: string): Promise<void> {
  await page.locator('.cswitch-trigger').click()
  const items = page.locator('[role=menuitemradio]')
  await expect(items.first()).toBeVisible()
  const active = page.locator('[role=menuitemradio][aria-checked="true"] .cswitch-item-name')
  if ((await active.first().textContent()) === orgName) {
    await page.locator('[role=menuitemradio][aria-checked="true"]').click()
    return
  }
  const target = page.locator('[role=menuitemradio]', { hasText: orgName })
  await expect(target).toBeVisible()
  await target.click()
  await expect(page.locator('.cswitch-name')).toHaveText(orgName)
}

async function signIn(page: Page, user: string, pass: string): Promise<void> {
  await page.goto('/login')
  await page.locator('#login-email').fill(user)
  await page.locator('#login-password').fill(pass)
  await page.locator('form.auth-form-shell button[type=submit]').click()
  await expect(page).not.toHaveURL(/\/login(\/|$)/)
}
