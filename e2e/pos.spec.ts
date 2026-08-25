import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * POS offline — smoke (plan fila 16):
 *
 *   fixture (psql, como el admin demo) → cortar la red del contexto →
 *   armar carrito → cobrar Efectivo → venta en cola IndexedDB (banner +
 *   badge + modal) → restaurar red → auto-replay → la venta aparece en
 *   Ventas como Pagada y la existencia baja.
 *
 * El QR Wompi offline se niega explícito, pero la opción solo existe con
 * plan Enterprise + pasarela: si el option no está en el Select, esa
 * aserción se salta sola.
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

// IPS Bogota: la empresa demo con `pos` + `catalogos` activos.
const ORG_NAME = 'IPS Bogota'
const ORG_ID = '1b82cb7c-ea6a-4b84-9388-0dceb40e5b5f'
const ADMIN_ID = 'eb711727-43fe-46a2-b8f5-f63b914191ea'
const PRODUCT = 'E2E POS Producto'
const CUSTOMER = 'E2E POS Cliente'

/**
 * `psql`, sin filtrar la cadena de conexión cuando falla.
 *
 * `execFileSync` mete el comando entero en el mensaje de error, y el comando
 * lleva `SUPABASE_DB_URL` — usuario y contraseña incluidos. Un fallo de fixture
 * acababa imprimiendo las credenciales de producción en la salida de la suite,
 * que es exactamente donde se copian y se pegan en un informe o en un log de
 * CI. Se vuelve a lanzar solo lo que dijo el servidor.
 *
 * Nótese que NO devuelve `.trim()`: varios llamantes de este archivo parten la
 * salida por líneas y cuentan con el salto final. Cambiarlo aquí rompería los
 * fixtures en silencio, que es peor que la fuga que se está tapando.
 */
function psql(sql: string): string {
  try {
    return execFileSync('psql', ['-A', '-t', '-v', 'ON_ERROR_STOP=1', dbUrl!], {
      input: sql,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? ''
    throw new Error(`psql falló: ${stderr.trim() || 'sin detalle'}`)
  }
}

const claims = JSON.stringify({ sub: ADMIN_ID, role: 'authenticated' })

function seed(productId: string): void {
  psql(`
select set_config('request.jwt.claims', '${claims}', true);
insert into products (id, org_id, sku, name, category, price_cents, stock, unit, is_active, barcode)
values ('${productId}', '${ORG_ID}', 'E2E-POS-1', '${PRODUCT}', 'E2E', 50000, 5, 'UN', true, 'E2EPOS0001');
`)
}

function teardown(productId: string): void {
  psql(`
select set_config('request.jwt.claims', '${claims}', true);
delete from pos_sales where org_id = '${ORG_ID}' and customer_name = '${CUSTOMER}';
delete from products where id = '${productId}';
`)
}

test.describe('POS offline', () => {
  test.skip(
    !email || !password || !dbUrl,
    'Falta el fixture: define E2E_USER_EMAIL/E2E_USER_PASSWORD (o DEMO_ACCOUNT_* en .env.local) y SUPABASE_DB_URL.',
  )

  test('cobra offline, encola en IndexedDB y auto-replay al volver la red', async ({ page }) => {
    test.slow() // replay de la cola + refetch del POS completo
    const productId = randomUUID()
    seed(productId)
    try {
      await signIn(page, email!, password!)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard(\/|$)/)
      await ensureOrg(page, ORG_NAME)

      await page.goto('/dashboard/pos')
      const tile = page.locator('.pos-tile', { hasText: PRODUCT })
      await expect(tile).toBeVisible()
      await expect(tile).toContainText('5 UN')

      // 1. Se corta la red del contexto: banner offline.
      await page.context().setOffline(true)
      await expect(page.locator('.pos-warn[role=status]')).toContainText('Sin conexión')

      // 2. Carrito + cobro Efectivo → a la cola.
      await tile.click()
      await page.locator('#pv-customer').fill(CUSTOMER)
      await page.getByRole('button', { name: /Cobrar/ }).click()

      // 3. Badge de la cola: 1 pendiente. El botón de la cola queda
      //    disabled mientras no hay red (el modal solo opera online), así
      //    que se aserta su presencia y estado, no su apertura.
      const verCola = page.getByRole('button', { name: /Ver cola \(1\)/ })
      await expect(verCola).toBeVisible()
      await expect(verCola).toBeDisabled()

      // 4. QR offline se niega explícito — solo si la opción existe (plan).
      await page.locator('button.nselect-trigger').first().click()
      const qrOpt = page.locator('[role=option]', { hasText: 'QR Wompi' })
      if ((await qrOpt.count()) > 0) {
        await qrOpt.click()
        await tile.click()
        await page.getByRole('button', { name: /Cobrar/ }).click()
        await expect(page.getByText('El pago por QR Wompi necesita conexión')).toBeVisible()
        // vuelve a Efectivo para no dejar el medio cambiado.
        await page.locator('.nselect button.nselect-trigger').first().click()
        await page.locator('[role=option]', { hasText: 'Efectivo' }).click()
      } else {
        await page.keyboard.press('Escape')
      }

      // 5. Vuelve la red: auto-replay vacía la cola y el banner desaparece
      //    (queda online + count 0). El selector va por clase porque los
      //    toasts también usan role=status.
      await page.context().setOffline(false)
      await expect(page.locator('.pos-warn[role=status]')).toBeHidden({ timeout: 15_000 })

      // 6. La venta está en Ventas, Pagada, y el stock bajó de 5 a 4.
      await page.getByRole('tab', { name: 'Ventas', exact: true }).click()
      const venta = page.locator('tbody tr', { hasText: CUSTOMER }).first()
      await expect(venta).toBeVisible()
      await expect(venta.locator('.badge', { hasText: 'Pagada' })).toBeVisible()
      await expect(venta.locator('.badge', { hasText: 'Efectivo' })).toBeVisible()

      await page.getByRole('tab', { name: 'Vender', exact: true }).click()
      await expect(tile).toContainText('4 UN')
    } finally {
      teardown(productId)
    }
  })
})

/** Activa la empresa fixture si el sesión cookie dejó otra como activa. */
async function ensureOrg(page: Page, orgName: string): Promise<void> {
  await page.locator('.cswitch-trigger').click()
  const items = page.locator('[role=menuitemradio]')
  await expect(items.first()).toBeVisible()
  const active = page.locator('[role=menuitemradio][aria-checked="true"] .cswitch-item-name')
  if ((await active.first().textContent()) === orgName) {
    // Re-elegir la activa cierra el menú sin navegación (choose() no-op).
    await page.locator('[role=menuitemradio][aria-checked="true"]').click()
    return
  }
  const target = page.locator('[role=menuitemradio]', { hasText: orgName })
  await expect(target).toBeVisible()
  await target.click()
  await expect(page).toHaveURL(/\/dashboard(\/|$)/)
  await expect(page.locator('.cswitch-name')).toHaveText(orgName)
}

async function signIn(page: Page, user: string, pass: string): Promise<void> {
  await page.goto('/login')
  await page.locator('#login-email').fill(user)
  await page.locator('#login-password').fill(pass)
  await page.locator('form.auth-form-shell button[type=submit]').click()
  await expect(page).not.toHaveURL(/\/login(\/|$)/)
}
