import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * DIAN modo demo — smoke del flujo completo:
 *
 *   fixture (psql, como el admin demo) → habilitar la integración en
 *   Integraciones → abrir el panel DIAN → enviar una factura Emitida →
 *   verificar documento con CUFE simulado + bitácora (envío + aceptación)
 *   + XML UBL descargable.
 *
 * El fixture es propio del spec: una factura Emitida con una línea, con
 * uuid conocido, en la empresa demo que tiene el módulo `facturacion`
 * (IPS Bogota). El teardown borra la factura (cascade limpia items,
 * dian_documents y dian_events — bitácora append-only se lleva el FK
 * cascade, no hay DELETE que revocar) y deja la integración deshabilitada.
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

// IPS Bogota: la empresa demo con `facturacion` (y `integraciones`) activos.
const ORG_NAME = 'IPS Bogota'
const ADMIN_ID = 'eb711727-43fe-46a2-b8f5-f63b914191ea'
const CLIENT_NAME = 'E2E DIAN Cliente'

/** Corre SQL como el admin demo (RLS via request.jwt.claims, patrón psql). */
function psql(sql: string): string {
  return execFileSync('psql', ['-A', '-t', '-v', 'ON_ERROR_STOP=1', dbUrl!], {
    input: sql,
    encoding: 'utf8',
  })
}

const claims = JSON.stringify({ sub: ADMIN_ID, role: 'authenticated' })

function seedFacturaEmitida(invoiceId: string): void {
  psql(`
select set_config('request.jwt.claims', '${claims}', true);
-- La ruta Integraciones vive tras el modulo integraciones, que IPS Bogota
-- no tiene de fabrica; se activa para el smoke y se retira en teardown.
update organizations set enabled_modules = enabled_modules || array['integraciones']
where name = '${ORG_NAME}' and not ('integraciones' = any (enabled_modules));
insert into invoices (id, org_id, client_name, status, issued_on, due_on, subtotal_cents, tax_cents, total_cents, currency)
values ('${invoiceId}', (select id from organizations where name = '${ORG_NAME}'), '${CLIENT_NAME}', 'Emitida', current_date, current_date + 30, 100000, 19000, 119000, 'COP');
insert into invoice_items (invoice_id, description, quantity, unit_price_cents, tax_rate, position)
values ('${invoiceId}', 'E2E item DIAN', 1, 100000, 19.00, 0);
`)
}

function teardown(invoiceId: string): void {
  psql(`
select set_config('request.jwt.claims', '${claims}', true);
delete from invoices where id = '${invoiceId}';
update integration_settings set enabled = false where kind = 'dian' and config ->> 'ambiente' = 'demo' and org_id in (select id from organizations where name = '${ORG_NAME}');
update organizations set enabled_modules = array_remove(enabled_modules, 'integraciones') where name = '${ORG_NAME}';
`)
}

test.describe('DIAN demo', () => {
  test.skip(
    !email || !password || !dbUrl,
    'Falta el fixture: define E2E_USER_EMAIL/E2E_USER_PASSWORD (o DEMO_ACCOUNT_* en .env.local) y SUPABASE_DB_URL.',
  )

  test('habilita DIAN, envía una Emitida y queda CUFE + bitácora + XML', async ({ page }) => {
    test.slow() // habilitar integración + envío + detalle = varias idas al server
    const invoiceId = randomUUID()
    seedFacturaEmitida(invoiceId)
    try {
      await signIn(page, email!, password!)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard(\/|$)/)
      await ensureOrg(page, ORG_NAME)

      // 1. Habilitar la integración DIAN (si ya quedó habilitada de otra
      //    corrida, el guardado upsert igual ejercita el camino real).
      await page.goto('/dashboard/integraciones')
      const dianCard = page.locator('.card', { hasText: 'Facturación electrónica DIAN (modo demo)' })
      await expect(dianCard).toBeVisible()
      // 'Habilitada' es substring de 'Deshabilitada': match exacto obligatorio.
      const habilitada = dianCard.locator('.badge').filter({ hasText: /^Habilitada$/ })
      if (!(await habilitada.isVisible())) {
        const checkbox = dianCard.locator('label:has-text("Habilitada") input[type=checkbox]')
        if (!(await checkbox.isChecked())) await checkbox.check()
        await dianCard.getByRole('button', { name: 'Guardar', exact: true }).click()
      }
      await expect(habilitada).toBeVisible()

      // 2. Panel DIAN desde el link de Integraciones.
      await dianCard.getByRole('link', { name: 'Abrir panel DIAN' }).click()
      await expect(page).toHaveURL(/\/dashboard\/dian(\/|$)/)

      // 3. Elegir la factura del fixture y enviarla.
      const enviarCard = page.locator('.card', { hasText: 'Enviar factura a DIAN' })
      await enviarCard.locator('button.nselect-trigger').click()
      await page.locator('[role=option]', { hasText: CLIENT_NAME }).first().click()

      // Sin selección el botón queda disabled; con la factura, habilita.
      const enviarBtn = enviarCard.getByRole('button', { name: /Enviar a DIAN demo/ })
      await expect(enviarBtn).toBeEnabled()
      await enviarBtn.click()

      // 4. La tabla de documentos muestra la fila con CUFE y estado.
      const fila = page.locator('.card', { hasText: 'Documentos DIAN' }).locator('tbody tr', { hasText: CLIENT_NAME })
      await expect(fila).toBeVisible()
      await expect(fila.locator('.badge', { hasText: 'Aceptada' })).toBeVisible()
      // CUFE simulado: SHA-256 hex — en tabla se muestra truncado.
      await expect(fila.getByText(/^[0-9a-f]{16}…$/)).toBeVisible()

      // 5. Detalle: CUFE completo + bitácora envío/aceptación + XML UBL.
      await fila.locator('button[aria-label^="Ver detalle DIAN de"]').click()
      const dialog = page.locator('[role=dialog]')
      await expect(dialog).toBeVisible()
      const cufe = dialog.locator('.mono', { hasText: /^[0-9a-f]{64}$/ })
      await expect(cufe).toBeVisible()
      await expect(dialog.locator('.badge', { hasText: 'Envío' })).toBeVisible()
      await expect(dialog.locator('.badge', { hasText: 'Aceptación' })).toBeVisible()

      await dialog.getByRole('button', { name: 'Ver XML UBL' }).click()
      const xml = dialog.locator('pre[aria-label="XML UBL 2.1 de la factura"]')
      await expect(xml).toBeVisible()
      await expect(xml).toContainText('<Invoice')
      await expect(xml).toContainText(CLIENT_NAME)

      // 6. La factura ya no vuelve a aparecer como pendiente: era la única
      //    Emitida sin doc, así que el selector cede al empty state.
      await dialog.getByRole('button', { name: 'Cerrar' }).click()
      await expect(dialog).toBeHidden()
      await expect(enviarCard).toContainText('No hay facturas Emitidas pendientes')
    } finally {
      teardown(invoiceId)
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
