import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * Marketing automation — smoke (plan fila 14):
 *
 *   fixture (psql, como el admin demo) → crear plantilla → aplicarla al
 *   formulario → crear campaña → armar la lista con filtros (estado Activo +
 *   solo con correo) → verificar audienceCount → marcar enviada.
 *
 * El fixture siembra tres clientes en la empresa demo con marketing, para
 * que el filtro sea una aserción y no un baile:
 *   A: Activo CON correo  → único que debe quedar en la lista
 *   B: Activo SIN correo  → recortado por hasEmail
 *   C: Prospecto CON correo → recortado por status
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

// Kigyo Demo Dos: la empresa demo con `marketing` activo.
const ORG_NAME = 'Kigyo Demo Dos'
const ORG_ID = 'f8eafe69-c415-479c-8eac-c17b1a29c6db'
const ADMIN_ID = 'eb711727-43fe-46a2-b8f5-f63b914191ea'
const TEMPLATE = 'E2E Promo plantilla'
const CAMPAIGN = `${TEMPLATE} (copia)` // nombre que deja "Aplicar"

function psql(sql: string): string {
  return execFileSync('psql', ['-A', '-t', '-v', 'ON_ERROR_STOP=1', dbUrl!], {
    input: sql,
    encoding: 'utf8',
  })
}

const claims = JSON.stringify({ sub: ADMIN_ID, role: 'authenticated' })

function seed(): void {
  psql(`
select set_config('request.jwt.claims', '${claims}', true);
insert into clients (org_id, name, status, kind, email, phone, city) values
  ('${ORG_ID}', 'E2E Cliente A', 'Activo', 'Empresa', 'e2e-a@kigyo.test', '3001110001', 'Bogotá'),
  ('${ORG_ID}', 'E2E Cliente B', 'Activo', 'Empresa', null, '3001110002', 'Bogotá'),
  ('${ORG_ID}', 'E2E Cliente C', 'Prospecto', 'Empresa', 'e2e-c@kigyo.test', '3001110003', 'Bogotá');
`)
}

function teardown(): void {
  psql(`
select set_config('request.jwt.claims', '${claims}', true);
delete from marketing_recipients where campaign_id in (
  select id from marketing_campaigns where org_id = '${ORG_ID}' and name like 'E2E%'
);
delete from marketing_campaigns where org_id = '${ORG_ID}' and name like 'E2E%';
delete from marketing_templates where org_id = '${ORG_ID}' and name like 'E2E%';
delete from clients where org_id = '${ORG_ID}' and name like 'E2E Cliente%';
`)
}

test.describe('marketing automation', () => {
  test.skip(
    !email || !password || !dbUrl,
    'Falta el fixture: define E2E_USER_EMAIL/E2E_USER_PASSWORD (o DEMO_ACCOUNT_* en .env.local) y SUPABASE_DB_URL.',
  )

  test('plantilla → campaña → lista filtrada → enviada', async ({ page }) => {
    test.slow() // varios server actions con refresh completo del módulo
    seed()
    try {
      await signIn(page, email!, password!)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard(\/|$)/)
      await ensureOrg(page, ORG_NAME)

      await page.goto('/dashboard/marketing')
      const nueva = page.locator('.card', { hasText: 'Nueva campaña' })
      await expect(nueva).toBeVisible()

      // 1. Crear la plantilla.
      const plantillas = page.locator('.card', { hasText: 'Plantillas' })
      await plantillas.locator('input[placeholder="Ej: Bienvenida nuevo cliente"]').fill(TEMPLATE)
      await plantillas.locator('input[placeholder="Texto de la plantilla"]').fill('E2E mensaje de promo')
      await plantillas.getByRole('button', { name: 'Guardar plantilla' }).click()
      const tplRow = plantillas.locator('tbody tr', { hasText: TEMPLATE })
      await expect(tplRow).toBeVisible()

      // 2. Aplicarla: rellena el formulario de campaña.
      await tplRow.getByRole('button', { name: `Aplicar la plantilla ${TEMPLATE}` }).click()
      const nombreInput = nueva.locator('input[placeholder="Ej: Promoción de mitad de año"]')
      await expect(nombreInput).toHaveValue(CAMPAIGN)
      await expect(nueva.locator('input[placeholder="Texto de la campaña"]')).toHaveValue('E2E mensaje de promo')

      // 3. Crear la campaña con el formulario pre-llenado.
      await nueva.getByRole('button', { name: 'Crear campaña' }).click()
      const campRow = page.locator('.card', { hasText: 'Campañas' }).locator('tbody tr', { hasText: CAMPAIGN }).first()
      await expect(campRow).toBeVisible()
      await expect(campRow.locator('.badge', { hasText: 'Borrador' })).toBeVisible()

      // 4. Armar la lista: Activo + solo con correo → solo el cliente A.
      await campRow.getByRole('button', { name: `Armar la lista de ${CAMPAIGN}` }).click()
      const filtros = page.locator('tr', { hasText: 'Estado cliente' })
      await expect(filtros).toBeVisible()
      await filtros.locator('button.nselect-trigger').first().click()
      await page.locator('[role=option]', { hasText: /^Activo$/ }).click()
      await filtros.locator('#gen-has-email').check()
      await filtros.getByRole('button', { name: 'Armar lista' }).click()

      // audienceCount en la fila de la campaña pasa de 0 a 1.
      await expect(campRow.locator('td.mono').first()).toHaveText('1')

      // 5. Marcar enviada.
      await campRow.getByRole('button', { name: `Marcar ${CAMPAIGN} como enviada` }).click()
      await expect(campRow.locator('.badge', { hasText: 'Enviada' })).toBeVisible()
    } finally {
      teardown()
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
